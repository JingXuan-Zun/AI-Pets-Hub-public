const { captureScriptFragment } = require('./desktopInputScriptFragments.cjs');
const { createForegroundGuardPowerShell } = require('./desktopInputForegroundGuard.cjs');

function createMouseInputPreflight(options, prepared) {
  const { x, y, button, clicks, forceMouseEventFallback, forceTouchInjectionFallback, shouldKeyboardFallback, keyboardFallback } = prepared;
  return captureScriptFragment`
$processElevated = Test-DesktopPetInputCurrentProcessElevated
$foregroundBefore = Get-DesktopPetInputForegroundSnapshot
${createForegroundGuardPowerShell(options, options.action)}
$targetElevated = $foregroundBefore.elevated
$integrityMismatch = ($processElevated -eq $false -and $targetElevated -eq $true)
if ($integrityMismatch) {
  @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; processElevated = $processElevated; foregroundBefore = $foregroundBefore; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = @('permission_preflight'); failureClassification = 'integrity_level_mismatch'; permissionStatus = 'target_requires_elevation'; foregroundStable = $true; targetElevated = $targetElevated; totalElapsedMs = 0; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} }; error = 'target_requires_elevation' } | ConvertTo-Json -Depth 10 -Compress
  exit 0
}
$diagnosticStartedAt = [Diagnostics.Stopwatch]::StartNew()
$inputPlan = @('SetCursorPos', 'SendInputDownUp')
if (${forceMouseEventFallback ? '$true' : '$false'}) {
  $inputPlan += 'mouse_event_supplement'
} else {
  $inputPlan += 'mouse_event_on_sendinput_failure'
}
if (${forceTouchInjectionFallback ? '$true' : '$false'}) {
  $inputPlan += 'touch_injection_supplement'
}
if (${shouldKeyboardFallback ? '$true' : '$false'}) {
  $inputPlan += 'keyboard_fallback:${keyboardFallback.replace(/'/g, "''")}'
}
$inputBackendStageResults = @()
`;
}

module.exports = { createMouseInputPreflight };
