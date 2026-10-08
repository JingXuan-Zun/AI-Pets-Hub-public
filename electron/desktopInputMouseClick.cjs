const { captureScriptFragment } = require('./desktopInputScriptFragments.cjs');

// SendInput opens the shared click loop; completion closes it after both fallbacks.

function createMouseClickSendInput(prepared) {
  const { clicks, downFlag, upFlag, holdMs } = prepared;
  return captureScriptFragment`$sendInputOk = $false
$sendInputAllOk = $true
$sendInputAttempts = @()
for ($i = 0; $i -lt ${clicks}; $i++) {
  $foregroundBeforeDown = Get-DesktopPetInputForegroundSnapshot
  $cursorBeforeDown = New-Object DesktopPetInput+POINT
  $cursorBeforeDownOk = [DesktopPetInput]::GetCursorPos([ref]$cursorBeforeDown)
  $down = [DesktopPetInput]::CreateMouseInput(${downFlag})
  $up = [DesktopPetInput]::CreateMouseInput(${upFlag})
  $downStartedAt = [Diagnostics.Stopwatch]::StartNew()
  $sentDown = [DesktopPetInput]::SendInput(1, @($down), [Runtime.InteropServices.Marshal]::SizeOf([type][DesktopPetInput+INPUT]))
  $downError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  $downStartedAt.Stop()
  $foregroundAfterDown = Get-DesktopPetInputForegroundSnapshot
  $cursorAfterDown = New-Object DesktopPetInput+POINT
  $cursorAfterDownOk = [DesktopPetInput]::GetCursorPos([ref]$cursorAfterDown)
  Start-Sleep -Milliseconds ${holdMs}
  $foregroundBeforeUp = Get-DesktopPetInputForegroundSnapshot
  $cursorBeforeUp = New-Object DesktopPetInput+POINT
  $cursorBeforeUpOk = [DesktopPetInput]::GetCursorPos([ref]$cursorBeforeUp)
  $upStartedAt = [Diagnostics.Stopwatch]::StartNew()
  $sentUp = [DesktopPetInput]::SendInput(1, @($up), [Runtime.InteropServices.Marshal]::SizeOf([type][DesktopPetInput+INPUT]))
  $upError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  $upStartedAt.Stop()
  $foregroundAfterUp = Get-DesktopPetInputForegroundSnapshot
  $cursorAfterUp = New-Object DesktopPetInput+POINT
  $cursorAfterUpOk = [DesktopPetInput]::GetCursorPos([ref]$cursorAfterUp)
`;
}

function createMouseClickFallback(prepared) {
  const { forceMouseEventFallback, downFlag, upFlag, holdMs } = prepared;
  return captureScriptFragment`  $attemptOk = ($sentDown -eq 1 -and $sentUp -eq 1)
  $fallbackMouseEventUsed = $false
  if ($sentDown -eq 1 -and $sentUp -eq 1 -and -not ${forceMouseEventFallback ? '$true' : '$false'}) {
    $sendInputOk = $true
  } else {
    if ($sentDown -ne 1 -or $sentUp -ne 1) {
      $sendInputAllOk = $false
    }
    $fallbackMouseEventUsed = $true
    [DesktopPetInput]::mouse_event(${downFlag}, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds ${holdMs}
    [DesktopPetInput]::mouse_event(${upFlag}, 0, 0, 0, [UIntPtr]::Zero)
    if ($sentDown -eq 1 -and $sentUp -eq 1) {
      $sendInputOk = $true
    }
  }
  $inputBackendStageResults += @{ stage = 'SendInputDownUp'; index = $i + 1; ok = [bool]$attemptOk; downSent = [int]$sentDown; upSent = [int]$sentUp; downLastError = [int]$downError; upLastError = [int]$upError }
  if ($fallbackMouseEventUsed) {
    $mouseEventReason = 'sendinput_failure'
    if ($sentDown -eq 1 -and $sentUp -eq 1) {
      $mouseEventReason = 'forced_supplement'
    }
    $inputBackendStageResults += @{ stage = 'mouse_event'; index = $i + 1; ok = $true; reason = $mouseEventReason }
  }
`;
}

function createMouseClickCompletion(prepared) {
  const { intervalMs } = prepared;
  return captureScriptFragment`  $sendInputAttempts += @{
    index = $i + 1
    downSent = [int]$sentDown
    downOk = ($sentDown -eq 1)
    downLastError = [int]$downError
    downElapsedMs = [int]$downStartedAt.ElapsedMilliseconds
    foregroundBeforeDown = $foregroundBeforeDown
    foregroundAfterDown = $foregroundAfterDown
    foregroundBeforeUp = $foregroundBeforeUp
    foregroundAfterUp = $foregroundAfterUp
    cursorBeforeDown = @{ ok = $cursorBeforeDownOk; x = [int]$cursorBeforeDown.X; y = [int]$cursorBeforeDown.Y }
    cursorAfterDown = @{ ok = $cursorAfterDownOk; x = [int]$cursorAfterDown.X; y = [int]$cursorAfterDown.Y }
    cursorBeforeUp = @{ ok = $cursorBeforeUpOk; x = [int]$cursorBeforeUp.X; y = [int]$cursorBeforeUp.Y }
    cursorAfterUp = @{ ok = $cursorAfterUpOk; x = [int]$cursorAfterUp.X; y = [int]$cursorAfterUp.Y }
    upSent = [int]$sentUp
    upOk = ($sentUp -eq 1)
    upLastError = [int]$upError
    upElapsedMs = [int]$upStartedAt.ElapsedMilliseconds
    ok = $attemptOk
    fallbackMouseEventUsed = $fallbackMouseEventUsed
    touchInjection = $touchInjectionResult
  }
  Start-Sleep -Milliseconds ${intervalMs}
}
`;
}

module.exports = { createMouseClickSendInput, createMouseClickFallback, createMouseClickCompletion };
