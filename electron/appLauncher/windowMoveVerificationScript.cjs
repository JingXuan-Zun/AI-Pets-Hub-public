

const windowMoveVerificationScript = String.raw`$retryMoveAttempted = $false

if ($moved -and -not $verified) {
  $retryMoveAttempted = $true
  [void][DesktopPetWindowMove]::ShowWindow($handle, 9)
  Start-Sleep -Milliseconds 120
  $moved = [DesktopPetWindowMove]::SetWindowPos($handle, [IntPtr]::Zero, [int]$nextX, [int]$nextY, [int]$moveWidth, [int]$moveHeight, 0x0004)
  Start-Sleep -Milliseconds 260
  if ($moved -and $wasMaximized) {
    [void][DesktopPetWindowMove]::ShowWindow($handle, 3)
    Start-Sleep -Milliseconds 220
    $maximizedRestored = [DesktopPetWindowMove]::IsZoomed($handle)
  }
  $afterBounds = Get-DesktopPetWindowBounds $handle
  $verified = Test-DesktopPetBoundsInsideTarget $afterBounds
}

@{
  ok = [bool]$moved
  moved = [bool]$moved
  verified = [bool]$verified
  wasMaximized = [bool]$wasMaximized
  maximizedRestored = [bool]$maximizedRestored
  retryMoveAttempted = [bool]$retryMoveAttempted
  processName = $targetProcess.ProcessName
  title = $match.Title
  pid = $match.Pid
  hwnd = $match.Hwnd
  matchReason = $match.MatchReason
  matchCount = @($matches).Count
  queryCandidates = @($candidateQueries)
  fromBounds = $beforeBounds
  targetDisplay = @{
    deviceName = [string]$targetScreen.DeviceName
    primary = [bool]$targetScreen.Primary
    bounds = @{
      x = [int]$targetScreen.Bounds.X
      y = [int]$targetScreen.Bounds.Y
      width = [int]$targetScreen.Bounds.Width
      height = [int]$targetScreen.Bounds.Height
    }
    workArea = @{
      x = [int]$targetScreen.WorkingArea.X
      y = [int]$targetScreen.WorkingArea.Y
      width = [int]$targetScreen.WorkingArea.Width
      height = [int]$targetScreen.WorkingArea.Height
    }
  }
  toBounds = $afterBounds
  query = $query
} | ConvertTo-Json -Depth 8 -Compress
`;

module.exports = { windowMoveVerificationScript };
