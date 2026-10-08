const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { prepareMouseInput } = require('../electron/desktopInputMousePreparation.cjs');
const rules = require('../electron/desktopInputRules.cjs');
const stages = { ...require('../electron/desktopInputScriptFragments.cjs'), ...require('../electron/desktopInputMousePreflight.cjs'), ...require('../electron/desktopInputMousePosition.cjs'), ...require('../electron/desktopInputMouseClick.cjs'), ...require('../electron/desktopInputMouseTouch.cjs'), ...require('../electron/desktopInputMouseResult.cjs') };
const { createBaseInputPowerShell } = require('../electron/desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('../electron/desktopInputForegroundGuard.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const file = path.resolve(__dirname, '../electron/desktopInputMousePreparation.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function mouseFunction(source) {
  const tree = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
  const fn = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMouseEventScript');
  return new Function('stages', 'prepareMouseInput', 'rules', 'createBaseInputPowerShell', 'createForegroundGuardPowerShell',
    'const { captureScriptFragment, renderScriptFragments, createMouseInputPreflight, createMouseInputPositionCheck, createMouseInputPositionRecovery, createMouseClickSendInput, createMouseClickFallback, createMouseClickCompletion, createMouseTouchInjection, createMouseTouchDiagnostics, createMouseKeyboardFallback, createMouseResultDiagnostics } = stages;\nconst { normalizeNumber, normalizeButton, normalizePositiveInteger, normalizeInputDelayMs } = rules;\n' + fn.getText(tree) + '\nreturn createMouseEventScript;')(
      stages, prepareMouseInput, rules, createBaseInputPowerShell, createForegroundGuardPowerShell);
}
const currentSource = fs.readFileSync(rootFile, 'utf8');
const current = mouseFunction(currentSource), original = baseline ? mouseFunction(baseline) : null;
if (baseline) {
  function retained(source, old) {
    const tree = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    return tree.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name.text === 'createMouseEventScript')
      && !/require\('\.\/desktopInput(MousePreparation|ScriptFragments|MousePreflight|MousePosition|ForegroundGuard|MouseClick|MouseTouch|MouseResult)\.cjs'\)/.test(n.getText(tree))).map(n => old
        ? n.getText(tree).replace(/  (normalizeButton|normalizeNumber|normalizePositiveInteger|normalizeInputDelayMs),\r?\n/g, '') : n.getText(tree));
  }
  assert.deepEqual(retained(currentSource, false), retained(baseline, true));
}
const fields = ['nativeScreenX', 'nativeScreenY', 'button', 'action', 'repeat', 'clickCount', 'preClickDelayMs',
  'holdMs', 'clickHoldMs', 'intervalMs', 'clickIntervalMs', 'forceMouseEventFallback', 'forceTouchInjectionFallback',
  'keyboardFallback', 'fallbackKey', 'expectedForegroundHwnd', 'expectedHwnd', 'hwnd', 'windowHandle'];
const seeds = [undefined, null, false, 0, -5, 2.5, 1001, Infinity, '', 'right', 'middle', 'double_click',
  " enter'O ", 'bad', Symbol('value'), 'object-number', 'object-string', 'object-throw'];
function outcome(read, field, seed, button, getterThrows = false) {
  const trace = [], failure = Error('controlled mouse conversion'); let reads = 0;
  const value = typeof seed === 'string' && seed.startsWith('object-') ? {
    [Symbol.toPrimitive](hint) { trace.push(['convert', hint]); if (seed === 'object-throw') throw failure; return seed === 'object-number' ? 7.5 : 'enter'; },
  } : seed;
  const options = { nativeScreenX: -30, nativeScreenY: 20, button, action: 'click', clickCount: 2,
    clickHoldMs: 30, clickIntervalMs: 40, fallbackKey: 'enter', expectedHwnd: 123 };
  options[field] = value;
  const input = new Proxy(options, { get(target, key) {
    trace.push(['get', key]); if (getterThrows && key === field) throw failure;
    if (seed === 'changing-action' && key === 'action') return ++reads % 2 ? 'double_click' : 'click';
    return Reflect.get(target, key);
  } });
  try { return { value: read(input), trace }; }
  catch (error) {
    if (getterThrows || seed === 'object-throw') assert.strictEqual(error, failure);
    return { error: [error.name, error.message], trace };
  }
}
let cases = 0;
const hash = crypto.createHash('sha256');
for (const field of fields) for (const seed of seeds) for (const button of ['left', 'right', 'middle']) {
  const actual = outcome(current, field, seed, button);
  if (original) assert.deepEqual(actual, outcome(original, field, seed, button));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const field of fields) for (const button of ['left', 'right', 'middle']) {
  const actual = outcome(current, field, 7, button, true);
  if (original) assert.deepEqual(actual, outcome(original, field, 7, button, true));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const button of ['left', 'right', 'middle']) {
  const actual = outcome(current, 'action', 'changing-action', button);
  if (original) assert.deepEqual(actual, outcome(original, 'action', 'changing-action', button));
  hash.update(JSON.stringify(actual)); cases++;
}
const fingerprint = hash.digest('hex');
assert.equal(fingerprint, '49d56c932cca5c474b23dac3aaf55ec9b918ec7ba9ddf6733f478355aa011a97', 'Reviewed complete mouse script and reading/error trace');
assert.equal(prepareMouseInput({ nativeScreenX: undefined, nativeScreenY: 3 }), null);
const normal = prepareMouseInput({ nativeScreenX: null, nativeScreenY: 2.5 });
assert.equal(normal.x, 0); assert.equal(normal.y, 3); assert.equal(normal.clicks, 1);
assert.equal(normal.preClickDelayMs, 80); assert.equal(normal.holdMs, 40); assert.equal(normal.intervalMs, 80);
for (const button of ['left', 'right', 'middle']) {
  const value = prepareMouseInput({ nativeScreenX: 1, nativeScreenY: 2, button, action: 'double_click', repeat: 4,
    forceMouseEventFallback: true, forceTouchInjectionFallback: true });
  assert.equal(value.clicks, 2); assert.equal(value.forceMouseEventFallback, true);
  assert.equal(value.forceTouchInjectionFallback, button === 'left');
}
function root(old) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', old ? baseline : currentSource)(id => {
    if (id.startsWith('./')) return require(path.resolve(path.dirname(rootFile), id));
    if (id === 'child_process') return { execFile() { throw Error('Unexpected native execution'); } };
    if (id === 'fs') return {}; if (id === 'os') return {}; if (id === 'path') return path;
    throw Error(id);
  }, module, module.exports, { platform: 'win32' });
  return module.exports;
}
const api = root(false), old = baseline ? root(true) : null;
let roots = 0;
for (const action of ['click', 'double_click', 'right_click']) for (const button of ['left', 'right', 'middle'])
  for (const request of [{ nativeScreenX: -20, nativeScreenY: 30 }, { nativeScreenX: null, nativeScreenY: 2.5, repeat: 100,
    holdMs: -5, forceTouchInjectionFallback: true, expectedHwnd: 123 }, {}]) {
    const input = { ...request, button }, script = api._createDesktopInputScript(action, input);
    if (old) assert.equal(script, old._createDesktopInputScript(action, input));
    roots++;
  }
const text = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
for (const n of tree.statements.filter(ts.isFunctionDeclaration)) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
console.log('Desktop input mouse preparation passed: ' + cases + ' full-script/reading/coercion/short-circuit/error cases and ' + roots + ' real-root complete scripts; no native execution.');
