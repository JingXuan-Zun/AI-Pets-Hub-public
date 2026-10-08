

const windowMovePlacementScript = String.raw`$targetScreen = $null

if ($targetRole -eq 'primary') {
  $targetScreen = $screens | Where-Object { $_.Primary } | Select-Object -First 1
} elseif ($targetRole -eq 'secondary') {
  $targetScreen = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
} elseif ($targetIndex -gt 0 -and $targetIndex -le $screens.Count) {
  $targetScreen = $screens[$targetIndex - 1]
} elseif (-not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
  $normalizedDisplayText = Normalize-DesktopPetDisplayText $targetDisplayText
  $targetScreen = $screens | Where-Object {
    $deviceName = Normalize-DesktopPetDisplayText $_.DeviceName
    $deviceName -eq $normalizedDisplayText -or $deviceName.Contains($normalizedDisplayText) -or $normalizedDisplayText.Contains($deviceName)
  } | Select-Object -First 1
}

if ($null -eq $targetScreen) {
  @{
    ok = $false
    moved = $false
    reason = 'target-display-not-found'
    query = $query
    displays = @($screens | ForEach-Object {
      @{
        deviceName = [string]$_.DeviceName
        primary = [bool]$_.Primary
        bounds = @{
          x = [int]$_.Bounds.X
          y = [int]$_.Bounds.Y
          width = [int]$_.Bounds.Width
          height = [int]$_.Bounds.Height
        }
        workArea = @{
          x = [int]$_.WorkingArea.X
          y = [int]$_.WorkingArea.Y
          width = [int]$_.WorkingArea.Width
          height = [int]$_.WorkingArea.Height
        }
      }
    })
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$targetX = [int]$targetScreen.WorkingArea.X
$targetY = [int]$targetScreen.WorkingArea.Y
$targetWidth = [int]$targetScreen.WorkingArea.Width
$targetHeight = [int]$targetScreen.WorkingArea.Height

$candidateQueries = @()
if (-not [string]::IsNullOrWhiteSpace($query)) {
  $candidateQueries += [string]$query
}
$candidateQueries += $queryCandidates
$candidateQueries = @($candidateQueries | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Select-Object -Unique)
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $handle = [IntPtr]$window.Handle
  $title = [string]$window.Title
  $normalizedTitle = Normalize-DesktopPetText $title
  $normalizedProcess = Normalize-DesktopPetText $window.ProcessName
  $bounds = $window.Bounds
  $score = 0
  $reason = ''
  $identityRequested = $requestedHwnd -gt 0 -or $requestedPid -gt 0
  $hwndMatches = $requestedHwnd -le 0 -or [int64]$window.Hwnd -eq $requestedHwnd
  $pidMatches = $requestedPid -le 0 -or [int]$window.Pid -eq $requestedPid
  $semanticMatches = Test-DesktopPetWindowMatchesCandidate $window.ProcessName $title $candidateQueries

  if ($identityRequested) {
    if (-not $hwndMatches -or -not $pidMatches -or ($candidateQueries.Count -gt 0 -and -not $semanticMatches)) {
      continue
    }
    $score = 240
    $reason = if ($requestedHwnd -gt 0 -and $requestedPid -gt 0) { 'hwnd+pid+semantic' } elseif ($requestedHwnd -gt 0) { 'hwnd+semantic' } else { 'pid+semantic' }
  } else {
    $queryIndex = 0
    foreach ($candidateQuery in $candidateQueries) {
      $normalizedQuery = Normalize-DesktopPetText $candidateQuery
      if (-not $normalizedQuery) {
        $queryIndex += 1
        continue
      }

      $candidateScore = 0
      $candidateReason = ''
      if ($normalizedProcess -eq $normalizedQuery) {
        $candidateScore = 170
        $candidateReason = 'process-exact'
      } elseif ($normalizedTitle -eq $normalizedQuery) {
        $candidateScore = 150
        $candidateReason = 'title-exact'
      } elseif ($normalizedProcess.Contains($normalizedQuery)) {
        $candidateScore = 120
        $candidateReason = 'process-contains'
      } elseif ($normalizedTitle.Contains($normalizedQuery)) {
        $candidateScore = 100
        $candidateReason = 'title-contains'
      }

      if ($candidateScore -gt 0) {
        $candidateScore += [Math]::Max(0, 30 - ($queryIndex * 4))
        if ($candidateScore -gt $score) {
          $score = $candidateScore
          $reason = "$candidateReason query=$candidateQuery"
        }
      }

      $queryIndex += 1
    }
  }

  if ($score -gt 0) {
    $score += [Math]::Max(0, 40 - [int]$window.TopLevelOrder)
    $matches += [PSCustomObject]@{
      Process = $window.Process
      Handle = $handle
      Hwnd = [int64]$window.Hwnd
      Pid = [int]$window.Pid
      Score = $score
      MatchReason = $reason
      Title = $title
      Bounds = $bounds
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match) {
  $foregroundHandle = [DesktopPetWindowMove]::GetForegroundWindow()
  if ($fallbackToActiveWindow -and $foregroundHandle -ne [IntPtr]::Zero -and [DesktopPetWindowMove]::IsWindow($foregroundHandle) -and [DesktopPetWindowMove]::IsWindowVisible($foregroundHandle)) {
    $foregroundPid = [uint32]0
    [void][DesktopPetWindowMove]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundPid)
    $foregroundProcess = $null
    try {
      $foregroundProcess = Get-Process -Id ([int]$foregroundPid) -ErrorAction Stop
    } catch {
      $foregroundProcess = $null
    }

    if ($null -ne $foregroundProcess) {
      $foregroundTitle = Get-DesktopPetWindowTitle $foregroundHandle
      if (Test-DesktopPetWindowMatchesCandidate $foregroundProcess.ProcessName $foregroundTitle $candidateQueries) {
        $match = [PSCustomObject]@{
          Process = $foregroundProcess
          Handle = $foregroundHandle
          Hwnd = [int64]$foregroundHandle.ToInt64()
          Pid = [int]$foregroundPid
          Score = 80
          MatchReason = 'foreground-fallback'
          Title = $foregroundTitle
          Bounds = (Get-DesktopPetWindowBounds $foregroundHandle)
        }
      }
    }
  }
}

if ($null -eq $match) {
  @{
    ok = $false
    moved = $false
    reason = 'no-window-match'
    query = $query
    matchCount = 0
  } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

$targetProcess = $match.Process
$handle = [IntPtr]$match.Handle
$beforeBounds = $match.Bounds
$wasMaximized = [DesktopPetWindowMove]::IsZoomed($handle)
$moveWidth = if ($preserveSize -and $beforeBounds -and $beforeBounds.width -gt 0) { [int]$beforeBounds.width } else { [Math]::Min(1100, [Math]::Max(320, $targetWidth)) }
$moveHeight = if ($preserveSize -and $beforeBounds -and $beforeBounds.height -gt 0) { [int]$beforeBounds.height } else { [Math]::Min(760, [Math]::Max(240, $targetHeight)) }
$moveWidth = [Math]::Max(120, [Math]::Min($moveWidth, $targetWidth))
$moveHeight = [Math]::Max(80, [Math]::Min($moveHeight, $targetHeight))

if ($position -eq 'top-left') {
  $nextX = $targetX
  $nextY = $targetY
} else {
  $nextX = $targetX + [Math]::Max(0, [Math]::Floor(($targetWidth - $moveWidth) / 2))
  $nextY = $targetY + [Math]::Max(0, [Math]::Floor(($targetHeight - $moveHeight) / 2))
}

[void][DesktopPetWindowMove]::ShowWindow($handle, 9)
Start-Sleep -Milliseconds 60
$moved = [DesktopPetWindowMove]::SetWindowPos($handle, [IntPtr]::Zero, [int]$nextX, [int]$nextY, [int]$moveWidth, [int]$moveHeight, 0x0004)
Start-Sleep -Milliseconds 180
$maximizedRestored = $false
if ($moved -and $wasMaximized) {
  [void][DesktopPetWindowMove]::ShowWindow($handle, 3)
  Start-Sleep -Milliseconds 220
  $maximizedRestored = [DesktopPetWindowMove]::IsZoomed($handle)
}
$afterBounds = Get-DesktopPetWindowBounds $handle
$verified = Test-DesktopPetBoundsInsideTarget $afterBounds
`;

module.exports = { windowMovePlacementScript };
