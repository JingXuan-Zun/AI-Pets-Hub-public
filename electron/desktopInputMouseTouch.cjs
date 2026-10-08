const { captureScriptFragment } = require('./desktopInputScriptFragments.cjs');

// Injection and diagnostics run consecutively inside the shared click loop.

function createMouseTouchInjection(prepared) {
  const { forceTouchInjectionFallback, holdMs } = prepared;
  return captureScriptFragment`  $touchInjectionResult = $null
  if (${forceTouchInjectionFallback ? '$true' : '$false'}) {
    $touchPoint = New-Object DesktopPetInput+POINT
    $touchPointOk = [DesktopPetInput]::GetCursorPos([ref]$touchPoint)
    $touchTarget = [IntPtr]::Zero
    if ($touchPointOk) {
      $touchTarget = [DesktopPetInput]::WindowFromPoint($touchPoint)
    }
    $touchInitOk = [DesktopPetInput]::InitializeTouchInjection(1, 1)
    $touchInitError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $touchDownOk = $false
    $touchDownError = $null
    $touchUpOk = $false
    $touchUpError = $null
    if ($touchPointOk -and $touchInitOk) {
      $touchDownFlags = 0x00000002 -bor 0x00000004 -bor 0x00000010 -bor 0x00002000 -bor 0x00010000
      $touchDown = [DesktopPetInput]::CreatePrimaryTouch(1, [int]$touchPoint.X, [int]$touchPoint.Y, [uint32]$touchDownFlags, $touchTarget)
      $touchDownOk = [DesktopPetInput]::InjectTouchInput(1, @($touchDown))
      $touchDownError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      Start-Sleep -Milliseconds ${holdMs}
      $touchUpFlags = 0x00000002 -bor 0x00002000 -bor 0x00040000
      $touchUp = [DesktopPetInput]::CreatePrimaryTouch(1, [int]$touchPoint.X, [int]$touchPoint.Y, [uint32]$touchUpFlags, $touchTarget)
      $touchUpOk = [DesktopPetInput]::InjectTouchInput(1, @($touchUp))
      $touchUpError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    }
`;
}

function createMouseTouchDiagnostics() {
  return captureScriptFragment`    $touchInjectionResult = @{
      stage = 'touch_injection'
      index = $i + 1
      ok = [bool]($touchDownOk -and $touchUpOk)
      cursorOk = [bool]$touchPointOk
      x = [int]$touchPoint.X
      y = [int]$touchPoint.Y
      targetHwnd = [int64]$touchTarget.ToInt64()
      initOk = [bool]$touchInitOk
      initLastError = [int]$touchInitError
      downOk = [bool]$touchDownOk
      downLastError = if ($touchDownError -eq $null) { $null } else { [int]$touchDownError }
      upOk = [bool]$touchUpOk
      upLastError = if ($touchUpError -eq $null) { $null } else { [int]$touchUpError }
    }
    $inputBackendStageResults += $touchInjectionResult
  }
`;
}

module.exports = { createMouseTouchInjection, createMouseTouchDiagnostics };
