const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const rootFile = path.resolve(__dirname, '../electron/desktopInputService.cjs');
const { createBaseInputPowerShell } = require('../electron/desktopInputBaseScript.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldBase;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createBaseInputPowerShell');
  oldBase = new Function(node.getText(tree) + '\nreturn createBaseInputPowerShell;')();
  const current = fs.readFileSync(rootFile, 'utf8');
  const next = ts.createSourceFile(rootFile, current, ts.ScriptTarget.Latest, true);
  assert.deepEqual(next.statements.filter(n => !n.getText(next).includes("require('./desktopInputBaseScript.cjs')")).map(n => n.getText(next)),
    tree.statements.filter(n => n !== node).map(n => n.getText(tree)), 'Only the base template and import move');
}
function bodyOutcome(create, kind) {
  const trace = [], failure = Error('body conversion');
  const body = kind === 'object' || kind === 'throw' ? {
    [Symbol.toPrimitive](hint) { trace.push(hint); if (kind === 'throw') throw failure; return '$body = "中文"'; },
  } : kind;
  try { return { value: create(body), trace }; }
  catch (error) {
    if (kind === 'throw') assert.strictEqual(error, failure);
    return { error: [error.name, error.message], trace };
  }
}
function root(original) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', original ? baseline : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id.startsWith('./')) return require(path.resolve(path.dirname(rootFile), id));
    if (id === 'child_process') return { execFile() { throw Error('Unexpected native execution'); } };
    if (id === 'fs') return { mkdtempSync() { throw Error('Unexpected filesystem access'); } };
    if (id === 'os') return {}; if (id === 'path') return path;
    throw Error(id);
  }, module, module.exports, { platform: 'win32' });
  return module.exports;
}
for (const name of ['desktopInputNativeInterop.cjs', 'desktopInputBaseScript.cjs']) {
  const file = path.resolve(__dirname, '../electron', name), text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300, name);
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const n of tree.statements.filter(ts.isFunctionDeclaration)) {
    assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  }
}
const kinds = [undefined, null, false, 0, 2n, '', '$ok = $true', '中文😀', '\\path\n\r\t', '${literal}`', Symbol('body'), 'object', 'throw'];
for (const kind of kinds) {
  const actual = bodyOutcome(createBaseInputPowerShell, kind);
  if (baseline) assert.deepEqual(actual, bodyOutcome(oldBase, kind));
}
const api = root(false), previous = baseline ? root(true) : null;
const request = { x: -50, y: 40, nativeScreenX: -50, nativeScreenY: 40, fromX: -50, fromY: 40,
  fromNativeScreenX: -50, fromNativeScreenY: 40, toX: 250, toY: 130, toNativeScreenX: 250, toNativeScreenY: 130,
  text: "中文'😀+{}", keys: '{ENTER}', hotkey: 'ctrl+alt+f12' };
const guards = [{}, { expectedForegroundHwnd: 123, expectedForegroundPid: 45 },
  { expectedForegroundTitle: "标题'O", expectedForegroundProcessName: 'app' },
  { expectedHwnd: null, expectedPid: 'bad', windowTitle: ' 标题 ', processName: '' },
  { hwnd: 77.5, pid: 8.5, title: '${literal}', processName: "proc'" }];
let scripts = 0;
const fixtures = [];
const hash = crypto.createHash('sha256');
for (const action of ['move_mouse', 'click', 'double_click', 'right_click', 'type_text', 'send_keys', 'hotkey', 'drag', 'unknown'])
  for (const button of ['left', 'right', 'middle', 'unknown']) for (const guard of guards) {
    const options = { ...request, button, ...guard, forceTouchInjectionFallback: true, forceMouseEventFallback: true };
    const result = api._createDesktopInputScript(action, options);
    if (previous) assert.equal(result, previous._createDesktopInputScript(action, options));
    if (result !== null) {
      fixtures.push({ name: action + '-' + button + '-' + scripts, script: result });
      assert.ok(result.startsWith("\n$ErrorActionPreference = 'Stop'\n"));
      assert.equal((result.match(/public static class DesktopPetInput/g) || []).length, 1);
      assert.ok(result.indexOf('Get-DesktopPetInputForegroundSnapshot') < result.indexOf('ConvertTo-Json'));
    }
    hash.update(JSON.stringify(result)); scripts++;
  }
const fingerprint = hash.digest('hex');
assert.equal(fingerprint, '50a69a3d636b74bd5e20f4e8fa65902ce090d197bf1b4fd1814be7be40c71167', 'Complete scripts retain the reviewed baseline');
const service = api.createDesktopInputService({ screen: { dipToScreenPoint: ({ x, y }) => ({ x: x * 2, y: y * 2 }) } });
for (const action of ['click', 'drag', 'move_mouse']) {
  const projected = service._createNativeScreenInputRequest(action, request);
  const script = api._createDesktopInputScript(action, projected);
  if (previous) assert.equal(script, previous._createDesktopInputScript(action, projected));
  assert.ok(script.includes('DesktopPetInput'));
}
if (process.platform === 'win32') {
  // ParseInput builds syntax trees only. Generated Add-Type/native actions are never executed.
  const parser = String.raw`
$fixtures = [Console]::In.ReadToEnd() | ConvertFrom-Json
$failures = @()
foreach ($fixture in $fixtures) {
  $tokens = $null
  $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseInput([string]$fixture.script, [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) { $failures += @{ name = $fixture.name; errors = @($errors | ForEach-Object { $_.Message }) } }
}
if ($failures.Count -gt 0) { $failures | ConvertTo-Json -Depth 6 -Compress; exit 1 }
Write-Output 'PowerShell parser: PASS'
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', parser], {
    input: JSON.stringify(fixtures), encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PowerShell parser: PASS/);
}
console.log('Desktop input base script passed: ' + kinds.length + ' body conversion cases, ' + scripts + ' complete script fingerprints and 3 real-service projections; no native execution.');
