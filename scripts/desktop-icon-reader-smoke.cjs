const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadReader(platform, baseline) {
  const mockProcess = { platform };
  if (baseline) return new Function('process', 'dependencies', 'const { runPowerShellScript, getDesktopIconPowerShellScript, normalizeDesktopIcon, attachDesktopIconCoordinateSpaces, listDesktopFileFallbackIcons, logMessage } = dependencies;\n' + baseline + '\nreturn { fetchDesktopIcons, resolveDesktopIconReadFallbacks };').bind(null, mockProcess);
  const source = fs.readFileSync('electron/desktopIcons/desktopIconReader.cjs', 'utf8');
  const module = { exports: {} };
  new Function('process', 'module', source)(mockProcess, module);
  return module.exports.createDesktopIconReader;
}

async function capture(action, error) {
  try { return { value: await action() }; }
  catch (caught) {
    assert.ok(caught === error || caught instanceof SyntaxError);
    return { error: caught.name, message: caught.message };
  }
}

async function exerciseFetch(load) {
  const records = [];
  const payloads = ['', ' ', null, '[]', '{}', '{"id":"one"}', '[null,{"id":"two"}]', '[1,2]', 'null', 'bad-json'];
  for (const platform of ['win32', 'linux']) for (const payload of payloads) for (const mode of ['normal', 'options', 'script', 'run', 'normalize', 'attach']) {
    const events = [], error = new Error('fixture failure'); error.stack = 'fixture failure';
    const fail = stage => { if (mode === stage) throw error; };
    const reader = load(platform)({
      getDesktopIconPowerShellScript(options) { events.push(['script', options]); fail('script'); return 'exact script'; },
      runPowerShellScript(script) { events.push(['run', script]); fail('run'); return Promise.resolve(payload); },
      normalizeDesktopIcon(value) { events.push(['normalize', value]); fail('normalize'); return value && typeof value === 'object' ? value : null; },
      attachDesktopIconCoordinateSpaces(value) { events.push(['attach', value]); fail('attach'); return value && { ...value, coordinateSpace: 'dip' }; },
      listDesktopFileFallbackIcons() { throw new Error('unexpected filesystem fallback'); }, logMessage() { throw new Error('unexpected log'); },
    });
    assert.deepEqual(events, [], 'reader initialization does no work');
    const options = { get includeReadOnlyPositionFallback() { events.push(['options']); fail('options'); return 'truthy'; } };
    const result = await capture(() => reader.fetchDesktopIcons(options), error);
    if (platform === 'linux') { assert.deepEqual(result, { value: [] }); assert.deepEqual(events, []); }
    if (platform === 'win32' && mode === 'normal' && payload === '{"id":"one"}') assert.deepEqual(result.value, [{ id: 'one', coordinateSpace: 'dip' }]);
    if (platform === 'win32' && mode !== 'options') assert.deepEqual(events.find(event => event[0] === 'script')[1], { includeReadOnlyPositionFallback: true });
    records.push({ platform, payload, mode, events, result });
  }
  return records;
}

async function exerciseFallback(load) {
  const records = [];
  for (const hasIcons of [false, true]) for (const position of [false, true]) for (const filesystem of [false, true]) {
    for (const positionResult of ['empty', 'icons', 'failure']) for (const fileResult of ['empty', 'icons', 'failure']) for (const logFailure of ['none', 'used', 'failed']) {
      const events = [], error = new Error('fixture failure'); error.stack = 'fixture failure';
      const initial = hasIcons ? [{ id: 'initial' }] : [], files = fileResult === 'icons' ? [{ id: 'file' }] : [];
      const reader = load('win32')({
        getDesktopIconPowerShellScript(options) { events.push(['script', options]); return 'position script'; },
        async runPowerShellScript(script) { events.push(['run', script]); if (positionResult === 'failure') throw error; return positionResult === 'icons' ? '[{"id":"position"}]' : '[]'; },
        normalizeDesktopIcon(value) { events.push(['normalize', value]); return value; },
        attachDesktopIconCoordinateSpaces(value) { events.push(['attach', value]); return value; },
        listDesktopFileFallbackIcons() { events.push(['file']); if (fileResult === 'failure') throw error; return files; },
        logMessage(message, details) { events.push(['log', message, details]); if (logFailure !== 'none' && message.endsWith(logFailure)) throw error; },
      });
      assert.deepEqual(events, []);
      const snapshot = [...initial];
      const result = await capture(() => reader.resolveDesktopIconReadFallbacks(initial, { includeReadOnlyPositionFallback: position, includeFileSystemFallback: filesystem }), error);
      assert.deepEqual(initial, snapshot, 'fallback does not mutate input icons');
      if (hasIcons || (!position && !filesystem)) { assert.equal(result.value, initial); assert.deepEqual(events, []); }
      if (!hasIcons && !position && filesystem && fileResult !== 'failure' && !(fileResult === 'icons' && logFailure === 'used')) assert.equal(result.value, files);
      if (!hasIcons && position && positionResult === 'icons' && logFailure !== 'used') { assert.deepEqual(result.value, [{ id: 'position' }]); assert.ok(!events.some(event => event[0] === 'file')); }
      records.push({ hasIcons, position, filesystem, positionResult, fileResult, logFailure, events, result });
    }
  }
  return records;
}

function checkBudgets() {
  const source = fs.readFileSync('electron/desktopIcons/desktopIconReader.cjs', 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile('reader.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync('electron/desktopIconService.cjs', 'utf8');
  assert.match(root, /createDesktopIconReader\(\{/);
  for (const declaration of ['let cachedIcons = []', 'let cacheUpdatedAt = 0', 'let pendingRequest = null']) assert.ok(root.includes(declaration));
  assert.match(root, /const listDesktopIcons = createDesktopIconListController\(\{/);
  const controller = fs.readFileSync('electron/desktopIcons/desktopIconListController.cjs', 'utf8');
  assert.match(controller, /state\.pendingRequest = refreshDesktopIcons\(\)/);
}

async function main() {
  const fetched = await exerciseFetch(platform => loadReader(platform));
  const fallback = await exerciseFallback(platform => loadReader(platform));
  if (process.argv[2]) {
    const baseline = fs.readFileSync(process.argv[2], 'utf8');
    assert.deepEqual(fetched, await exerciseFetch(platform => loadReader(platform, baseline)));
    assert.deepEqual(fallback, await exerciseFallback(platform => loadReader(platform, baseline)));
  }
  checkBudgets();
  console.log(`Desktop icon reader smoke passed (${fetched.length} fetch cases, ${fallback.length} fallback cases${process.argv[2] ? ', original behavior identical' : ''}).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
