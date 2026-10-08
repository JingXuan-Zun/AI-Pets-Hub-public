const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../electron/capture/queryAssembly.cjs');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const factories = [
  ['sourceCache', 'createCaptureSourceCache', ['normalizeCaptureSourceTypes', 'getCaptureSourceCacheKey', 'getCachedCaptureSources', 'isCaptureSourceCacheFresh', 'hasCaptureSourceCacheEntries', 'hasCaptureSourceCacheThumbnails', 'primeCaptureSourceCache']],
  ['sourceMapper', 'createCaptureSourceMapper', null],
  ['screenQueries', 'createCaptureScreenQueries', ['fetchScreenCaptureSourceListLite', 'fetchAreaPickerScreenSourceList']],
  ['sourceQuery', 'createCaptureSourceQuery', null],
  ['requestReader', 'createCaptureRequestReader', null],
  ['areaPickerSources', 'createAreaPickerScreenSources', ['getAreaPickerScreenSources', 'invalidateAreaPickerScreenSourceCache']],
];
const returned = ['normalizeCaptureSourceTypes', 'isCaptureSourceCacheFresh', 'getCaptureSourceListWithOptions', 'getAreaPickerScreenSources', 'invalidateAreaPickerScreenSourceCache'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const nodes = root.body.statements.filter(n => ts.isVariableStatement(n) && factories.some(([, name]) => n.getText(ast).includes('= ' + name + '(')));
  oldFactory = dependencies => new Function('dependencies', `const { ${Object.keys(dependencies).join(',')} } = dependencies;
    ${nodes.map(n => n.getText(ast).replace('getCache: () => captureSourceCacheByKey', 'getCache').replace('getRequests: () => captureSourceRequestByKey', 'getRequests')).join('\n')}\nreturn { ${returned.join(',')} };`)(dependencies);
}

function run(failure, original) {
  const trace = [], labels = new WeakMap(), imports = {}, created = new Map();
  const dependencies = { CAPTURE_SOURCE_CACHE_TTL_MS: 300000, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS: 15000 };
  function callable(label) {
    const value = () => { throw Error('Unexpected eager execution: ' + label); };
    labels.set(value, label); return value;
  }
  for (const key of ['CAPTURE_SOURCE_TYPES', 'CAPTURE_SOURCE_THUMBNAIL_SIZE', 'desktopCapturer',
    'CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE', 'AREA_PICKER_PREVIEW_THUMBNAIL_SIZE', 'CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE',
    'CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE', 'CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE']) {
    dependencies[key] = {}; labels.set(dependencies[key], key);
  }
  for (const key of ['getCache', 'getRequests', 'getDisplayList', 'getDisplayListWithNativeBounds',
    'getNativeWindowCaptureSources', 'getNativeScreenPreviewMap']) dependencies[key] = callable(key);
  function normalize(value) {
    if (value && (typeof value === 'function' || typeof value === 'object') && labels.has(value)) return labels.get(value);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
    return value;
  }
  for (const [moduleName, name, fields] of factories) {
    const factory = options => {
      trace.push([name, normalize(options)]);
      if (name === failure) throw Error(failure);
      const output = fields ? Object.fromEntries(fields.map(field => [field, callable(name + ':' + field)])) : callable(name);
      created.set(name, output); return output;
    };
    imports['./' + moduleName + '.cjs'] = { [name]: factory }; dependencies[name] = factory;
  }
  const module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(file, 'utf8'))(id => { assert.ok(imports[id], id); return imports[id]; }, module);
  const create = original ? oldFactory : module.exports.createCaptureQueryAssembly;
  const outputs = [], live = [];
  for (let i = 0; i < 2; i++) {
    try {
      const value = create(dependencies); live.push(value); outputs.push(normalize(value));
      assert.deepEqual(Object.keys(value), returned);
      assert.strictEqual(value.normalizeCaptureSourceTypes, created.get('createCaptureSourceCache').normalizeCaptureSourceTypes);
      assert.strictEqual(value.isCaptureSourceCacheFresh, created.get('createCaptureSourceCache').isCaptureSourceCacheFresh);
      assert.strictEqual(value.getCaptureSourceListWithOptions, created.get('createCaptureRequestReader'));
      assert.strictEqual(value.getAreaPickerScreenSources, created.get('createAreaPickerScreenSources').getAreaPickerScreenSources);
      assert.strictEqual(value.invalidateAreaPickerScreenSourceCache, created.get('createAreaPickerScreenSources').invalidateAreaPickerScreenSourceCache);
    } catch (error) { if (error.message !== failure) throw error; outputs.push({ error: error.message }); }
  }
  if (!failure) for (const key of returned) assert.notStrictEqual(live[0][key], live[1][key]);
  const expected = factories.slice(0, failure ? factories.findIndex(([, name]) => name === failure) + 1 : factories.length).map(([, name]) => name);
  assert.deepEqual(trace.map(x => x[0]), [...expected, ...expected]);
  return { trace, outputs };
}

function structure() {
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original
      ? !(ts.isVariableStatement(n) && factories.some(([, name]) => n.getText(ast).includes('= ' + name + '(')))
      : !(ts.isVariableStatement(n) && n.getText(ast).includes('= createCaptureQueryAssembly('))).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

structure(); let cases = 0;
for (const failure of ['', ...factories.map(([, name]) => name)]) {
  const actual = run(failure, false); if (baseline) assert.deepEqual(actual, run(failure, true)); cases++;
}
console.log(`Capture cache/query assembly passed: ${cases} two-instance order/dependency/failure/identity scenarios, no eager effects.`);
