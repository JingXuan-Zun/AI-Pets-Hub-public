const { captureScriptFragment } = require('./desktopInputScriptFragments.cjs');

function createMouseInputPositionCheck(options, prepared) {
  const { x, y, button, clicks, preClickDelayMs, expectedTargetHwnd, forceMouseEventFallback } = prepared;
  return captureScriptFragment`$cursorBefore = New-Object DesktopPetInput+POINT
$cursorBeforeOk = [DesktopPetInput]::GetCursorPos([ref]$cursorBefore)
$moveStartedAt = [Diagnostics.Stopwatch]::StartNew()
$cursorSet = [DesktopPetInput]::SetCursorPos(${x}, ${y})
$moveStartedAt.Stop()
$cursorSetError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
$inputBackendStageResults += @{ stage = 'SetCursorPos'; ok = [bool]$cursorSet; elapsedMs = [int]$moveStartedAt.ElapsedMilliseconds; lastError = [int]$cursorSetError }
Start-Sleep -Milliseconds ${preClickDelayMs}
$point = New-Object DesktopPetInput+POINT
$cursorVerified = $false
if ([DesktopPetInput]::GetCursorPos([ref]$point)) {
  $cursorVerified = ([Math]::Abs([int]$point.X - ${x}) -le 2 -and [Math]::Abs([int]$point.Y - ${y}) -le 2)
}
$inputBackendStageResults += @{ stage = 'CursorVerify'; ok = [bool]$cursorVerified; x = [int]$point.X; y = [int]$point.Y }
$pointWindow = [IntPtr]::Zero
$pointRootWindow = [IntPtr]::Zero
$pointWindowMatchesTarget = $null
if ($cursorVerified) {
  $pointWindow = [DesktopPetInput]::WindowFromPoint($point)
  if ($pointWindow -ne [IntPtr]::Zero) {
    $pointRootWindow = [DesktopPetInput]::GetAncestor($pointWindow, 2)
    if ($pointRootWindow -eq [IntPtr]::Zero) {
      $pointRootWindow = $pointWindow
    }
  }
  if (${expectedTargetHwnd} -gt 0) {
    $pointWindowMatchesTarget = ([int64]$pointRootWindow.ToInt64() -eq [int64]${expectedTargetHwnd})
  # A menu, dropdown or popup of the same program is its own top-level window; it still counts.
  if (-not $pointWindowMatchesTarget -and $pointRootWindow -ne [IntPtr]::Zero) {
    $pointPid = [uint32]0
    $targetPid = [uint32]0
    [void][DesktopPetInput]::GetWindowThreadProcessId($pointRootWindow, [ref]$pointPid)
    [void][DesktopPetInput]::GetWindowThreadProcessId([IntPtr][int64]${expectedTargetHwnd}, [ref]$targetPid)
    $pointWindowMatchesTarget = ($pointPid -ne 0 -and $pointPid -eq $targetPid)
  }
    $inputBackendStageResults += @{ stage = 'PointWindowVerify'; ok = [bool]$pointWindowMatchesTarget; pointHwnd = [int64]$pointWindow.ToInt64(); pointRootHwnd = [int64]$pointRootWindow.ToInt64(); expectedHwnd = [int64]${expectedTargetHwnd}; x = [int]$point.X; y = [int]$point.Y }
  } else {
    $inputBackendStageResults += @{ stage = 'PointWindowObserve'; ok = $true; pointHwnd = [int64]$pointWindow.ToInt64(); pointRootHwnd = [int64]$pointRootWindow.ToInt64(); expectedHwnd = 0; x = [int]$point.X; y = [int]$point.Y }
  }
}
if ($cursorVerified -and ${expectedTargetHwnd} -gt 0 -and $pointWindowMatchesTarget -ne $true) {
  $diagnosticStartedAt.Stop()
  @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; cursorSet = $cursorSet; cursorVerified = $cursorVerified; sendInput = $false; sendInputAllOk = $false; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $true; x = [int]$point.X; y = [int]$point.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; failureClassification = 'target_hit_test_mismatch'; stageResults = $inputBackendStageResults; pointWindowHwnd = [int64]$pointWindow.ToInt64(); pointRootWindowHwnd = [int64]$pointRootWindow.ToInt64(); expectedTargetHwnd = [int64]${expectedTargetHwnd}; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} }; error = 'target_hit_test_mismatch' } | ConvertTo-Json -Depth 10 -Compress
  exit 0
}
`;
}

