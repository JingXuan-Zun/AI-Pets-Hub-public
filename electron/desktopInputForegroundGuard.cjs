const { normalizeNumber } = require('./desktopInputRules.cjs');

function escapePowerShellSingleQuotedString(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function createForegroundGuardPowerShell(options, action) {
  const expectedHwnd = normalizeNumber(options.expectedForegroundHwnd ?? options.expectedHwnd ?? options.hwnd ?? options.windowHandle);
  const expectedPid = normalizeNumber(options.expectedForegroundPid ?? options.expectedPid ?? options.pid);
  const expectedTitle = String(options.expectedForegroundTitle ?? options.windowTitle ?? options.title ?? '').trim();
  const expectedProcessName = String(options.expectedForegroundProcessName ?? options.processName ?? '').trim();
  if (expectedHwnd === null && expectedPid === null && !expectedTitle && !expectedProcessName) {
    return '';
  }

  return String.raw`
$expectedForegroundHwnd = ${expectedHwnd === null ? '0' : Math.round(expectedHwnd)}
$expectedForegroundPid = ${expectedPid === null ? '0' : Math.round(expectedPid)}
$expectedForegroundTitle = '${escapePowerShellSingleQuotedString(expectedTitle)}'
$expectedForegroundProcessName = '${escapePowerShellSingleQuotedString(expectedProcessName)}'
$foregroundGuard = Get-DesktopPetInputForegroundSnapshot
$foregroundGuardOk = $true
$foregroundGuardReason = ''
if ($expectedForegroundHwnd -gt 0 -and [int64]$foregroundGuard.hwnd -ne [int64]$expectedForegroundHwnd) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected hwnd $expectedForegroundHwnd but foreground hwnd was $($foregroundGuard.hwnd)"
} elseif ($expectedForegroundPid -gt 0 -and [int]$foregroundGuard.pid -ne [int]$expectedForegroundPid) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected pid $expectedForegroundPid but foreground pid was $($foregroundGuard.pid)"
} elseif ($expectedForegroundProcessName.Length -gt 0 -and [string]::Compare([string]$foregroundGuard.processName, $expectedForegroundProcessName, $true) -ne 0) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected process $expectedForegroundProcessName but foreground process was $($foregroundGuard.processName)"
} elseif ($expectedForegroundTitle.Length -gt 0 -and -not ([string]$foregroundGuard.title).ToLowerInvariant().Contains($expectedForegroundTitle.ToLowerInvariant())) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected title containing $expectedForegroundTitle but foreground title was $($foregroundGuard.title)"
}
if (-not $foregroundGuardOk) {
  @{ ok = $false; action = '${escapePowerShellSingleQuotedString(action)}'; error = 'target_window_not_foreground'; foregroundBefore = $foregroundGuard; expectedForeground = @{ hwnd = $expectedForegroundHwnd; pid = $expectedForegroundPid; processName = $expectedForegroundProcessName; title = $expectedForegroundTitle }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; failureClassification = 'target_window_not_foreground'; foregroundProtectionOk = $false; foregroundProtectionReason = $foregroundGuardReason } } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
`;
}

module.exports = { escapePowerShellSingleQuotedString, createForegroundGuardPowerShell };
