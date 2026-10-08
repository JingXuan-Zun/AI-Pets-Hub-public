const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cacheFile = path.resolve(__dirname, '../electron/capture/sourceCache.cjs');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['normalizeCaptureSourceTypes', 'getCaptureSourceCacheKey', 'getCaptureSourceCacheEntry', 'getCachedCaptureSources',
  'isCaptureSourceCacheFresh', 'hasCaptureSourceCacheEntries', 'hasCaptureSourceCacheThumbnails', 'primeCaptureSourceCache'];
let cases = 0;
function oldDeclarations() {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  return names.map(name => factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
}
function run(types, sourceKind, clock, reset, original) {
  let now = 100;
  let cache = new Map();
  const typesConstant = ['screen', 'window'];
  const sources = sourceKind === 'empty' ? [] : sourceKind === 'null-entry' ? [null]
    : [{ id: 'screen:1', type: 'screen', thumbnail: sourceKind === 'missing-thumbnail' ? '' : 'screen:data' },
      { id: 'window:1', type: 'window', thumbnail: 'window:data' }];
  const module = { exports: {} };
  new Function('module', 'Date', fs.readFileSync(cacheFile, 'utf8'))(module, { now: () => now });
  const api = original ? new Function('Date', 'CAPTURE_SOURCE_TYPES', 'CAPTURE_SOURCE_CACHE_TTL_MS', 'state',
    'let captureSourceCacheByKey = state.get();\n' + oldDeclarations()
    + '\nreturn {' + names.join(',') + ', reset: value => { captureSourceCacheByKey = value; }};')({ now: () => now }, typesConstant, 300000, { get: () => cache })
    : module.exports.createCaptureSourceCache({ getCache: () => cache, CAPTURE_SOURCE_TYPES: typesConstant, CAPTURE_SOURCE_CACHE_TTL_MS: 300000 });
  const normalized = api.normalizeCaptureSourceTypes(types);
  const key = api.getCaptureSourceCacheKey(types);
  let primeError;
  try { api.primeCaptureSourceCache(types, sources); } catch (error) { primeError = error.message; }
  const stored = [...cache];
  if (reset) { cache = new Map(); if (original) api.reset(cache); }
  now = clock;
  const reads = [];
  for (const query of [types, ['screen'], ['window'], undefined]) {
    try {
      const value = api.getCachedCaptureSources(query);
      reads.push({ value, same: value === sources, fresh: api.isCaptureSourceCacheFresh(query),
        entries: api.hasCaptureSourceCacheEntries(query), thumbnails: api.hasCaptureSourceCacheThumbnails(query) });
    } catch (error) { reads.push({ error: error.message }); }
  }
  if (sourceKind === 'normal' && !reset) {
    assert.equal(reads[0].same, true);
    assert.equal(reads[0].fresh, clock - 100 <= 300000);
  }
  if (reset) assert.ok(reads.every(value => !value.entries && !value.fresh));
  return { normalized, key, primeError, stored, reads };
}
async function rootRun(original) {
  const trace = [];
  const pendingCaptures = [];
  let now = 100;
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const electron = { app: {}, BrowserWindow: {},
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    desktopCapturer: { getSources(options) { trace.push(['capture', options]); return new Promise(resolve => pendingCaptures.push(resolve)); } },
  };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'child_process') return { execFile() { throw Error('Unexpected native call'); } };
      if (id === 'fs') return {};
      if (id === 'path') return path;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'linux' }, { now: () => now });
    return module.exports;
  }
  const { createCaptureService } = load(rootFile);
  const first = createCaptureService(); const second = createCaptureService();
  const request = { captureSourceTypes: ['screen'] };
  const promises = [first.getCaptureSourceListWithOptions(request), first.getCaptureSourceListWithOptions(request),
    first.getCaptureSourceListWithOptions({ ...request, forceRefresh: true }), second.getCaptureSourceListWithOptions(request)];
  assert.equal(pendingCaptures.length, 2, 'Requests deduplicate per service, including forced pending requests');
  function release() {
    while (pendingCaptures.length) pendingCaptures.shift()([{ id: 'screen:1', name: 'Primary', display_id: '1',
      thumbnail: { isEmpty: () => false, getSize: () => ({ width: 240, height: 135 }), toDataURL: () => 'image:data' } }]);
  }
  release(); const values = await Promise.all(promises);
  assert.equal(values[0], values[1]); assert.equal(values[0], values[2]); assert.notEqual(values[0], values[3]);
  assert.equal(await first.getCaptureSourceListWithOptions(request), values[0]);
  now = 300101; // One millisecond beyond the original TTL.
  assert.equal(await first.getCaptureSourceListWithOptions({ ...request, preferCached: true }), values[0]);
  const expired = first.getCaptureSourceListWithOptions(request);
  assert.equal(pendingCaptures.length, 1); release(); const refreshed = await expired;
  assert.notEqual(refreshed, values[0]);
  first.invalidateCaptureSourceCache();
  const invalidated = first.getCaptureSourceListWithOptions(request);
  assert.equal(pendingCaptures.length, 1); release(); const invalidatedValue = await invalidated;
  assert.notEqual(invalidatedValue, refreshed);
  first.dispose(); second.dispose();
  return { values, refreshed, invalidatedValue, trace };
}
async function main() {
  for (const types of [undefined, null, [], ['screen'], ['window'], ['window', 'screen'], ['screen', 'screen'], ['unknown'], 'screen']) {
    for (const sourceKind of ['normal', 'empty', 'missing-thumbnail', 'null-entry']) {
      for (const clock of [-1, 0, 100, 300100, 300101]) for (const reset of [false, true]) {
        const actual = run(types, sourceKind, clock, reset, false);
        if (baseline) assert.deepEqual(actual, run(types, sourceKind, clock, reset, true));
        cases++;
      }
    }
  }
  const actual = await rootRun(false);
  if (baseline) assert.deepEqual(actual, await rootRun(true));
  cases++;
  const text = fs.readFileSync(cacheFile, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(cacheFile, text, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isFunctionDeclaration)) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
  console.log(`Capture source cache passed: ${cases} policy/root scenarios; type keys, TTL boundaries, partial writes, array identity, dynamic reset and concurrent service isolation.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
