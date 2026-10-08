const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const sessionFile = path.resolve(__dirname, '../electron/capture/displaySession.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['getFullDisplayBounds', 'getDisplayList', 'getDisplayListWithNativeBounds'];
const factories = ['createCaptureActivityRegion', 'createCaptureNativeDisplayAssembly'];
const returned = ['clampAreaScale', 'getTargetDisplay', 'updateActivityRegion', ...names,
  'getAreaPickerThumbnailSize', 'getVirtualWorkAreaBounds', 'getVirtualDisplayBounds', 'runTemporaryPowerShellScript',
  'getNativeWindowCaptureSources', 'getNativeScreenPreviewMap', 'invalidateNativeDisplayBoundsCache'];
function moved(n, ast) { return ts.isFunctionDeclaration(n) && names.includes(n.name.text) || ts.isVariableStatement(n) && factories.some(name => n.getText(ast).includes('= ' + name + '(')); }
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const nodes = root.body.statements.filter(n => moved(n, ast)); assert.equal(nodes.length, 5);
  oldFactory = deps => new Function('dependencies', 'const { ' + Object.keys(deps).join(',') + ' } = dependencies;\n' + nodes.map(n => n.getText(ast)).join('\n') + '\nreturn { ' + returned.join(',') + ' };')(deps);
}
async function run(constructionFailure, readFailure, nativeEmpty, original) {
  const trace = [], labels = new WeakMap(), native = [], activities = [];
  function tagged(key, value) { labels.set(value, key); return value; }
  const deps = { AREA_PICKER_MAX_PREVIEW_WIDTH: 5120, AREA_PICKER_MAX_PREVIEW_HEIGHT: 2880, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS: 15000 };
  for (const key of ['app', 'BrowserWindow', 'screen', 'execFile', 'fs', 'path', 'process', 'buildFilteredWindowCaptureSources', 'normalizeCaptureSourceTitle', 'getNativeDisplayBoundsPowerShellScript', 'getNativeScreenPreviewPowerShellScript', 'getNativeWindowCaptureSourcesPowerShellScript']) deps[key] = tagged(key, {});
  function normalize(value) {
    if (value && labels.has(value)) return labels.get(value);
    if (typeof value === 'function') return '[function:' + value.name + ']';
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
    return value;
  }
  deps.createCaptureActivityRegion = options => {
    trace.push(['activity', normalize(options)]);
    if (constructionFailure === 'activity') throw Error('activity');
    const value = Object.fromEntries(returned.slice(0, 3).map(key => [key, tagged(key, () => { throw Error('Unexpected eager call'); })])); activities.push(value); return value;
  };
  deps.createCaptureNativeDisplayAssembly = options => {
    trace.push(['native', normalize(options)]);
    if (constructionFailure === 'native') throw Error('native');
    const value = Object.fromEntries(returned.slice(6).map(key => [key, tagged(key, () => { throw Error('Unexpected eager call'); })]));
    const state = { pending: null, options, value };
    value.createDisplayList = data => { trace.push(['project', data]); if (readFailure === 'project') throw Error('project'); return data || []; };
    value.getNativeDisplayBoundsCached = options => {
      trace.push(['cache', options.forceRefresh]);
      if (readFailure === 'cache-throw') throw Error('cache-throw');
      return new Promise((resolve, reject) => { state.pending = { resolve, reject }; });
    };
    native.push(state); return value;
  };
  const module = { exports: {} };
  const imports = { './activityRegion.cjs': { createCaptureActivityRegion: deps.createCaptureActivityRegion }, './nativeDisplayAssembly.cjs': { createCaptureNativeDisplayAssembly: deps.createCaptureNativeDisplayAssembly } };
  new Function('require', 'module', fs.readFileSync(sessionFile, 'utf8'))(id => { assert.ok(imports[id]); return imports[id]; }, module);
  const create = original ? oldFactory : module.exports.createCaptureDisplaySession;
  const live = [], errors = [];
  for (let i = 0; i < 2; i++) {
    try { live.push(create(deps)); } catch (error) { assert.equal(error.message, constructionFailure); errors.push(error.message); }
  }
  const stages = constructionFailure === 'activity' ? ['activity'] : ['activity', 'native'];
  assert.deepEqual(trace.map(entry => entry[0]), [...stages, ...stages]);
  if (!constructionFailure) {
    for (const key of returned) assert.notStrictEqual(live[0][key], live[1][key]);
    for (let i = 0; i < 2; i++) {
      const api = live[i]; assert.deepEqual(Object.keys(api), returned);
      for (const key of returned.slice(0, 3)) assert.strictEqual(api[key], activities[i][key]);
      for (const key of returned.slice(6)) assert.strictEqual(api[key], native[i].value[key]);
      assert.strictEqual(native[i].options.getFullDisplayBounds, api.getFullDisplayBounds);
      assert.strictEqual(native[i].options.getTargetDisplay, api.getTargetDisplay);
      for (const bounds of [{ width: 1 }, null, 0, false, undefined]) {
        const fallback = {}, reads = [];
        const display = { get bounds() { reads.push('bounds'); return bounds; }, get workArea() { reads.push('workArea'); return fallback; } };
        assert.strictEqual(api.getFullDisplayBounds(display), bounds || fallback);
        assert.deepEqual(reads, bounds ? ['bounds'] : ['bounds', 'workArea']);
      }
      try { assert.deepEqual(api.getDisplayList(), []); } catch (error) { assert.equal(error.message, readFailure); errors.push(error.message); }
      const options = { get forceRefresh() { trace.push(['force', i]); return i === 0; } };
      const before = trace.filter(row => row[0] === 'project').length;
      const promise = api.getDisplayListWithNativeBounds(options);
      const outcome = promise.then(value => ({ value }), error => ({ error: error.message }));
      assert.equal(trace.filter(row => row[0] === 'project').length, before, 'Projection waits for native completion');
      const displays = nativeEmpty ? [] : [{ id: i + 1 }];
      if (readFailure !== 'cache-throw') {
        assert.ok(native[i].pending);
        if (readFailure === 'cache-reject') native[i].pending.reject(Error('cache-reject'));
        else native[i].pending.resolve(displays);
      }
      const result = await outcome;
      if (readFailure) { assert.equal(result.error, readFailure); errors.push(result.error); }
      else { assert.strictEqual(result.value, displays); }
    }
  }
  return { trace, errors };
}
function structure() {
  if (!baseline) return;
  function retained(text, original) {
    const ast = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original ? !moved(n, ast) : !(ts.isVariableStatement(n) && n.getText(ast).includes('= createCaptureDisplaySession('))).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}
async function main() {
  structure(); let cases = 0;
  for (const failure of ['activity', 'native']) { const actual = await run(failure, '', false, false); if (baseline) assert.deepEqual(actual, await run(failure, '', false, true)); cases++; }
  for (const failure of ['', 'project', 'cache-throw', 'cache-reject']) for (const empty of [false, true]) {
    const actual = await run('', failure, empty, false); if (baseline) assert.deepEqual(actual, await run('', failure, empty, true)); cases++;
  }
  console.log('Capture display session passed: ' + cases + ' two-instance construction/identity/bounds/deferred/error scenarios.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
