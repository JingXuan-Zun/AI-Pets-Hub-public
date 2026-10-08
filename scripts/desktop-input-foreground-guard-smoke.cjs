const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const api = require('../electron/desktopInputForegroundGuard.cjs');
const { normalizeNumber } = require('../electron/desktopInputRules.cjs');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const file = path.resolve(__dirname, '../electron/desktopInputForegroundGuard.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let original;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const nodes = tree.statements.filter(n => ts.isFunctionDeclaration(n) && Object.keys(api).includes(n.name.text));
  assert.equal(nodes.length, 2);
  original = new Function('normalizeNumber', nodes.map(n => n.getText(tree)).join('\n') + '\nreturn { ' + Object.keys(api).join(',') + ' };')(normalizeNumber);
  const current = fs.readFileSync(rootFile, 'utf8'), next = ts.createSourceFile(rootFile, current, ts.ScriptTarget.Latest, true);
  assert.deepEqual(next.statements.filter(n => !n.getText(next).includes("require('./desktopInputForegroundGuard.cjs')")).map(n => n.getText(next)),
    tree.statements.filter(n => !nodes.includes(n)).map(n => n.getText(tree)));
}
const fields = ['expectedForegroundHwnd', 'expectedHwnd', 'hwnd', 'windowHandle', 'expectedForegroundPid',
  'expectedPid', 'pid', 'expectedForegroundTitle', 'windowTitle', 'title', 'expectedForegroundProcessName', 'processName'];
const seeds = [undefined, null, false, 0, -3, 2.5, Infinity, ' 2.5 ', 'bad', "中文'O\n${literal}", '', 3n,
  Symbol('value'), 'object-number', 'object-string', 'object-throw'];
function fixture(field, seed, trace, getterThrows = false) {
  const fail = Error('controlled conversion');
  const value = typeof seed === 'string' && seed.startsWith('object-') ? {
    [Symbol.toPrimitive](hint) { trace.push(['convert', hint]); if (seed === 'object-throw') throw fail; return seed === 'object-number' ? 7.5 : "title'O"; },
  } : seed;
  const input = { expectedHwnd: 21, windowHandle: 22, expectedPid: 31, pid: 32, windowTitle: 'fallback title', processName: 'fallback process' };
  input[field] = value;
  return { fail, input: new Proxy(input, { get(target, key) {
    trace.push(['get', key]); if (getterThrows && key === field) throw fail;
    return Reflect.get(target, key);
  } }) };
}
function outcome(read, field, seed, action, getterThrows = false) {
  const trace = [], { input, fail } = fixture(field, seed, trace, getterThrows);
  try { return { value: read.createForegroundGuardPowerShell(input, action), trace }; }
  catch (error) {
    if (getterThrows || seed === 'object-throw') assert.strictEqual(error, fail);
    return { error: [error.name, error.message], trace };
  }
}
let cases = 0;
const hash = crypto.createHash('sha256');
for (const field of fields) for (const seed of seeds) for (const action of ['click', "type'text", undefined]) {
  const actual = outcome(api, field, seed, action);
  if (original) assert.deepEqual(actual, outcome(original, field, seed, action));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const field of fields) {
  const actual = outcome(api, field, 7, 'click', true);
  if (original) assert.deepEqual(actual, outcome(original, field, 7, 'click', true));
  hash.update(JSON.stringify(actual)); cases++;
}
assert.equal(hash.digest('hex'), 'bb21ba3a50f317daa54f95258c6721351f421240441d5193dc41e48d15bbc7de', 'Reviewed field precedence/conversion/error trace');
for (const value of seeds) {
  let actual, previous;
  function escape(read) { try { return { value: read.escapePowerShellSingleQuotedString(value) }; } catch (error) { return { error: [error.name, error.message] }; } }
  actual = escape(api); if (original) { previous = escape(original); assert.deepEqual(actual, previous); }
}
assert.equal(api.escapePowerShellSingleQuotedString("'中文'"), "''中文''");
assert.equal(api.escapePowerShellSingleQuotedString(null), '');
assert.equal(api.createForegroundGuardPowerShell({}, 'click'), '');
assert.ok(api.createForegroundGuardPowerShell({ expectedHwnd: 0, hwnd: 99 }, 'click').includes('$expectedForegroundHwnd = 0'));
const guard = api.createForegroundGuardPowerShell({ expectedForegroundTitle: " title'O " }, "type'text");
assert.ok(guard.includes("$expectedForegroundTitle = 'title''O'"));
assert.ok(guard.includes("action = 'type''text'"));
assert.ok(guard.indexOf('$expectedForegroundHwnd -gt 0') < guard.indexOf('$expectedForegroundPid -gt 0'));
assert.ok(guard.includes('exit 0'));
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
const request = { x: -20, y: 30, nativeScreenX: -20, nativeScreenY: 30, fromNativeScreenX: -20, fromNativeScreenY: 30,
  toNativeScreenX: 50, toNativeScreenY: 80, text: "中文'O", keys: '{ENTER}', hotkey: 'ctrl+f12' };
let roots = 0;
for (const action of ['move_mouse', 'click', 'double_click', 'right_click', 'type_text', 'send_keys', 'hotkey', 'drag'])
  for (const guard of [{}, { hwnd: 12, pid: 34 }, { expectedHwnd: 0, hwnd: 99 }, { expectedForegroundTitle: "title'O" }, { processName: 'proc' }]) {
    const input = { ...request, ...guard }, script = current._createDesktopInputScript(action, input);
    assert.equal(typeof script, 'string');
    if (old) assert.equal(script, old._createDesktopInputScript(action, input));
    assert.equal(script.includes('target_window_not_foreground'), action !== 'move_mouse' && Object.keys(guard).length > 0,
      'Preserve the existing action-specific guard coverage');
    roots++;
  }
const text = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
for (const n of tree.statements.filter(ts.isFunctionDeclaration)) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
console.log('Desktop input foreground guard passed: ' + cases + ' precedence/conversion/getter/error cases, 16 escaping cases and ' + roots + ' complete root scripts; no native execution.');
