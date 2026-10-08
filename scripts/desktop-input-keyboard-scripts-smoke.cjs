const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const api = require('../electron/desktopInputKeyboardScripts.cjs');
const rules = require('../electron/desktopInputRules.cjs');
const { createBaseInputPowerShell } = require('../electron/desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('../electron/desktopInputForegroundGuard.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const file = path.resolve(__dirname, '../electron/desktopInputKeyboardScripts.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let original;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const nodes = tree.statements.filter(n => ts.isFunctionDeclaration(n) && Object.keys(api).includes(n.name.text));
  assert.equal(nodes.length, 3);
  original = new Function('createBaseInputPowerShell', 'createForegroundGuardPowerShell', 'rules',
    'const { escapeSendKeysText, splitHotkey, virtualKeyFromToken } = rules;\n' + nodes.map(n => n.getText(tree)).join('\n') + '\nreturn { ' + Object.keys(api).join(',') + ' };')(
      createBaseInputPowerShell, createForegroundGuardPowerShell, rules);
  const current = fs.readFileSync(rootFile, 'utf8'), next = ts.createSourceFile(rootFile, current, ts.ScriptTarget.Latest, true);
  const expected = tree.statements.filter(n => !nodes.includes(n)).map(n => n.getText(tree)
    .replace(/  (escapeSendKeysText|splitHotkey|virtualKeyFromToken),\r?\n/g, ''));
  assert.deepEqual(next.statements.filter(n => !n.getText(next).includes("require('./desktopInputKeyboardScripts.cjs')")).map(n => n.getText(next)), expected);
}
const fields = ['text', 'value', 'keys', 'sequence', 'hotkey'];
const seeds = [undefined, null, false, 0, '', ' ', '中文😀+^%~(){}[]', "'@\n${literal}\n`path", 'a'.repeat(1999),
  'a'.repeat(2001), 'a'.repeat(401), '{ENTER}', 'ctrl+alt+f12', 'ctrl+unknown', 'CTRL, SHIFT, A',
  'toString', Symbol('value'), 2n, 'object', 'object-throw'];
function outcome(read, name, field, seed, protectedTarget, getterThrows = false) {
  const trace = [], failure = Error('controlled keyboard conversion');
  const value = seed === 'object' || seed === 'object-throw' ? {
    [Symbol.toPrimitive](hint) { trace.push(['convert', hint]); if (seed === 'object-throw') throw failure; return 'ctrl+f12'; },
  } : seed;
  const options = { text: 'fallback text', value: 'value text', keys: '{ENTER}', sequence: 'ctrl+a', hotkey: 'ctrl+f12',
    ...(protectedTarget ? { expectedForegroundTitle: "title'O", expectedForegroundPid: 12 } : {}) };
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
for (const name of Object.keys(api)) for (const field of fields) for (const seed of seeds) for (const protectedTarget of [false, true]) {
  const actual = outcome(api, name, field, seed, protectedTarget);
  if (original) assert.deepEqual(actual, outcome(original, name, field, seed, protectedTarget));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const name of Object.keys(api)) for (const field of fields) {
  const actual = outcome(api, name, field, 'unused', true, true);
  if (original) assert.deepEqual(actual, outcome(original, name, field, 'unused', true, true));
  hash.update(JSON.stringify(actual)); cases++;
}
assert.equal(hash.digest('hex'), 'd9e15e740b8dbf38a50fe3dbad0203de9924172dedcbc2cab37b562ad85ca71c', 'Reviewed keyboard scripts and reading/error trace');
assert.equal(api.createTextScript({ text: '', value: 'fallback' }), null);
assert.equal(api.createSendKeysScript({ keys: ' ', sequence: '{ENTER}' }), null);
assert.equal(api.createHotkeyScript({ hotkey: 'ctrl+unknown' }), null);
const textScript = api.createTextScript({ text: 'a'.repeat(2001) });
assert.ok(textScript.includes(JSON.stringify('a'.repeat(2000))));
assert.ok(!textScript.includes('a'.repeat(2001)));
assert.ok(api.createTextScript({ text: '+^{}' }).includes(JSON.stringify('{+}{^}{{}{}}')));
const keysScript = api.createSendKeysScript({ keys: '  ' + 'a'.repeat(401) + '  ' });
assert.ok(keysScript.includes(JSON.stringify('a'.repeat(400))));
const hotkey = api.createHotkeyScript({ hotkey: 'ctrl+alt+f12' });
assert.ok(hotkey.includes('$keys = @(17,18,123)'));
assert.ok(hotkey.includes('for ($i = $keys.Length - 1; $i -ge 0; $i--)'));
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
for (const action of ['type_text', 'send_keys', 'hotkey'])
  for (const request of [{ text: '中文+{}', keys: '{ENTER}', hotkey: 'ctrl+f12' }, {},
    { value: 'value text', sequence: 'ctrl+a', expectedForegroundTitle: "title'O" },
    { text: 'a'.repeat(2001), keys: 'a'.repeat(401), hotkey: 'ctrl+unknown' }]) {
    const result = current._createDesktopInputScript(action, request);
    if (old) assert.equal(result, old._createDesktopInputScript(action, request));
    roots++;
  }
const text = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
for (const n of tree.statements.filter(ts.isFunctionDeclaration)) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
console.log('Desktop input keyboard scripts passed: ' + cases + ' alias/limits/coercion/getter/error/foreground cases and ' + roots + ' real-root complete scripts; no native execution.');
