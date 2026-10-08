const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadController(clock, baseline) {
  const date = { now: () => clock.now };
  if (baseline) return new Function('Date', 'dependencies', `
    const { state, fetchDesktopIcons, resolveDesktopIconReadFallbacks, logMessage, normalizeDesktopIconCoordinateSpaceOption, selectDesktopIconCoordinateSpace } = dependencies;
    let cachedIcons = state.cachedIcons, cacheUpdatedAt = state.cacheUpdatedAt, pendingRequest = state.pendingRequest;
    Object.defineProperties(state, {
      cachedIcons: { get: () => cachedIcons, set: value => { cachedIcons = value; }, configurable: true },
      cacheUpdatedAt: { get: () => cacheUpdatedAt, set: value => { cacheUpdatedAt = value; }, configurable: true },
      pendingRequest: { get: () => pendingRequest, set: value => { pendingRequest = value; }, configurable: true },
    });
    const DESKTOP_ICON_CACHE_TTL_MS = 5000;
    ${baseline}
    return listDesktopIcons;
  `).bind(null, date);
  const module = { exports: {} };
  new Function('Date', 'module', fs.readFileSync('electron/desktopIcons/desktopIconListController.cjs', 'utf8'))(date, module);
  return module.exports.createDesktopIconListController;
}

function snapshot(state) { return { icons: state.cachedIcons, updated: state.cacheUpdatedAt, pending: Boolean(state.pendingRequest) }; }

function createFixture(state, mode, events) {
  const error = new Error('fixture failure'); error.stack = 'fixture failure';
  const fetches = [];
  const fail = stage => { if (mode === stage) throw error; };
  const dependencies = {
    state,
    fetchDesktopIcons() {
      events.push(['fetch']); fail('sync-fetch');
      return new Promise((resolve, reject) => fetches.push({ resolve, reject }));
    },
    async resolveDesktopIconReadFallbacks(icons, options) {
      events.push(['fallback', icons, options, snapshot(state)]); fail('fallback');
      return !icons.length && (options.includeFileSystemFallback || options.includeReadOnlyPositionFallback) ? [{ id: 'fallback' }] : icons;
    },
    logMessage(message, details) {
      events.push(['log', message, details, snapshot(state)]);
      if (message === 'desktop icons refreshed') fail('refresh-log'); else fail('failure-log');
    },
    normalizeDesktopIconCoordinateSpaceOption(value) { events.push(['space', value]); fail('normalize'); return value === 'native-screen' ? value : 'dip'; },
    selectDesktopIconCoordinateSpace(icon, space) { events.push(['select', icon, space]); fail('select'); return { ...icon, coordinateSpace: space }; },
  };
  return { dependencies, fetches, error };
}

function recordPromise(promise, error) {
  return promise.then(value => ({ value }), caught => { assert.equal(caught, error); return { error: caught.message }; });
}

async function runScenario(factory, config) {
  const { hasCache, age, force, profile, mode } = config, clock = { now: 10000 };
  const state = { cachedIcons: hasCache ? [{ id: 'cached' }] : [], cacheUpdatedAt: clock.now - age, pendingRequest: null };
  const events = [], fixture = createFixture(state, mode, events);
  const list = factory(clock)(fixture.dependencies);
  assert.deepEqual(events, [], 'controller initialization does not query or fetch');
  const first = recordPromise(list({ forceRefresh: force, coordinateSpace: 'native-screen', includeFileSystemFallback: profile === 1, includeReadOnlyPositionFallback: profile === 2 }), fixture.error);
  const second = recordPromise(list({ includeFileSystemFallback: true }), fixture.error);
  const third = recordPromise(list({ forceRefresh: true, coordinateSpace: 'unknown' }), fixture.error);
  assert.ok(fixture.fetches.length <= 1, 'all concurrent refresh requests share one fetch');
  const before = snapshot(state);
  if (profile === 1) { state.cacheUpdatedAt = 0; events.push(['invalidate', snapshot(state)]); }
  clock.now += 7;
  for (const fetch of fixture.fetches) {
    if (mode === 'reject' || mode === 'failure-log') fetch.reject(fixture.error);
    else fetch.resolve(mode === 'empty' ? [] : [{ id: 'fresh' }]);
  }
  const results = await Promise.all([first, second, third]);
  assert.equal(state.pendingRequest, null, 'pending request is cleared before projected results settle');
  const after = snapshot(state);
  const fourth = recordPromise(list({ coordinateSpace: 'native-screen' }), fixture.error);
  for (const fetch of fixture.fetches.slice(1)) fetch.resolve([{ id: 'later' }]);
  const late = await fourth;
  return { config, before, after, final: snapshot(state), results, late, fetchCount: fixture.fetches.length, events };
}

async function exercise(factory) {
  const records = [];
  for (const hasCache of [false, true]) for (const age of [-1, 0, 5000, 5001, 10001]) for (const force of [false, true]) for (const profile of [0, 1, 2]) {
    for (const mode of ['normal', 'empty', 'reject', 'sync-fetch', 'refresh-log', 'failure-log', 'fallback', 'select', 'normalize']) records.push(await runScenario(factory, { hasCache, age, force, profile, mode }));
  }
  return records;
}

function checkBudgets() {
  const source = fs.readFileSync('electron/desktopIcons/desktopIconListController.cjs', 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile('controller.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync('electron/desktopIconService.cjs', 'utf8');
  assert.match(root, /const listDesktopIcons = createDesktopIconListController\(\{/);
  for (const field of ['cachedIcons', 'cacheUpdatedAt', 'pendingRequest']) {
    assert.match(root, new RegExp(`get ${field}\\(\\) \\{ return ${field}; \\}`));
    assert.match(root, new RegExp(`set ${field}\\(value\\) \\{ ${field} = value; \\}`));
    assert.ok(!source.includes(`let ${field}`), 'cache state is still owned by root');
  }
}

async function main() {
  const records = await exercise(clock => loadController(clock));
  if (process.argv[2]) {
    const baseline = fs.readFileSync(process.argv[2], 'utf8');
    assert.deepEqual(records, await exercise(clock => loadController(clock, baseline)));
  }
  checkBudgets();
  console.log(`Desktop icon cache smoke passed (${records.length} scenarios, four list calls each${process.argv[2] ? ', original behavior identical' : ''}).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
