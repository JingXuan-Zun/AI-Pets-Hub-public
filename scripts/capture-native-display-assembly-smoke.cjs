const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../electron/capture/nativeDisplayAssembly.cjs');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const factories = [
  ['displayProjection', 'createCaptureDisplayProjection', null],
  ['areaGeometry', 'createCaptureAreaGeometry', ['getAreaPickerThumbnailSize', 'getVirtualWorkAreaBounds', 'getVirtualDisplayBounds']],
  ['windowTitles', 'createOwnCaptureWindowTitleReader', null],
  ['powerShellRunner', 'createCapturePowerShellRunner', null],
  ['nativeReaders', 'createCaptureNativeReaders', ['getNativeDisplayBounds', 'getNativeWindowCaptureSources', 'getNativeScreenPreviewMap']],
  ['nativeDisplayCache', 'createNativeDisplayCache', ['invalidateNativeDisplayBoundsCache', 'getNativeDisplayBoundsCached']],
];
const returned = ['createDisplayList', 'getAreaPickerThumbnailSize', 'getVirtualWorkAreaBounds', 'getVirtualDisplayBounds',
  'runTemporaryPowerShellScript', 'getNativeWindowCaptureSources', 'getNativeScreenPreviewMap', 'getNativeDisplayBoundsCached', 'invalidateNativeDisplayBoundsCache'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const nodes = root.body.statements.filter(n => ts.isVariableStatement(n) && factories.some(([, name]) => n.getText(ast).includes('= ' + name + '(')));
  oldFactory = dependencies => new Function('dependencies', `const { ${Object.keys(dependencies).join(',')} } = dependencies;
    ${nodes.map(n => n.getText(ast)).join('\n')}\nreturn { ${returned.join(',')} };`)(dependencies);
}

function run(failure, original) {
  const trace = [], labels = new WeakMap(), imports = {}, created = new Map();
  const dependencies = { AREA_PICKER_MAX_PREVIEW_WIDTH: 5120, AREA_PICKER_MAX_PREVIEW_HEIGHT: 2880, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS: 15000 };
  for (const key of ['app', 'BrowserWindow', 'screen', 'fs', 'path', 'process']) { dependencies[key] = {}; labels.set(dependencies[key], key); }
  function callable(label) {
    const value = () => { throw Error('Unexpected eager execution: ' + label); };
    labels.set(value, label); return value;
  }
  for (const key of ['execFile', 'getFullDisplayBounds', 'getTargetDisplay', 'buildFilteredWindowCaptureSources', 'normalizeCaptureSourceTitle',
    'getNativeDisplayBoundsPowerShellScript', 'getNativeScreenPreviewPowerShellScript', 'getNativeWindowCaptureSourcesPowerShellScript']) dependencies[key] = callable(key);
  for (const helper of ['nativeResults', 'displayGeometry']) {
    imports['./' + helper + '.cjs'] = require('../electron/capture/' + helper + '.cjs');
    Object.assign(dependencies, imports['./' + helper + '.cjs']);
    for (const [name, value] of Object.entries(imports['./' + helper + '.cjs'])) labels.set(value, name);
  }
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
  const create = original ? oldFactory : module.exports.createCaptureNativeDisplayAssembly;
  const outputs = [], live = [];
  for (let i = 0; i < 2; i++) {
    try {
      const value = create(dependencies); live.push(value); outputs.push(normalize(value));
      assert.deepEqual(Object.keys(value), returned);
      assert.strictEqual(value.createDisplayList, created.get('createCaptureDisplayProjection'));
      assert.strictEqual(value.runTemporaryPowerShellScript, created.get('createCapturePowerShellRunner'));
      assert.strictEqual(value.getNativeDisplayBoundsCached, created.get('createNativeDisplayCache').getNativeDisplayBoundsCached);
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
      : !n.getText(ast).startsWith('const { createDisplayList, getAreaPickerThumbnailSize, getVirtualWorkAreaBounds, getVirtualDisplayBounds,')).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

structure(); let cases = 0;
for (const failure of ['', ...factories.map(([, name]) => name)]) {
  const actual = run(failure, false); if (baseline) assert.deepEqual(actual, run(failure, true)); cases++;
}
console.log(`Capture native/display assembly passed: ${cases} two-instance order/dependency/failure/identity scenarios, no eager effects.`);