function createMouseInputPositionRecovery(options, prepared) {
  const { x, y, button, clicks, expectedTargetHwnd, forceMouseEventFallback } = prepared;
  return captureScriptFragment`$virtualMoveSent = 0
$virtualMoveError = 0
if (-not $cursorVerified) {
  $absoluteMove = [DesktopPetInput]::CreateAbsoluteMouseMove(${x}, ${y})
  $virtualMoveSent = [DesktopPetInput]::SendInput(1, @($absoluteMove), [Runtime.InteropServices.Marshal]::SizeOf([type][DesktopPetInput+INPUT]))
  $virtualMoveError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Start-Sleep -Milliseconds 40
  $virtualPoint = New-Object DesktopPetInput+POINT
  if ([DesktopPetInput]::GetCursorPos([ref]$virtualPoint)) {
    $cursorVerified = ([Math]::Abs([int]$virtualPoint.X - ${x}) -le 2 -and [Math]::Abs([int]$virtualPoint.Y - ${y}) -le 2)
    $point = $virtualPoint
  }
  $inputBackendStageResults += @{ stage = 'VirtualAbsoluteMove'; ok = [bool]$cursorVerified; sent = [int]$virtualMoveSent; lastError = [int]$virtualMoveError; x = [int]$point.X; y = [int]$point.Y }
}
if (-not $cursorVerified) {
  $diagnosticStartedAt.Stop()
  @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; cursorSet = $cursorSet; cursorVerified = $false; sendInput = $false; sendInputAllOk = $false; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $true; x = [int]$point.X; y = [int]$point.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; failureClassification = 'cursor_target_not_reached'; stageResults = $inputBackendStageResults; setCursorLastError = [int]$cursorSetError; virtualMoveSent = [int]$virtualMoveSent; virtualMoveLastError = [int]$virtualMoveError; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} }; error = 'cursor_target_not_reached' } | ConvertTo-Json -Depth 10 -Compress
  exit 0
}
$pointWindow = [DesktopPetInput]::WindowFromPoint($point)
$pointRootWindow = [DesktopPetInput]::GetAncestor($pointWindow, 2)
if ($pointRootWindow -eq [IntPtr]::Zero) {
  $pointRootWindow = $pointWindow
}
if (${expectedTargetHwnd} -gt 0) {
  $pointWindowMatchesTarget = ([int64]$pointRootWindow.ToInt64() -eq [int64]${expectedTargetHwnd})
  # A menu, dropdown or popup of the same program is its own top-level window; it still counts.
  if (-not $pointWindowMatchesTarget -and $pointRootWindow -ne [IntPtr]::Zero) {
    $pointPid = [uint32]0
    $targetPid = [uint32]0
    [void][DesktopPetInput]::GetWindowThreadProcessId($pointRootWindow, [ref]$pointPid)
    [void][DesktopPetInput]::GetWindowThreadProcessId([IntPtr][int64]${expectedTargetHwnd}, [ref]$targetPid)
    $pointWindowMatchesTarget = ($pointPid -ne 0 -and $pointPid -eq $targetPid)
  }
  $inputBackendStageResults += @{ stage = 'PointWindowVerify'; ok = [bool]$pointWindowMatchesTarget; pointHwnd = [int64]$pointWindow.ToInt64(); pointRootHwnd = [int64]$pointRootWindow.ToInt64(); expectedHwnd = [int64]${expectedTargetHwnd}; x = [int]$point.X; y = [int]$point.Y }
  if ($pointWindowMatchesTarget -ne $true) {
    $diagnosticStartedAt.Stop()
    @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; cursorSet = $cursorSet; cursorVerified = $cursorVerified; sendInput = $false; sendInputAllOk = $false; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $true; x = [int]$point.X; y = [int]$point.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; failureClassification = 'target_hit_test_mismatch'; stageResults = $inputBackendStageResults; pointWindowHwnd = [int64]$pointWindow.ToInt64(); pointRootWindowHwnd = [int64]$pointRootWindow.ToInt64(); expectedTargetHwnd = [int64]${expectedTargetHwnd}; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} }; error = 'target_hit_test_mismatch' } | ConvertTo-Json -Depth 10 -Compress
    exit 0
  }
}
`;
}

module.exports = { createMouseInputPositionCheck, createMouseInputPositionRecovery };
