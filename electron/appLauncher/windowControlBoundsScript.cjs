

const windowControlBoundsScript = String.raw`function Resolve-DesktopPetTargetBounds($beforeBounds, $targetScreen) {
  if ($null -eq $beforeBounds) {
    $beforeBounds = @{ x = 0; y = 0; width = 900; height = 640 }
  }

  $workArea = if ($null -ne $targetScreen) { $targetScreen.WorkingArea } else { $null }
  $baseX = if ($null -ne $workArea) { [int]$workArea.X } else { [int]$beforeBounds.x }
  $baseY = if ($null -ne $workArea) { [int]$workArea.Y } else { [int]$beforeBounds.y }
  $baseWidth = if ($null -ne $workArea) { [int]$workArea.Width } else { [int]$beforeBounds.width }
  $baseHeight = if ($null -ne $workArea) { [int]$workArea.Height } else { [int]$beforeBounds.height }

  $nextX = [int]$beforeBounds.x
  $nextY = [int]$beforeBounds.y
  $nextWidth = [Math]::Max(80, [int]$beforeBounds.width)
  $nextHeight = [Math]::Max(60, [int]$beforeBounds.height)

  if (-not [string]::IsNullOrWhiteSpace($snap)) {
    switch ($snap) {
      'left' {
        $nextX = $baseX; $nextY = $baseY; $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = $baseHeight
      }
      'right' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = $baseHeight; $nextX = $baseX + $baseWidth - $nextWidth; $nextY = $baseY
      }
      'top' {
        $nextX = $baseX; $nextY = $baseY; $nextWidth = $baseWidth; $nextHeight = [Math]::Floor($baseHeight / 2)
      }
      'bottom' {
        $nextWidth = $baseWidth; $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX; $nextY = $baseY + $baseHeight - $nextHeight
      }
      'top-left' {
        $nextX = $baseX; $nextY = $baseY; $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2)
      }
      'top-right' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX + $baseWidth - $nextWidth; $nextY = $baseY
      }
      'bottom-left' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX; $nextY = $baseY + $baseHeight - $nextHeight
      }
      'bottom-right' {
        $nextWidth = [Math]::Floor($baseWidth / 2); $nextHeight = [Math]::Floor($baseHeight / 2); $nextX = $baseX + $baseWidth - $nextWidth; $nextY = $baseY + $baseHeight - $nextHeight
      }
      'center' {
        $nextWidth = [Math]::Min($nextWidth, $baseWidth)
        $nextHeight = [Math]::Min($nextHeight, $baseHeight)
        $nextX = $baseX + [Math]::Floor(($baseWidth - $nextWidth) / 2)
        $nextY = $baseY + [Math]::Floor(($baseHeight - $nextHeight) / 2)
      }
    }
  } elseif (-not [string]::IsNullOrWhiteSpace($targetRole) -or $targetIndex -gt 0 -or -not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
    $nextWidth = [Math]::Min($nextWidth, $baseWidth)
    $nextHeight = [Math]::Min($nextHeight, $baseHeight)
    $nextX = $baseX + [Math]::Floor(($baseWidth - $nextWidth) / 2)
    $nextY = $baseY + [Math]::Floor(($baseHeight - $nextHeight) / 2)
  }

  if ($null -ne $requestedWidth) { $nextWidth = [int]$requestedWidth }
  if ($null -ne $requestedHeight) { $nextHeight = [int]$requestedHeight }
  if ($null -ne $requestedX) { $nextX = if ($coordinateSpace -eq 'display' -and $null -ne $workArea) { $baseX + [int]$requestedX } else { [int]$requestedX } }
  if ($null -ne $requestedY) { $nextY = if ($coordinateSpace -eq 'display' -and $null -ne $workArea) { $baseY + [int]$requestedY } else { [int]$requestedY } }

  $nextWidth = [Math]::Max(80, [int]$nextWidth)
  $nextHeight = [Math]::Max(60, [int]$nextHeight)
  if ($null -ne $workArea) {
    $nextWidth = [Math]::Min($nextWidth, [int]$workArea.Width)
    $nextHeight = [Math]::Min($nextHeight, [int]$workArea.Height)
    $nextX = [Math]::Max([int]$workArea.X, [Math]::Min([int]$nextX, [int]($workArea.X + $workArea.Width - $nextWidth)))
    $nextY = [Math]::Max([int]$workArea.Y, [Math]::Min([int]$nextY, [int]($workArea.Y + $workArea.Height - $nextHeight)))
  }

  return @{
    x = [int]$nextX
    y = [int]$nextY
    width = [int]$nextWidth
    height = [int]$nextHeight
  }
}

$normalizedQuery = Normalize-DesktopPetText $query
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $title = [string]$window.title
  $normalizedTitle = Normalize-DesktopPetText $title
  $normalizedProcess = Normalize-DesktopPetText $window.processName
  $score = 0
  $reason = ''

  if ($requestedHwnd -gt 0 -and [int64]$window.hwnd -eq $requestedHwnd) {
    $score = 220
    $reason = 'hwnd'
  } elseif ($requestedPid -gt 0 -and [int]$window.pid -eq $requestedPid) {
    $score = 200
    $reason = 'pid'
  } elseif ($normalizedQuery) {
    if ($normalizedProcess -eq $normalizedQuery) {
      $score = 170
      $reason = 'process-exact'
    } elseif ($normalizedTitle -eq $normalizedQuery) {
      $score = 150
      $reason = 'title-exact'
    } elseif ($normalizedProcess.Contains($normalizedQuery)) {
      $score = 120
      $reason = 'process-contains'
    } elseif ($normalizedTitle.Contains($normalizedQuery)) {
      $score = 100
      $reason = 'title-contains'
    }
  }

  if ($score -gt 0) {
    $score += [Math]::Max(0, 40 - [int]$window.topLevelOrder)
    $matches += [PSCustomObject]@{
      Process = $window
      Handle = ([IntPtr]$window.handle)
      Hwnd = [int64]$window.hwnd
      Pid = [int]$window.pid
      Score = $score
      MatchReason = $reason
      Title = $title
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match -and $fallbackToActiveWindow) {
  $foregroundHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  if ($foregroundHandle -ne [IntPtr]::Zero -and [DesktopPetTopLevelWindowEnumerator]::IsWindow($foregroundHandle) -and [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible($foregroundHandle)) {
    $foregroundPid = [uint32]0
    [void][DesktopPetTopLevelWindowEnumerator]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundPid)
    $foregroundProcess = $null
    try {
      $foregroundProcess = Get-Process -Id ([int]$foregroundPid) -ErrorAction Stop
    } catch {
      $foregroundProcess = $null
    }

    if ($null -ne $foregroundProcess) {
      $match = [PSCustomObject]@{
        Process = [PSCustomObject]@{
          bounds = (Get-DesktopPetWindowBounds $foregroundHandle)
          handle = $foregroundHandle
          hwnd = [int64]$foregroundHandle.ToInt64()
          pid = [int]$foregroundPid
          processName = [string]$foregroundProcess.ProcessName
          title = [DesktopPetTopLevelWindowEnumerator]::ReadWindowText($foregroundHandle)
        }
        Handle = $foregroundHandle
        Hwnd = [int64]$foregroundHandle.ToInt64()
        Pid = [int]$foregroundPid
        Score = 80
        MatchReason = 'foreground-fallback'
        Title = [DesktopPetTopLevelWindowEnumerator]::ReadWindowText($foregroundHandle)
      }
    }
  }
}

if ($null -eq $match) {
  @{
    ok = $false
    controlled = $false
    reason = 'no-window-match'
    query = $query
    matchCount = 0
  } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

$handle = [IntPtr]$match.Handle
$targetWindow = $match.Process
$beforeBounds = Get-DesktopPetWindowBounds $handle
$beforeState = Get-DesktopPetWindowState $handle
`;

module.exports = { windowControlBoundsScript };
