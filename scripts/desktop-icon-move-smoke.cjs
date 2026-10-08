const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadMover(platform, baseline) {
  const mockProcess = { platform };
  if (baseline) return new Function('process', 'dependencies', 'const { listDesktopIcons, normalizeDesktopIconCoordinateSpaceOption, petToScreenCoordinate, getDesktopIconFolderViewMovePowerShellScript, getDesktopIconMovePowerShellScript, runPowerShellScript, invalidate, compactDesktopIconPowerShellError, logMessage } = dependencies;\n' + baseline + '\nreturn moveDesktopIcon;').bind(null, mockProcess);
  const module = { exports: {} };
  new Function('process', 'module', fs.readFileSync('electron/desktopIcons/desktopIconMover.cjs', 'utf8'))(mockProcess, module);
  return module.exports.createDesktopIconMover;
}

function createFixture(config, events) {
  const { source, readOnly, output, offset, mode } = config;
  const error = Object.assign(new Error('fixture failure'), { stderr: 'stderr evidence', stdout: 'stdout evidence' });
  const fail = stage => { if (mode === stage || mode === `failure-${stage}`) throw error; };
  const icon = { id: 'primary', name: 'item', index: 7, x: 0, y: 0, positionSource: source, canMove: !readOnly };
  const moved = { ...icon, x: -13 + offset, y: 28 - offset };
  let reads = 0;
  const dependencies = {
    async listDesktopIcons(options) {
      events.push(['list', options]); fail(++reads === 1 ? 'list-first' : 'list-second');
      return source === 'missing' || (reads > 1 && offset === 100) ? [] : reads === 1 ? [icon, { ...icon, id: 'other', name: 'conflict' }] : [moved];
    },
    normalizeDesktopIconCoordinateSpaceOption(value) { events.push(['space', value]); fail('space'); return value === 'native-screen' ? value : 'dip'; },
    petToScreenCoordinate(point) { events.push(['convert', point]); fail('convert'); return { x: point.x * 2, y: point.y * 2 }; },
    getDesktopIconFolderViewMovePowerShellScript(target) { events.push(['folder-script', target]); fail('script'); return 'folder script'; },
    getDesktopIconMovePowerShellScript(target) { events.push(['listview-script', target]); fail('script'); return 'listview script'; },
    runPowerShellScript(script) { events.push(['run', script]); fail('run-sync'); return mode === 'run-reject' || mode === 'compact' || mode.startsWith('failure-') ? Promise.reject(error) : Promise.resolve(output); },
    invalidate() { events.push(['invalidate']); fail('invalidate'); },
    compactDesktopIconPowerShellError(value) { events.push(['compact', value]); fail('compact'); return 'compact failure'; },
    logMessage(...args) { events.push(['log', ...args]); fail('log'); },
  };
  return { dependencies, error, icon, moved };
}

async function runScenario(factory, platform, config) {
  const events = [], fixture = createFixture(config, events), move = factory(platform)(fixture.dependencies);
  assert.deepEqual(events, [], 'creating the mover does not query or execute');
  const request = config.request === 'null' ? null : config.request === 'invalid' ? { x: NaN, y: 1 } : {
    x: config.request === 'strings' ? '-12.6' : -12.6, y: 27.5, coordinateSpace: config.space, iconId: config.request === 'name' ? '' : ' primary ', iconName: config.request === 'name' ? ' item ' : 'conflict',
  };
  let result;
  try {
    const value = await move(request);
    result = { value, originalIdentity: value.icon === fixture.icon, movedIdentity: value.icon === fixture.moved };
  } catch (caught) {
    assert.ok(caught === fixture.error || caught instanceof SyntaxError);
    result = { error: caught.name, message: caught.message };
  }
  if (platform !== 'win32' || ['null', 'invalid'].includes(config.request)) assert.deepEqual(events, [], 'unsupported/invalid requests do not query icons');
  if (result.value?.ok) {
    assert.equal(result.value.verified, config.offset !== 100 && Math.abs(config.offset) <= 8);
    assert.equal(events.filter(event => event[0] === 'invalidate').length, 1);
    assert.equal(events.filter(event => event[0] === 'list').length, 2);
  }
  if (config.space === 'native-screen') assert.ok(!events.some(event => event[0] === 'convert'));
  if (events.some(event => event[0] === 'run')) {
    const script = events.find(event => event[0].endsWith('-script'));
    assert.equal(script[0], config.source === 'folder-view' ? 'folder-script' : 'listview-script');
    assert.deepEqual(script[1], { index: 7, nativeScreenX: config.space === 'native-screen' ? -13 : -26, nativeScreenY: config.space === 'native-screen' ? 28 : 56 });
  }
  return { config, platform, events, result };
}

async function exercise(factory) {
  const records = [];
  for (const platform of ['win32', 'linux']) for (const request of ['null', 'invalid', 'strings', 'name']) for (const space of ['dip', 'native-screen']) {
    for (const source of ['folder-view', 'shell-list-view', 'missing']) for (const readOnly of [false, true]) for (const output of ['', '{"ok":false}', '{"ok":true}', 'null', 'invalid-json']) for (const offset of [0, 8, 9, 100]) {
      records.push(await runScenario(factory, platform, { request, space, source, readOnly, output, offset, mode: 'normal' }));
    }
  }
  for (const platform of ['win32', 'linux']) for (const space of ['dip', 'native-screen']) for (const mode of ['space', 'list-first', 'list-second', 'convert', 'script', 'run-sync', 'run-reject', 'invalidate', 'compact', 'log', 'failure-log', 'failure-invalidate']) {
    const output = '{"ok":true}';
    records.push(await runScenario(factory, platform, { request: 'strings', space, source: 'folder-view', readOnly: false, output, offset: 0, mode }));
  }
  return records;
}

function checkBudgets() {
  const source = fs.readFileSync('electron/desktopIcons/desktopIconMover.cjs', 'utf8'); assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile('mover.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const lines = ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      assert.ok(lines <= 50, `${node.name?.text || 'anonymous'} exceeds function budget: ${lines}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync('electron/desktopIconService.cjs', 'utf8');
  assert.match(root, /const moveDesktopIcon = createDesktopIconMover\(\{/);
  assert.match(root, /function invalidate\(\) \{\s*cacheUpdatedAt = 0;/);
}

async function main() {
  const records = await exercise(platform => loadMover(platform));
  if (process.argv[2]) {
    const baseline = fs.readFileSync(process.argv[2], 'utf8');
    assert.deepEqual(records, await exercise(platform => loadMover(platform, baseline)));
  }
  checkBudgets();
  console.log(`Desktop icon move smoke passed (${records.length} cases${process.argv[2] ? ', original behavior identical' : ''}).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
