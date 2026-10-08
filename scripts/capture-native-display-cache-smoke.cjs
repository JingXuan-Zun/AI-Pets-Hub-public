const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const cacheFile = path.resolve(__dirname, '../electron/capture/nativeDisplayCache.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;

function createFixture(original) {
  let now = 100;
  const pending = [];
  const trace = [];
  const dependencies = {
    NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS: 15000,
    getNativeDisplayBounds() {
      trace.push(['load', now]);
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
  };
  const clock = { now() { trace.push(['clock', now]); return now; } };
  let api;
  if (original) {
    const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
    const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    const names = ['isNativeDisplayBoundsCacheFresh', 'invalidateNativeDisplayBoundsCache', 'getNativeDisplayBoundsCached'];
    const declarations = names.map(name => factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
    api = new Function('Date', 'getNativeDisplayBounds', 'NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS',
      'let nativeDisplayBoundsCache = { displays: [], updatedAt: 0 };\n' + declarations
      + '\nreturn { invalidateNativeDisplayBoundsCache, getNativeDisplayBoundsCached };')(
      clock, dependencies.getNativeDisplayBounds, 15000);
  } else {
    const module = { exports: {} };
    new Function('module', 'Date', fs.readFileSync(cacheFile, 'utf8'))(module, clock);
    api = module.exports.createNativeDisplayCache(dependencies);
  }
  assert.deepEqual(trace, [], 'Creating the cache must not query time or load native bounds');
  return { api, pending, trace, setTime(value) { now = value; } };
}

async function runBoundary(start, elapsed, empty, force, reset, failure, original) {
  const fixture = createFixture(original);
  const { api, pending, trace } = fixture;
  fixture.setTime(start);
  const first = api.getNativeDisplayBoundsCached();
  const initial = empty ? [] : [{ width: 1920, height: 1080 }];
  pending.shift().resolve(initial);
  assert.strictEqual(await first, initial);
  fixture.setTime(start + elapsed);
  if (reset) api.invalidateNativeDisplayBoundsCache();
  const options = {};
  Object.defineProperty(options, 'forceRefresh', { get() { trace.push(['force', force]); return force; } });
  const request = api.getNativeDisplayBoundsCached(options);
  const hit = !force && !reset && start > 0 && elapsed <= 15000;
  assert.equal(pending.length, hit ? 0 : 1);
  const updated = [{ width: 2560, height: 1440 }];
  if (!hit) {
    if (failure) pending.shift().reject(Error('native-failure'));
    else pending.shift().resolve(updated);
  }
  let outcome;
  try {
    const result = await request;
    assert.strictEqual(result, hit ? initial : updated);
    outcome = { value: result, sameInitial: result === initial };
  } catch (error) { assert.equal(error.message, 'native-failure'); outcome = { error: error.message }; }
  // A failed refresh preserves the prior cache (unless it was invalidated).
  fixture.setTime(start);
  const after = api.getNativeDisplayBoundsCached();
  const loadedAgain = pending.length > 0;
  if (loadedAgain) pending.shift().resolve(updated);
  const afterValue = await after;
  if (failure && !hit && !reset && start > 0) assert.strictEqual(afterValue, initial);
  return { trace, outcome, loadedAgain, afterValue };
}

async function runConcurrent(reset, reverse, rejectOld, original) {
  const fixture = createFixture(original);
  const { api, pending, trace } = fixture;
  const old = api.getNativeDisplayBoundsCached().then(value => ({ value }), error => ({ error: error.message }));
  if (reset) api.invalidateNativeDisplayBoundsCache();
  const newer = api.getNativeDisplayBoundsCached({ forceRefresh: true });
  assert.equal(pending.length, 2, 'Native loads are independent, with no pending-request deduplication');
  const [first, second] = pending.splice(0);
  const olderValue = [{ id: 'older' }]; const newerValue = [{ id: 'newer' }];
  async function finishOld() {
    fixture.setTime(200);
    if (rejectOld) first.reject(Error('old-failure')); else first.resolve(olderValue);
    await old;
  }
  async function finishNew() { fixture.setTime(300); second.resolve(newerValue); await newer; }
  if (reverse) { await finishNew(); await finishOld(); }
  else { await finishOld(); await finishNew(); }
  const expected = reverse && !rejectOld ? olderValue : newerValue;
  assert.strictEqual(await api.getNativeDisplayBoundsCached(), expected, 'Last successful completion still owns the cache');
  return { trace, old: await old, newer: await newer, cached: expected };
}

async function rootRun(original) {
  const trace = []; let now = 100; let sequence = 0; let fail = false;
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const electron = { app: { getPath: () => 'controlled-temp' }, BrowserWindow: { getAllWindows: () => [] },
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display }, desktopCapturer: {} };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', 'setTimeout', 'clearTimeout',
      file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'fs') return { writeFileSync() {}, unlink(file, callback) { callback(null); } };
      if (id === 'path') return path;
      if (id === 'child_process') return { execFile(command, args, options, callback) {
        trace.push(['native', ++sequence]);
        callback(fail ? Error('process-failure') : null,
          JSON.stringify([{ isPrimary: true, x: 0, y: 0, width: 1920, height: 1080 }]), '');
      } };
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'win32' }, { now: () => now }, () => 1, () => {});
    return module.exports;
  }
  const { createCaptureService } = load(rootFile);
  const first = createCaptureService(); const second = createCaptureService();
  const output = [Object.keys(first)];
  output.push(await first.getDisplayListWithNativeBounds(), await second.getDisplayListWithNativeBounds());
  assert.equal(sequence, 2, 'Caches belong to each service instance');
  now = 15100; output.push(await first.getDisplayListWithNativeBounds()); assert.equal(sequence, 2);
  now++; output.push(await first.getDisplayListWithNativeBounds()); assert.equal(sequence, 3);
  output.push(await first.getDisplayListWithNativeBounds({ forceRefresh: true })); assert.equal(sequence, 4);
  first.invalidateCaptureSourceCache(); fail = true;
  output.push(await first.getDisplayListWithNativeBounds()); assert.equal(sequence, 5);
  output.push(await first.getDisplayListWithNativeBounds()); assert.equal(sequence, 5, 'Empty native results are cached');
  assert.equal(output.at(-1)[0].nativeBoundsSource, 'electron-scale');
  first.dispose(); fail = false;
  output.push(await first.getDisplayListWithNativeBounds()); assert.equal(sequence, 6, 'Dispose invalidates the native cache');
  second.dispose(); return { output, trace };
}

