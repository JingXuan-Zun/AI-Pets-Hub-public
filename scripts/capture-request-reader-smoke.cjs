const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const helperFile = path.resolve(__dirname, '../electron/capture/requestReader.cjs');
const { createCaptureRequestReader } = require(helperFile);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;
function originalReader(deps, getRequests) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const fn = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'getCaptureSourceListWithOptions');
  return new Function('deps', 'requests', `const { ${Object.keys(deps).filter(key => key !== 'getRequests').join(',')} } = deps;
    let captureSourceRequestByKey = requests(); ${fn.getText(ast)}
    return { run: getCaptureSourceListWithOptions, reset: () => { captureSourceRequestByKey = requests(); } };`)(deps, getRequests);
}
function trackedMap(trace, generation) {
  const map = new Map();
  for (const name of ['has', 'get', 'set', 'delete']) {
    const method = map[name];
    map[name] = function(key, ...args) { assert.equal(this, map); trace.push([name, generation, key]); return method.call(this, key, ...args); };
  }
  return map;
}
function assemble(config, trace, original) {
  let requests = trackedMap(trace, 1);
  const cached = [{ id: 'cached' }]; const fetched = [{ id: 'fetched' }]; const pending = [{ id: 'pending' }];
  const queued = [];
  const deps = {
    normalizeCaptureSourceTypes(types) { trace.push(['normalize', types]); return types || ['screen', 'window']; },
    getCaptureSourceCacheKey(types) { trace.push(['key', types]); return types.join(','); },
    isCaptureSourceCacheFresh() { trace.push(['fresh']); return config.fresh; },
    hasCaptureSourceCacheEntries() { trace.push(['entries']); return config.entries; },
    hasCaptureSourceCacheThumbnails() { trace.push(['thumbnails']); return config.thumbnails; },
    getCachedCaptureSources() { trace.push(['cached']); return cached; },
    fetchCaptureSourceList(types, options) {
      trace.push(['fetch', types, options]);
      if (config.mode === 'throw') throw Error('fetch');
      if (config.mode === 'reject') return Promise.reject(Error('fetch'));
      if (config.mode === 'deferred') return new Promise(resolve => queued.push(resolve));
      return Promise.resolve(fetched);
    },
    primeCaptureSourceCache(types, sources) { trace.push(['prime', types, sources]); },
    getRequests: () => requests,
  };
  const api = original ? originalReader(deps, () => requests) : { run: createCaptureRequestReader(deps) };
  return { api, cached, fetched, pending, queued, deps, get requests() { return requests; },
    reset() { requests = trackedMap(trace, 2); api.reset?.(); } };
}
async function run(config, types, sourceId, existing, original, getters = false) {
  const trace = [];
  const fixture = assemble(config, trace, original);
  const key = `${types.join(',')}|thumb:${config.include ? '1' : '0'}|source:${sourceId}`;
  if (existing) Map.prototype.set.call(fixture.requests, key, Promise.resolve(fixture.pending));
  const options = { forceRefresh: config.force, preferCached: config.prefer, captureSourceTypes: types,
    includeCaptureThumbnails: config.include, sourceId };
  if (getters) for (const [name, value] of Object.entries(options)) Object.defineProperty(options, name, {
    get() { trace.push(['option', name]); return value; },
  });
  let result;
  try {
    const value = await fixture.api.run(options);
    result = value === fixture.cached ? 'cached' : value === fixture.fetched ? 'fetched' : value === fixture.pending ? 'pending' : value;
  } catch (error) { result = { error: error.message }; }
  return { result, trace, requests: [...fixture.requests.keys()] };
}
async function race(reset, original) {
  const trace = [];
  const f = assemble({ mode: 'deferred', fresh: false, entries: false }, trace, original);
  const options = { captureSourceTypes: ['screen'] };
  const first = f.api.run(options);
  if (reset) f.reset();
  const second = f.api.run({ ...options, forceRefresh: true });
  assert.equal(f.queued.length, reset ? 2 : 1);
  f.queued.shift()([{ id: 'first' }]);
  const firstValue = await first;
  if (reset) f.queued.shift()([{ id: 'second' }]);
  const secondValue = await second;
  assert.equal(firstValue === secondValue, !reset);
  return { firstValue, secondValue, trace, requests: [...f.requests.keys()] };
}
async function main() {
  for (let bits = 0; bits < 64; bits++) {
    const config = { force: Boolean(bits & 1), prefer: Boolean(bits & 2), fresh: Boolean(bits & 4),
      entries: Boolean(bits & 8), thumbnails: Boolean(bits & 16), include: Boolean(bits & 32) };
    for (const types of [['screen'], ['window'], ['screen', 'window']]) for (const sourceId of ['', 'window:1', null]) {
      for (const mode of ['normal', 'throw', 'reject']) for (const existing of [false, true]) {
        const actual = await run({ ...config, mode }, types, sourceId, existing, false);
        if (baseline) assert.deepEqual(actual, await run({ ...config, mode }, types, sourceId, existing, true));
        if (actual.trace.some(event => event[0] === 'fetch') && mode !== 'throw') assert.ok(!actual.requests.length, 'Settled request cleans up');
        cases++;
      }
    }
  }
  const getterConfig = { fresh: false, entries: false, mode: 'normal' };
  const getter = await run(getterConfig, ['screen'], '', false, false, true);
  if (baseline) assert.deepEqual(getter, await run(getterConfig, ['screen'], '', false, true, true));
  assert.deepEqual(getter.trace.filter(event => event[0] === 'option').map(event => event[1]),
    ['forceRefresh', 'preferCached', 'captureSourceTypes', 'includeCaptureThumbnails', 'sourceId']);
  cases++;
  for (const reset of [false, true]) {
    const actual = await race(reset, false);
    if (baseline) assert.deepEqual(actual, await race(reset, true));
    cases++;
  }
  const text = fs.readFileSync(helperFile, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(helperFile, text, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isFunctionDeclaration)) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
  console.log(`Capture request reader passed: ${cases} branches/order/races; cache priority, pending reuse, scoped sources, errors, cleanup and dynamic Map replacement.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
