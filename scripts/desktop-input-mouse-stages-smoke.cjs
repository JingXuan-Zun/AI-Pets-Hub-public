const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const fragments = require('../electron/desktopInputScriptFragments.cjs');
const dependencies = {
  ...fragments,
  ...require('../electron/desktopInputMousePreparation.cjs'),
  ...require('../electron/desktopInputMousePreflight.cjs'),
  ...require('../electron/desktopInputMousePosition.cjs'),
  ...require('../electron/desktopInputMouseClick.cjs'),
  ...require('../electron/desktopInputMouseTouch.cjs'),
  ...require('../electron/desktopInputMouseResult.cjs'),
  ...require('../electron/desktopInputBaseScript.cjs'),
  ...require('../electron/desktopInputForegroundGuard.cjs'),
};
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function readMouse(source) {
  const tree = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
  const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMouseEventScript');
  return new Function('dependencies', 'const { ' + Object.keys(dependencies).join(',') + ' } = dependencies;\n'
    + node.getText(tree) + '\nreturn createMouseEventScript;')(dependencies);
}
const current = readMouse(fs.readFileSync(rootFile, 'utf8')), original = baseline ? readMouse(baseline) : null;
function run(read, conversionFailure, button) {
  const trace = [], failure = Error('deferred action conversion'); let version = 0, conversions = 0;
  const action = { [Symbol.toPrimitive](hint) {
    trace.push(['convert', hint, version]);
    if (++conversions === conversionFailure) throw failure;
    return 'click-' + version;
  } };
  const options = { nativeScreenX: -20, nativeScreenY: 30, button, action, expectedHwnd: 123,
    expectedForegroundTitle: "title'O", forceMouseEventFallback: true, forceTouchInjectionFallback: true,
    keyboardFallback: 'enter', repeat: 2 };
  const input = new Proxy(options, { get(target, key) { version++; trace.push(['get', key, version]); return Reflect.get(target, key); } });
  try { return { value: read(input), trace }; }
  catch (error) { assert.strictEqual(error, failure); return { error: error.message, trace }; }
}
const hash = crypto.createHash('sha256'); let cases = 0;
for (const button of ['left', 'right', 'middle']) for (const conversionFailure of [0, 1, 2, 3, 4, 5, 6]) {
  const actual = run(current, conversionFailure, button);
  if (original) assert.deepEqual(actual, run(original, conversionFailure, button));
  hash.update(JSON.stringify(actual)); cases++;
}
const fingerprint = hash.digest('hex');
assert.equal(fingerprint, '25813ad98854c828155f2f8df74e23c8ccfb9801abdf93b38d29035382fb9533', 'Deferred getter/conversion ordering remains unchanged');
const trace = []; let state = 'before';
const value = { [Symbol.toPrimitive](hint) { trace.push(hint); return state; } };
const left = fragments.captureScriptFragment`A\n${value}B`;
assert.deepEqual(trace, [], 'Capturing does not convert values');
state = 'after';
const right = fragments.captureScriptFragment`C${value}D`;
assert.equal(fragments.renderScriptFragments(String.raw, left, right), 'A\\nafterBCafterD');
assert.deepEqual(trace, ['string', 'string']);
let calls = 0;
const rendered = fragments.renderScriptFragments(function (template, ...values) {
  assert.strictEqual(this, String); calls++;
  return String.raw(template, ...values);
}, fragments.captureScriptFragment`x${1}`, fragments.captureScriptFragment`${2}y`);
assert.equal(rendered, 'x12y'); assert.equal(calls, 1);
const failure = Error('conversion');
assert.throws(() => fragments.renderScriptFragments(String.raw, fragments.captureScriptFragment`x${{
  [Symbol.toPrimitive]() { throw failure; },
}}`), error => error === failure);
for (const name of ['desktopInputScriptFragments.cjs', 'desktopInputMousePreflight.cjs', 'desktopInputMousePosition.cjs', 'desktopInputMouseClick.cjs', 'desktopInputMouseTouch.cjs', 'desktopInputMouseResult.cjs']) {
  const file = path.resolve(__dirname, '../electron', name), text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300, name);
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const node of tree.statements.filter(ts.isFunctionDeclaration)) {
    assert.ok(tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 <= 50, node.name.text);
  }
}
const prepared = dependencies.prepareMouseInput({ nativeScreenX: 1, nativeScreenY: 2 });
const phases = fragments.renderScriptFragments(String.raw,
  dependencies.createMouseInputPreflight({ action: 'click' }, prepared),
  dependencies.createMouseInputPositionCheck({ action: 'click' }, prepared),
  dependencies.createMouseInputPositionRecovery({ action: 'click' }, prepared));
assert.ok(phases.indexOf('target_requires_elevation') < phases.indexOf('SetCursorPos(1, 2)'));
assert.ok(phases.indexOf('PointWindowVerify') < phases.indexOf('VirtualAbsoluteMove'));
assert.ok(phases.includes("failureClassification = 'cursor_target_not_reached'"));
let clickCases = 0;
for (const button of ['left', 'right', 'middle']) for (const flags of [0, 1, 2, 3])
  for (const keyboardFallback of ['enter', 'space', 'unsupported']) {
    const input = { nativeScreenX: -20, nativeScreenY: 30, action: 'click', button, keyboardFallback,
      forceMouseEventFallback: Boolean(flags & 1), forceTouchInjectionFallback: Boolean(flags & 2) };
    const script = current(input);
    if (original) assert.equal(script, original(input));
    assert.ok(script.indexOf('$sentDown =') < script.indexOf('$sentUp ='));
    assert.ok(script.indexOf('$sentUp =') < script.indexOf('$touchInjectionResult ='));
    assert.ok(script.indexOf('$touchDownOk = [DesktopPetInput]::InjectTouchInput') < script.indexOf('$touchUpOk = [DesktopPetInput]::InjectTouchInput'));
    assert.ok(script.indexOf('$sendInputAttempts +=') < script.indexOf('$keyboardFallbackUsed ='));
    assert.ok(script.indexOf('$keyboardFallbackUsed =') < script.indexOf('$foregroundAfter ='));
    const touchGuard = script.match(/\$touchInjectionResult = \$null\n  if \((\$true|\$false)\)/);
    assert.ok(touchGuard); assert.equal(touchGuard[1], button === 'left' && flags & 2 ? '$true' : '$false');
    clickCases++;
  }
console.log('Desktop input mouse stages passed: ' + cases + ' mutable action/getter/deferred-error cases, ' + clickCases + ' click/fallback/diagnostic cases, fragment order/receiver/raw checks and budgets; no native execution.');