function checkStructure() {
  const text = fs.readFileSync(cacheFile, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(cacheFile, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return factory.body.statements.filter(node => original
      ? !(ts.isFunctionDeclaration(node) && ['isNativeDisplayBoundsCacheFresh', 'invalidateNativeDisplayBoundsCache', 'getNativeDisplayBoundsCached'].includes(node.name.text))
        && !node.getText(ast).startsWith('let nativeDisplayBoundsCache =')
      : !node.getText(ast).startsWith('const { invalidateNativeDisplayBoundsCache, getNativeDisplayBoundsCached } ='))
      .map(node => node.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

async function main() {
  checkStructure();
  for (const start of [0, 100]) for (const elapsed of [-1, 0, 15000, 15001])
    for (const empty of [false, true]) for (const force of [false, true])
      for (const reset of [false, true]) for (const failure of [false, true]) {
        const actual = await runBoundary(start, elapsed, empty, force, reset, failure, false);
        if (baseline) assert.deepEqual(actual, await runBoundary(start, elapsed, empty, force, reset, failure, true));
        cases++;
      }
  for (const reset of [false, true]) for (const reverse of [false, true]) for (const rejectOld of [false, true]) {
    const actual = await runConcurrent(reset, reverse, rejectOld, false);
    if (baseline) assert.deepEqual(actual, await runConcurrent(reset, reverse, rejectOld, true));
    cases++;
  }
  const actual = await rootRun(false);
  if (baseline) assert.deepEqual(actual, await rootRun(true));
  cases++;
  console.log(`Capture native display cache passed: ${cases} boundary, concurrent and real-root controlled scenarios.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
