const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../electron/capture/displayGeometry.cjs');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const current = require(file);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = Object.keys(current);
let before;
let cases = 0;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declarations = names.map(name => factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name));
  before = new Function(declarations.map(n => n.getText(ast)).join('\n') + '\nreturn {' + names.join(',') + '};')();
  const after = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const newRoot = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  const newFactory = newRoot.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  assert.deepEqual(newFactory.body.statements.map(n => n.getText(newRoot)),
    factory.body.statements.filter(n => !ts.isFunctionDeclaration(n) || !names.includes(n.name.text)).map(n => n.getText(ast)));
  for (const node of declarations) {
    assert.equal(after.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === node.name.text).getText(after), node.getText(ast));
  }
}
function check(operation) {
  const actual = operation(current);
  if (before) assert.deepEqual(actual, operation(before));
  cases++;
  return actual;
}
const scales = [undefined, null, 0, -1, NaN, Infinity, '1.5', 0.5, 1, 1.25, 1.5, 2, 3];
for (const scaleFactor of scales) {
  assert.equal(check(api => api.getDisplayScaleFactor({ scaleFactor })),
    typeof scaleFactor === 'number' && Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1);
  for (const x of [-2560.5, -0.5, 0, 1920.25]) {
    for (const width of [0, 0.25, 1, 1919.8]) {
      const bounds = { x, y: -1080.5, width, height: 0.25 };
      check(api => api.createFallbackNativeDisplayBounds(bounds, api.getDisplayScaleFactor({ scaleFactor })));
    }
  }
}
check(api => api.getDisplayScaleFactor(null));
check(api => api.getDisplayScaleFactor(undefined));
for (const scaleFactor of scales) {
  for (const primary of [true, false]) {
    for (const x of [-2560, 0, 1920]) {
      const display = { x, y: -20, width: 1920, height: 1080, scaleFactor, isPrimary: primary };
      const candidates = [
        { x, y: -20, width: 1920, height: 1080, isPrimary: primary },
        { x: x * 2, y: -40, width: 3840, height: 2160, isPrimary: primary },
        { x, y: -20, width: 1920, height: 1080, isPrimary: !primary },
        { x: 999, y: 999, width: 1, height: 1, isPrimary: primary },
      ];
      for (const native of candidates) check(api => api.getNativeDisplayMatchScore(display, native));
      for (const used of [[], [0], [0, 1], [0, 1, 2, 3]]) {
        const result = check(api => {
          const taken = new Set(used);
          const selected = api.resolveNativeDisplayBounds(display, candidates, taken);
          return { index: candidates.indexOf(selected), used: [...taken] };
        });
        if (!used.length) assert.equal(result.index, 0, 'Equal scores retain first match');
        if (used.length === candidates.length) assert.equal(result.index, -1);
      }
    }
  }
}
for (const nativeDisplays of [null, undefined, [], {}, 'invalid']) {
  assert.equal(check(api => api.resolveNativeDisplayBounds({}, nativeDisplays, new Set())), null);
}
for (const context of [null, undefined, {}, { virtualBounds: null },
  { virtualBounds: { x: -1920, y: 0, width: 3840, height: 1080 } },
  { virtualBounds: { x: 0, y: 0, width: 0, height: 0 }, displays: [] },
  { virtualBounds: { x: 0, y: 0, width: 1, height: 1 }, displays: [
    { id: 'left', sourceId: 'screen:2', x: -1920, y: 0, width: 1920, height: 1080 },
    { id: 'right', sourceId: 'screen:1', x: 0, y: 0, width: 1920, height: 1080 },
  ] },
]) check(api => api.getAreaPickerContextSignature(context));
for (const failAt of [0, 1, 2, 3, 4]) {
  check(api => {
    const trace = [];
    let reads = 0;
    const display = { get scaleFactor() {
      trace.push('scale'); if (++reads === failAt) throw Error('scale getter'); return 1.5;
    } };
    try { return { value: api.getDisplayScaleFactor(display), trace }; }
    catch (error) { return { error: error.message, trace }; }
  });
}

function loadService(displays, original) {
  const trace = [];
  const screen = {
    getAllDisplays() { trace.push('all'); return displays; },
    getPrimaryDisplay() { trace.push('primary'); return displays[0]; },
  };
  const entryModule = { exports: {} };
  new Function('require', 'module', 'exports', original ? baseline : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id === 'electron') return { screen, app: {}, BrowserWindow: {}, desktopCapturer: {} };
    if (id === 'child_process') return { execFile() { throw Error('Unexpected native process'); } };
    if (id === 'fs') return {};
    if (id === 'path') return path;
    assert.ok(id.startsWith('./'));
    return require(path.resolve(path.dirname(rootFile), id));
  }, entryModule, entryModule.exports);
  return { factory: entryModule.exports.createCaptureService, trace };
}
for (const scaleFactor of scales) {
  const displays = [
    { id: 1, label: '主屏', scaleFactor, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { id: 2, scaleFactor: 1.25, bounds: { x: -1280, y: -40, width: 1280, height: 1024 }, workArea: { x: -1280, y: -40, width: 1280, height: 984 } },
  ];
  function rootOutcome(original) {
    const { factory, trace } = loadService(displays, original);
    const first = factory(); const second = factory();
    assert.notEqual(first.getFullDisplayBounds, second.getFullDisplayBounds, 'Public bounds function remains per instance');
    assert.equal(first.getFullDisplayBounds(displays[0]), displays[0].bounds);
    const result = first.getDisplayList();
    first.updateActivityRegion({ displayId: '2' });
    assert.equal(first.getTargetDisplay(), displays[1]);
    assert.equal(second.getTargetDisplay(), displays[0]);
    return { result, trace };
  }
  const actual = rootOutcome(false);
  assert.equal(actual.result[0].nativeBoundsSource, 'electron-scale');
  assert.equal(actual.result[1].nativeX, -1600);
  if (baseline) assert.deepEqual(actual, rootOutcome(true));
  cases++;
}
const text = fs.readFileSync(file, 'utf8');
assert.ok(text.split('\n').length <= 300);
const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
}
const root = fs.readFileSync(rootFile, 'utf8');
assert.match(root, /require\('\.\/capture\/displaySession\.cjs'\)/);
assert.match(fs.readFileSync(path.resolve(__dirname, '../electron/capture/displaySession.cjs'), 'utf8'), /require\('\.\/nativeDisplayAssembly\.cjs'\)/);
assert.match(fs.readFileSync(path.resolve(__dirname, '../electron/capture/nativeDisplayAssembly.cjs'), 'utf8'),
  /require\('\.\/displayGeometry\.cjs'\)/);
for (const name of names) assert.ok(!root.includes('function ' + name + '('), 'Detached original function: ' + name);
console.log(`Capture display geometry passed: ${cases} cases; scaling, negative coordinates, native matching, signatures, getter errors and two real service instances.`);
