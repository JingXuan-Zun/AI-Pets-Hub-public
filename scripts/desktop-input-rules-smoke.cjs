const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../electron/desktopInputRules.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const rules = require(file);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = Object.keys(rules);
let oldRules;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'VIRTUAL_KEY_BY_NAME')
    || ts.isForStatement(n) && n.getText(ast).includes('VIRTUAL_KEY_BY_NAME'));
  assert.equal(nodes.length, 11);
  oldRules = new Function(nodes.map(n => n.getText(ast)).join('\n') + '\nreturn { ' + names.join(',') + ' };')();
}
const values = [undefined, null, false, true, 0, -0, 1, -1, 1.5, -1.5, NaN, Infinity, -Infinity, 2n,
  '', ' ', 'NaN', '1.5', '-2.5', ' MOVE-POINTER ', 'doubleclick', 'context click', 'LEFT_CLICK', 'type',
  'press keys', 'shortcut', 'drag mouse', 'unknown', 'NATIVE-SCREEN', 'native_screen', 'right', 'MIDDLE',
  'abc中文', '+^%~(){}[]', ' CTRL + ALT, F12 ', 'a', 'Z', '0', '9', 'f1', 'f12', 'f13', 'F1', 'ctrl',
  'control', 'pgdn', 'toString', 'constructor', '__proto__', [], [1], [1, 2], {}, Symbol('input')];
const objectKinds = ['string', 'number', 'string-throw', 'number-throw'];
function outcome(api, name, seed, args) {
  const trace = [];
  const value = typeof seed === 'string' && seed.startsWith('object:') ? {
    toString() { trace.push('toString'); if (seed.endsWith('string-throw')) throw Error('string'); return 'ctrl'; },
    valueOf() { trace.push('valueOf'); if (seed.endsWith('number-throw')) throw Error('number'); return 2.5; },
  } : seed;
  try { return { value: api[name](value, ...args), trace }; }
  catch (error) { return { error: [error.name, error.message], trace }; }
}
function loadRoot(original) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', baseline && original ? baseline : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id === './desktopInputExecution.cjs') return require('../electron/desktopInputExecution.cjs');
    if (id === './desktopInputMouseClick.cjs') return require('../electron/desktopInputMouseClick.cjs');
    if (id === './desktopInputMouseTouch.cjs') return require('../electron/desktopInputMouseTouch.cjs');
    if (id === './desktopInputMouseResult.cjs') return require('../electron/desktopInputMouseResult.cjs');
    if (id === './desktopInputScriptFragments.cjs') return require('../electron/desktopInputScriptFragments.cjs');
    if (id === './desktopInputMousePreflight.cjs') return require('../electron/desktopInputMousePreflight.cjs');
    if (id === './desktopInputMousePosition.cjs') return require('../electron/desktopInputMousePosition.cjs');
    if (id === './desktopInputMousePreparation.cjs') return require('../electron/desktopInputMousePreparation.cjs');
    if (id === './desktopInputPointerScripts.cjs') return require('../electron/desktopInputPointerScripts.cjs');
    if (id === './desktopInputKeyboardScripts.cjs') return require('../electron/desktopInputKeyboardScripts.cjs');
    if (id === './desktopInputForegroundGuard.cjs') return require('../electron/desktopInputForegroundGuard.cjs');
    if (id === './desktopInputBaseScript.cjs') return require('../electron/desktopInputBaseScript.cjs');
    if (id === './desktopInputRules.cjs') return rules;
    if (id === './desktopInputPowerShellRunner.cjs') return require('../electron/desktopInputPowerShellRunner.cjs');
    if (id === './desktopInputCoordinates.cjs') return require('../electron/desktopInputCoordinates.cjs');
    if (id === 'child_process') return { execFile() { throw Error('Unexpected input execution'); } };
    if (id === 'fs') return { mkdtempSync() { throw Error('Unexpected temporary file'); }, rmSync() { throw Error('Unexpected cleanup'); }, writeFileSync() { throw Error('Unexpected write'); } };
    if (id === 'os') return { tmpdir() { throw Error('Unexpected temp path'); } };
    if (id === 'path') return path;
    throw Error('Unexpected import ' + id);
  }, module, module.exports, { platform: 'win32' });
  return module.exports;
}
function structure() {
  const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300);
  for (const n of ast.statements.filter(ts.isFunctionDeclaration)) {
    assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  }
  if (!baseline) return;
  function retained(source, original) {
    const tree = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    return tree.statements.filter(n => original
      ? !(ts.isFunctionDeclaration(n) && names.includes(n.name.text))
        && !(ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(tree) === 'VIRTUAL_KEY_BY_NAME'))
        && !(ts.isForStatement(n) && n.getText(tree).includes('VIRTUAL_KEY_BY_NAME'))
      : !(ts.isVariableStatement(n) && n.getText(tree).includes("require('./desktopInputRules.cjs')")))
      .map(n => n.getText(tree));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}
