const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createDesktopInputCoordinateAdapter } = require('../electron/desktopInputCoordinates.cjs');
const { normalizeNumber, normalizeDesktopInputCoordinateSpace } = require('../electron/desktopInputRules.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const file = path.resolve(__dirname, '../electron/desktopInputCoordinates.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['convertDipPointToNativeScreenPoint', 'resolveInputNativeScreenPoint', 'createNativeScreenInputRequest'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createDesktopInputService');
  const nodes = root.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
  assert.equal(nodes.length, 3);
  oldFactory = new Function('dependencies', 'normalizeNumber', 'normalizeDesktopInputCoordinateSpace',
    'const { log, screen } = dependencies;\n' + nodes.map(n => n.getText(ast)).join('\n') + '\nreturn createNativeScreenInputRequest;');
}
function adapter(deps, original) { return original ? oldFactory(deps, normalizeNumber, normalizeDesktopInputCoordinateSpace) : createDesktopInputCoordinateAdapter(deps); }
function fixture(mode, logThrows) {
  const trace = [];
  function failure(message) { const error = Error(message); error.stack = 'controlled:' + message; return error; }
  const deps = { log(message, error) { trace.push(['log', message, error]); if (logThrows) throw failure('log'); } };
  if (mode !== 'none') {
    deps.screen = {};
    if (mode !== 'no-method') {
      const convert = function (point) {
        assert.strictEqual(this, deps.screen); trace.push(['convert', point]);
        if (mode === 'throw') throw failure('conversion');
        if (mode === 'null') return null;
        if (mode === 'string') return { x: String(point.x), y: point.y };
        return { x: point.x * (mode === 'scaled' ? 1.5 : 1), y: point.y * (mode === 'scaled' ? 2 : 1) };
      };
      Object.defineProperty(deps.screen, 'dipToScreenPoint', { get() {
        trace.push(['method']); if (mode === 'getter-throw') throw failure('method'); return convert;
      } });
    }
  }
  return { trace, deps };
}
function request(kind, coordinateSpace, trace) {
  const value = { coordinateSpace, payload: {}, nativeScreenX: -44, nativeScreenY: 45,
    fromNativeScreenX: -46, fromNativeScreenY: 47, toNativeScreenX: 48, toNativeScreenY: 49 };
  if (kind === 'finite') Object.assign(value, { x: -10.5, y: 20.5, fromX: -30.5, fromY: 40.5, toX: 50.5, toY: 60.5 });
  if (kind === 'strings') Object.assign(value, { x: '-10.5', y: '20.5', fromX: '-30.5', fromY: '40.5', toX: '50.5', toY: '60.5' });
  if (kind === 'null') Object.assign(value, { x: null, y: null, fromX: null, fromY: null, toX: null, toY: null });
  if (kind === 'invalid') Object.assign(value, { x: 'bad', y: Infinity, fromX: NaN, fromY: 'bad', toX: Infinity, toY: 'bad', targetX: 10, targetY: 11 });
  if (kind === 'missing') for (const key of Object.keys(value).filter(key => /[XY]$/.test(key))) delete value[key];
  if (kind === 'bigint') Object.assign(value, { x: 10n, y: -20n, fromX: 30n, fromY: 40n, toX: 50n, toY: 60n });
  if (kind === 'getters' || kind === 'getter-throw') {
    let reads = 0;
    Object.defineProperty(value, 'x', { enumerable: true, get() {
      trace.push(['x', ++reads]); if (kind === 'getter-throw' && reads > 1) throw Error('x-getter'); return -10.5 + reads;
    } });
    Object.defineProperty(value, 'coordinateSpace', { enumerable: true, get() { trace.push(['coordinateSpace']); return coordinateSpace; } });
  }
  return value;
}
function run(action, space, kind, mode, logThrows, original) {
  const f = fixture(mode, logThrows), read = adapter(f.deps, original), input = request(kind, space, f.trace);
  const descriptors = Object.getOwnPropertyDescriptors(input); let result;
  try { result = { value: read(action, input) }; }
  catch (error) { result = { error: [error.name, error.message] }; }
  assert.deepEqual(Object.getOwnPropertyDescriptors(input), descriptors, 'Request remains unchanged');
  if (result.value) { assert.notStrictEqual(result.value, input); assert.strictEqual(result.value.payload, input.payload); }
  if (space === 'native-screen') assert.ok(!f.trace.some(row => row[0] === 'method' || row[0] === 'convert' || row[0] === 'log'));
  return { result, trace: f.trace };
}
function rootScenario(action, space, mode, original) {
  const f = fixture(mode, false), module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', original ? baseline : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id.startsWith('./')) return require(path.resolve(path.dirname(rootFile), id));
    if (id === 'child_process') return { execFile() { throw Error('Unexpected input execution'); } };
    if (id === 'fs') return {}; if (id === 'os') return {}; if (id === 'path') return path;
    throw Error(id);
  }, module, module.exports, { platform: 'win32' });
  const api = module.exports.createDesktopInputService(f.deps), other = module.exports.createDesktopInputService();
  assert.deepEqual(Object.keys(api), ['executeDesktopInput', '_createNativeScreenInputRequest']);
  assert.notStrictEqual(api._createNativeScreenInputRequest, other._createNativeScreenInputRequest);
  const input = request('finite', space, f.trace);
  input.hotkey = 'ctrl+f12';
  const value = api._createNativeScreenInputRequest(action, input);
  const script = module.exports._createDesktopInputScript(action, value);
  assert.equal(typeof script, 'string');
  return { value, script, trace: f.trace };
}
function structure() {
  const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300);
  for (const n of ast.statements.filter(ts.isFunctionDeclaration)) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  if (!baseline) return;
  function retained(source, original) {
    const tree = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createDesktopInputService');
    return root.body.statements.filter(n => original ? !(ts.isFunctionDeclaration(n) && names.includes(n.name.text))
      : !(ts.isVariableStatement(n) && n.getText(tree).includes('= createDesktopInputCoordinateAdapter('))).map(n => n.getText(tree));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}
structure(); let cases = 0;
for (const action of ['click', 'drag', 'hotkey']) for (const space of ['dip', 'native-screen', 'unknown'])
  for (const kind of ['finite', 'strings', 'null', 'invalid', 'missing', 'bigint', 'getters', 'getter-throw'])
    for (const mode of ['none', 'no-method', 'normal', 'scaled', 'null', 'string', 'throw', 'getter-throw']) for (const logThrows of [false, true]) {
      const actual = run(action, space, kind, mode, logThrows, false);
      if (baseline) assert.deepEqual(actual, run(action, space, kind, mode, logThrows, true)); cases++;
    }
const first = adapter(fixture('scaled', false).deps, false), second = adapter({}, false);
assert.notStrictEqual(first, second);
assert.equal(first('click', { x: 10, y: 20 }).nativeScreenX, 15);
assert.equal(second('click', { x: 10, y: 20 }).nativeScreenX, 10);
let roots = 0;
for (const action of ['click', 'drag', 'hotkey']) for (const space of ['dip', 'native-screen']) for (const mode of ['none', 'scaled', 'throw']) {
  const actual = rootScenario(action, space, mode, false);
  if (baseline) assert.deepEqual(actual, rootScenario(action, space, mode, true)); roots++;
}
console.log('Desktop input coordinates passed: ' + cases + ' precedence/coercion/getter/conversion/logging/error cases and ' + roots + ' real-root complete-script cases; isolated adapters, no native input execution.');
