const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const api = require('../electron/desktopInputPointerScripts.cjs');
const rules = require('../electron/desktopInputRules.cjs');
const { createBaseInputPowerShell } = require('../electron/desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('../electron/desktopInputForegroundGuard.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const file = path.resolve(__dirname, '../electron/desktopInputPointerScripts.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let original;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const nodes = tree.statements.filter(n => ts.isFunctionDeclaration(n) && Object.keys(api).includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(tree) === 'DESKTOP_INPUT_MAX_DRAG_STEPS'));
  assert.equal(nodes.length, 3);
  original = new Function('createBaseInputPowerShell', 'createForegroundGuardPowerShell', 'rules',
    'const { normalizeNumber, normalizePositiveInteger } = rules;\n' + nodes.map(n => n.getText(tree)).join('\n') + '\nreturn { ' + Object.keys(api).join(',') + ' };')(
      createBaseInputPowerShell, createForegroundGuardPowerShell, rules);
  const current = fs.readFileSync(rootFile, 'utf8'), next = ts.createSourceFile(rootFile, current, ts.ScriptTarget.Latest, true);
  assert.deepEqual(next.statements.filter(n => !n.getText(next).includes("require('./desktopInputPointerScripts.cjs')")).map(n => n.getText(next)),
    tree.statements.filter(n => !nodes.includes(n)).map(n => n.getText(tree)));
}
const fields = ['nativeScreenX', 'nativeScreenY', 'fromNativeScreenX', 'fromNativeScreenY', 'toNativeScreenX', 'toNativeScreenY', 'steps'];
const seeds = [undefined, null, false, true, 0, -5, 2.5, 32, 33, 100, NaN, Infinity, ' -2.5 ', 'bad', '', 3n,
  Symbol('value'), 'object-number', 'object-throw', 'object-changing'];
function outcome(read, name, field, seed, guarded, getterThrows = false) {
  const trace = [], failure = Error('controlled pointer conversion'); let conversions = 0;
  const value = typeof seed === 'string' && seed.startsWith('object-') ? {
    [Symbol.toPrimitive](hint) { trace.push(['convert', hint]); if (seed === 'object-throw') throw failure; return seed === 'object-changing' ? ++conversions : 7.5; },
  } : seed;
  const options = { nativeScreenX: -30, nativeScreenY: 20, fromNativeScreenX: -30, fromNativeScreenY: 20,
    toNativeScreenX: 400, toNativeScreenY: 210, steps: 12,
    ...(guarded ? { expectedForegroundHwnd: 123, expectedForegroundTitle: "title'O" } : {}) };
  options[field] = value;
  const input = new Proxy(options, { get(target, key) {
    trace.push(['get', key]); if (getterThrows && key === field) throw failure;
    return Reflect.get(target, key);
  } });
  try { return { value: read[name](input), trace }; }
  catch (error) {
    if (getterThrows || seed === 'object-throw') assert.strictEqual(error, failure);
    return { error: [error.name, error.message], trace };
  }
}
let cases = 0;
const hash = crypto.createHash('sha256');
for (const name of Object.keys(api)) for (const field of fields) for (const seed of seeds) for (const guarded of [false, true]) {
  const actual = outcome(api, name, field, seed, guarded);
  if (original) assert.deepEqual(actual, outcome(original, name, field, seed, guarded));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const name of Object.keys(api)) for (const field of fields) {
  const actual = outcome(api, name, field, 7, true, true);
  if (original) assert.deepEqual(actual, outcome(original, name, field, 7, true, true));
  hash.update(JSON.stringify(actual)); cases++;
}
const fingerprint = hash.digest('hex');
assert.equal(fingerprint, '799eb1104a5e8c5f73ecc8399fa7b244ceb6b1b1cf33ce98229c15183d451706', 'Reviewed pointer scripts and reading/error trace');
assert.equal(api.createMoveMouseScript({}), null);
assert.ok(api.createMoveMouseScript({ nativeScreenX: null, nativeScreenY: 2.5 }).includes('SetCursorPos(0, 3)'));
const points = { fromNativeScreenX: -20, fromNativeScreenY: 30, toNativeScreenX: 100, toNativeScreenY: -40 };
for (const [steps, expected] of [[undefined, 12], [null, 1], [0, 1], [2.5, 3], [100, 32], ['bad', 12]]) {
  const script = api.createDragScript({ ...points, steps, expectedHwnd: 123 });
  assert.ok(script.includes('$i -le ' + expected));
  assert.ok(script.indexOf('target_window_not_foreground') < script.indexOf('SetCursorPos(-20, 30)'));
  assert.ok(script.indexOf('mouse_event(0x0002') < script.indexOf('for ($i'));
  assert.ok(script.indexOf('mouse_event(0x0004') > script.indexOf('for ($i'));
}
const invalid = outcome(api, 'createDragScript', 'fromNativeScreenX', 'bad', true);
assert.equal(invalid.value, null);
assert.deepEqual(invalid.trace.map(row => row[1]), fields.slice(2, 6), 'Read all coordinates before invalid-coordinate return; do not read steps/foreground');
function root(old) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', old ? baseline : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id.startsWith('./')) return require(path.resolve(path.dirname(rootFile), id));
    if (id === 'child_process') return { execFile() { throw Error('Unexpected native execution'); } };
    if (id === 'fs') return {}; if (id === 'os') return {}; if (id === 'path') return path;
    throw Error(id);
  }, module, module.exports, { platform: 'win32' });
  return module.exports;
}
const current = root(false), old = baseline ? root(true) : null;
let roots = 0;
for (const action of ['move_mouse', 'drag']) for (const space of ['dip', 'native-screen']) for (const screenMode of ['none', 'scaled', 'throw']) {
  const screen = screenMode === 'none' ? undefined : { dipToScreenPoint({ x, y }) {
    if (screenMode === 'throw') throw Error('controlled coordinate failure'); return { x: x * 2, y: y * 2 };
  } };
  const input = { x: -10, y: 20, fromX: -10, fromY: 20, toX: 100, toY: -40, steps: 33, coordinateSpace: space, expectedHwnd: 123 };
  const projected = current.createDesktopInputService({ screen })._createNativeScreenInputRequest(action, input);
  const script = current._createDesktopInputScript(action, projected);
  assert.equal(typeof script, 'string');
  if (old) {
    const previous = old.createDesktopInputService({ screen })._createNativeScreenInputRequest(action, input);
    assert.deepEqual(projected, previous); assert.equal(script, old._createDesktopInputScript(action, previous));
  }
  roots++;
}
const text = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
for (const n of tree.statements.filter(ts.isFunctionDeclaration)) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
console.log('Desktop input pointer scripts passed: ' + cases + ' coordinates/steps/conversion/getter/foreground cases and ' + roots + ' real-service projected complete scripts; no native execution.');