structure(); let cases = 0;
for (const name of names) for (const seed of [...values, ...objectKinds.map(k => 'object:' + k)]) {
  const variants = ['normalizePositiveInteger', 'normalizeInputDelayMs'].includes(name)
    ? [[7, 100], [0, 1], [null, 0], [9, -1], [3, NaN]] : name === 'normalizeNumber' ? [[], [42], [undefined]] : [[]];
  for (const args of variants) {
    const actual = outcome(rules, name, seed, args);
    if (baseline) assert.deepEqual(actual, outcome(oldRules, name, seed, args)); cases++;
  }
}
assert.equal(rules.normalizeDesktopInputAction(' MOVE-POINTER '), 'move_mouse');
assert.equal(rules.normalizeNumber(null), 0);
assert.equal(rules.normalizePositiveInteger(-10, 7, 100), 1);
assert.equal(rules.normalizeInputDelayMs(-10, 7, 100), 0);
assert.equal(rules.virtualKeyFromToken('f12'), 0x7b);
assert.equal(rules.virtualKeyFromToken('F1'), null);
assert.deepEqual(rules.splitHotkey('CTRL + ALT, F12'), ['ctrl', 'alt', 'f12']);
assert.equal(rules.escapeSendKeysText('+中文'), '{+}中文');
const root = loadRoot(false), old = baseline ? loadRoot(true) : null;
const base = { x: -20, y: 30, nativeScreenX: -20, nativeScreenY: 30,
  fromX: -20, fromY: 30, toX: 400, toY: 200, fromNativeScreenX: -20, fromNativeScreenY: 30,
  toNativeScreenX: 400, toNativeScreenY: 200, text: '中文+^%~(){}[]', keys: '{ENTER}', hotkey: 'ctrl+f12', button: 'left' };
let scripts = 0;
for (const action of ['move_mouse', 'click', 'double_click', 'right_click', 'type_text', 'send_keys', 'hotkey', 'drag', 'unknown']) {
  for (const request of [base, { ...base, button: 'right', count: 2, steps: 32, delayMs: 0 }, {}, { ...base, x: 'bad', nativeScreenX: 'bad', hotkey: 'ctrl+unknown' }]) {
    const actual = root._createDesktopInputScript(action, request);
    if (old) assert.equal(actual, old._createDesktopInputScript(action, request)); scripts++;
  }
}
assert.equal(root._createDesktopInputScript('unknown', base), null);
const first = root.createDesktopInputService({ screen: { dipToScreenPoint: ({ x, y }) => ({ x: x * 2, y: y * 2 }) } });
const second = root.createDesktopInputService();
assert.deepEqual(Object.keys(first), ['executeDesktopInput', '_createNativeScreenInputRequest']);
let requests = 0;
for (const action of ['click', 'drag', 'hotkey']) for (const coordinateSpace of ['dip', 'native-screen']) {
  const request = { ...base, coordinateSpace };
  const value = first._createNativeScreenInputRequest(action, request);
  if (old) assert.deepEqual(value, old.createDesktopInputService({ screen: { dipToScreenPoint: ({ x, y }) => ({ x: x * 2, y: y * 2 }) } })._createNativeScreenInputRequest(action, request));
  assert.equal(request.coordinateSpace, coordinateSpace, 'Input object remains unchanged'); requests++;
}
assert.notStrictEqual(first.executeDesktopInput, second.executeDesktopInput);
console.log('Desktop input rules passed: ' + cases + ' coercion/boundary/error cases, ' + scripts + ' complete script outputs and ' + requests + ' real coordinate requests; no native input execution.');
