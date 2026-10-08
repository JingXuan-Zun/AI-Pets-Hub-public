const { captureScriptFragment } = require('./desktopInputScriptFragments.cjs');

// Keyboard fallback and final diagnostics run after the click loop has closed.

function createMouseKeyboardFallback(prepared) {
  const { shouldKeyboardFallback, keyboardFallback } = prepared;
  return captureScriptFragment`$keyboardFallbackUsed = $false
if (${shouldKeyboardFallback ? '$true' : '$false'}) {
  $keyboardFallbackUsed = $true
  $fallbackKey = '${keyboardFallback.replace(/'/g, "''")}'
  if ($fallbackKey -eq 'enter') {
    [DesktopPetInput]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [DesktopPetInput]::keybd_event(0x0D, 0, 0x0002, [UIntPtr]::Zero)
    $inputBackendStageResults += @{ stage = 'KeyboardFallback'; ok = $true; key = 'enter' }
  } elseif ($fallbackKey -eq 'space') {
    [DesktopPetInput]::keybd_event(0x20, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [DesktopPetInput]::keybd_event(0x20, 0, 0x0002, [UIntPtr]::Zero)
    $inputBackendStageResults += @{ stage = 'KeyboardFallback'; ok = $true; key = 'space' }
  } else {
    $inputBackendStageResults += @{ stage = 'KeyboardFallback'; ok = $false; key = $fallbackKey; reason = 'unsupported_key' }
  }
}
`;
}

function createMouseResultDiagnostics(options, prepared) {
  const { x, y, button, clicks, preClickDelayMs, holdMs, intervalMs, keyboardFallback, forceMouseEventFallback, forceTouchInjectionFallback } = prepared;
  return captureScriptFragment`$cursorAfter = New-Object DesktopPetInput+POINT
$cursorAfterOk = [DesktopPetInput]::GetCursorPos([ref]$cursorAfter)
$foregroundAfter = Get-DesktopPetInputForegroundSnapshot
$diagnosticStartedAt.Stop()
$foregroundStable = ($foregroundBefore.hwnd -ne 0 -and $foregroundBefore.hwnd -eq $foregroundAfter.hwnd)
$failureClassification = if (-not $cursorSet -and -not $cursorVerified) { 'cursor_move_failed' } elseif (-not $cursorVerified) { 'cursor_not_verified' } elseif (-not $sendInputAllOk) { 'sendinput_failed' } elseif (-not $foregroundStable) { 'foreground_changed' } elseif ($sendInputOk -and $foregroundStable) { 'injected_no_effect_possible' } else { 'unknown' }
@{ ok = [bool]($cursorVerified -and $sendInputOk); action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; preClickDelayMs = ${preClickDelayMs}; holdMs = ${holdMs}; intervalMs = ${intervalMs}; cursorSet = $cursorSet; cursorVerified = $cursorVerified; sendInput = $sendInputOk; sendInputAllOk = $sendInputAllOk; sendInputAttempts = $sendInputAttempts; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $cursorAfterOk; x = [int]$cursorAfter.X; y = [int]$cursorAfter.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; stageResults = $inputBackendStageResults; failureClassification = $failureClassification; foregroundStable = $foregroundStable; keyboardFallbackUsed = $keyboardFallbackUsed; keyboardFallback = '${keyboardFallback.replace(/'/g, "''")}'; moveElapsedMs = [int]$moveStartedAt.ElapsedMilliseconds; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; downUpStrategy = 'SendInput'; fallbackStrategy = 'mouse_event_on_sendinput_failure'; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'}; forceTouchInjectionFallback = ${forceTouchInjectionFallback ? '$true' : '$false'}; virtualMoveSent = [int]$virtualMoveSent; virtualMoveLastError = [int]$virtualMoveError } } | ConvertTo-Json -Depth 10 -Compress
`;
}

module.exports = { createMouseKeyboardFallback, createMouseResultDiagnostics };
