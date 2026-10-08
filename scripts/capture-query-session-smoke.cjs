const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const file = path.resolve(__dirname, '../electron/capture/querySession.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const factories = [
  ['queryAssembly', 'createCaptureQueryAssembly', ['normalizeCaptureSourceTypes', 'isCaptureSourceCacheFresh', 'getCaptureSourceListWithOptions', 'getAreaPickerScreenSources', 'invalidateAreaPickerScreenSourceCache']],
  ['environmentAssembly', 'createCaptureEnvironmentAssembly', ['getDisplayEnvironment', 'broadcastDisplayEnvironment', 'scheduleDisplayEnvironmentBroadcast', 'scheduleCaptureSourceRefreshBroadcast', 'setSettingsWindowProvider', 'dispose']],
  ['areaPickerContext', 'createAreaPickerContextBuilder', null],
];
const returned = ['getCaptureSourceList', 'getCaptureSourceListWithOptions', 'getAreaPickerScreenSources', 'invalidateAreaPickerScreenSourceCache',
  ...factories[1][2], 'buildAreaPickerContext'];
function moved(n, ast) { return ts.isFunctionDeclaration(n) && n.name.text === 'getCaptureSourceList' || ts.isVariableStatement(n) && factories.some(([, name]) => n.getText(ast).includes('= ' + name + '(')); }
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const nodes = root.body.statements.filter(n => moved(n, ast)); assert.equal(nodes.length, 4);
  oldFactory = deps => new Function('dependencies', 'const { ' + Object.keys(deps).join(',') + ' } = dependencies;\n' + nodes.map(n => n.getText(ast)).join('\n') + '\nreturn { ' + returned.join(',') + ' };')(deps);
}
async function run(failure, mode, original) {
  const trace = [], labels = new WeakMap(), imports = {}, created = new Map(), pending = [];
  const dependencies = { CAPTURE_SOURCE_CACHE_TTL_MS: 300000, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS: 15000, DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS: 120, CAPTURE_SOURCE_REFRESH_DELAY_MS: 420 };
  function tagged(name, value) { labels.set(value, name); return value; }
  function callable(name) { return tagged(name, () => { throw Error('Unexpected eager call: ' + name); }); }
  for (const key of ['CAPTURE_SOURCE_TYPES', 'CAPTURE_SOURCE_THUMBNAIL_SIZE', 'desktopCapturer', 'CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE', 'AREA_PICKER_PREVIEW_THUMBNAIL_SIZE', 'CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE', 'CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE', 'CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE', 'BrowserWindow', 'console', 'screen']) dependencies[key] = tagged(key, {});
  for (const key of ['getCache', 'getRequests', 'getDisplayList', 'getDisplayListWithNativeBounds', 'getNativeWindowCaptureSources', 'getNativeScreenPreviewMap', 'getSettingsWindow', 'clearTimeout', 'setTimeout', 'invalidateCaptureSourceCache', 'getVirtualDisplayBounds', 'getAreaPickerThumbnailSize']) dependencies[key] = callable(key);
  function normalize(value) {
    if (value && labels.has(value)) return labels.get(value);
    if (typeof value === 'function') return '[function:' + value.name + ']';
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
    return value;
  }
  for (const [moduleName, name, fields] of factories) {
    const factory = options => {
      trace.push([name, normalize(options)]);
      if (failure === name) throw Error(failure);
      const output = fields ? Object.fromEntries(fields.map(field => [field, callable(name + ':' + field)])) : callable(name);
      if (moduleName === 'queryAssembly') output.getCaptureSourceListWithOptions = tagged('getCaptureSourceListWithOptions', options => {
        trace.push(['read', normalize(options)]);
        if (mode === 'throw') throw Error('read-throw');
        const state = { options };
        state.promise = new Promise((resolve, reject) => { state.resolve = resolve; state.reject = reject; }); pending.push(state); return state.promise;
      });
      created.set(name, output); return output;
    };
    dependencies[name] = factory; imports['./' + moduleName + '.cjs'] = { [name]: factory };
  }
  const module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(file, 'utf8'))(id => { assert.ok(imports[id]); return imports[id]; }, module);
  const create = original ? oldFactory : module.exports.createCaptureQuerySession;
  const live = [], outputs = [];
  for (let i = 0; i < 2; i++) {
    try {
      const value = create(dependencies); live.push(value); assert.deepEqual(Object.keys(value), returned);
      const query = created.get(factories[0][1]), environment = created.get(factories[1][1]);
      for (const key of returned.slice(1, 4)) assert.strictEqual(value[key], query[key]);
      for (const key of factories[1][2]) assert.strictEqual(value[key], environment[key]);
      assert.strictEqual(value.buildAreaPickerContext, created.get(factories[2][1])); outputs.push(normalize(value));
    } catch (error) { assert.equal(error.message, failure); outputs.push({ error: error.message }); }
  }
  const expected = factories.slice(0, failure ? factories.findIndex(([, name]) => name === failure) + 1 : factories.length).map(([, name]) => name);
  assert.deepEqual(trace.map(row => row[0]), [...expected, ...expected]);
  if (!failure) {
    for (const key of returned) assert.notStrictEqual(live[0][key], live[1][key]);
    for (const api of live) for (const options of [undefined, { sourceId: 'window:1', forceRefresh: true }]) {
      const promise = api.getCaptureSourceList(options); assert.ok(promise instanceof Promise);
      let settled = false;
      const outcome = promise.then(value => { settled = true; return { value }; }, error => { settled = true; return { error: error.message }; });
      if (mode !== 'throw') {
        const state = pending.at(-1);
        if (options) assert.strictEqual(state.options, options); else assert.deepEqual(state.options, {});
        assert.notStrictEqual(promise, state.promise, 'Existing async API retains promise adoption');
        await Promise.resolve(); assert.equal(settled, false);
        const sources = [{ id: 'screen:1' }];
        if (mode === 'reject') state.reject(Error('read-reject')); else state.resolve(sources);
        const result = await outcome;
        if (mode === 'reject') assert.equal(result.error, 'read-reject'); else assert.strictEqual(result.value, sources);
      } else assert.equal((await outcome).error, 'read-throw');
    }
  }
  return { trace, outputs };
}
function structure() {
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original ? !moved(n, ast) : !(ts.isVariableStatement(n) && n.getText(ast).includes('= createCaptureQuerySession('))).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}
async function main() {
  structure(); let cases = 0;
  for (const failure of factories.map(([, name]) => name)) { const actual = await run(failure, '', false); if (baseline) assert.deepEqual(actual, await run(failure, '', true)); cases++; }
  for (const mode of ['resolve', 'reject', 'throw']) { const actual = await run('', mode, false); if (baseline) assert.deepEqual(actual, await run('', mode, true)); cases++; }
  console.log('Capture query session passed: ' + cases + ' two-instance wiring/identity/failure/deferred/async adoption scenarios.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
