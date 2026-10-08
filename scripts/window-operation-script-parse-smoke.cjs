const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createInspectWindowUiScript } = require('../electron/appLauncher/inspectWindowUiScript.cjs');
const { createInvokeWindowUiScript } = require('../electron/appLauncher/invokeWindowUiScript.cjs');
const { createMoveWindowToDisplayScript } = require('../electron/appLauncher/moveWindowToDisplayScript.cjs');
const { createControlWindowScript } = require('../electron/appLauncher/controlWindowScript.cjs');
const { createCloseWindowScript } = require('../electron/appLauncher/closeWindowScript.cjs');
const { createFocusExistingAppWindowScript } = require('../electron/appLauncher/focusExistingAppWindowScript.cjs');

if (process.platform !== 'win32') {
  console.log('window operation script parse smoke: skipped outside Windows');
  process.exit(0);
}
const payload = { query: "Fixture'\"\n${literal}", hwnd: 456, pid: 123, targetText: '打开', uiAction: 'set_value',
  value: '中文值', targetRole: 'primary', targetIndex: 0, targetDisplayText: '', preserveSize: true, position: 'center' };
const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
const fixtures = [
  { name: 'inspect', script: createInspectWindowUiScript({ payloadBase64 }) },
  { name: 'invoke', script: createInvokeWindowUiScript({ payloadBase64 }) },
  { name: 'move', script: createMoveWindowToDisplayScript({ payload }) },
  { name: 'control', script: createControlWindowScript({ payload }) },
  { name: 'close', script: createCloseWindowScript({ query: payload.query, hasPid: true, requestedPid: 123, hasHwnd: true, requestedHwnd: 456 }) },
  { name: 'focus', script: createFocusExistingAppWindowScript({ focusCandidates: { processNames: ['Fixture'], titleQueries: [payload.query] }, hasPid: true, requestedPid: 123, hasHwnd: true, requestedHwnd: 456 }) },
];
// ParseInput only creates syntax trees; no generated script, Add-Type, native
// window operation or UI Automation action is executed by this check.
const parser = String.raw`
$fixtures = [Console]::In.ReadToEnd() | ConvertFrom-Json
$failures = @()
foreach ($fixture in $fixtures) {
  $tokens = $null
  $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseInput([string]$fixture.script, [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) {
    $failures += [PSCustomObject]@{ name = $fixture.name; errors = @($errors | ForEach-Object { $_.Message }) }
  }
}
if ($failures.Count -gt 0) { $failures | ConvertTo-Json -Depth 6 -Compress; exit 1 }
Write-Output 'PowerShell parser: PASS'
`;
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', parser], {
  input: JSON.stringify(fixtures), encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024,
});
assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /PowerShell parser: PASS/u);
console.log('window operation script parse smoke: PASS (six complete generated scripts; parser only)');
