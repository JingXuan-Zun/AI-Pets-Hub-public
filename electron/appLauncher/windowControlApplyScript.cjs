

const windowControlApplyScript = String.raw`$targetScreen = Resolve-DesktopPetTargetScreen $beforeBounds
$targetBounds = Resolve-DesktopPetTargetBounds $beforeBounds $targetScreen
$showResult = $true
$boundsChanged = $false
$stateChanged = $false
$reason = ''

if ($state -eq 'minimized') {
  $showResult = [DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 6)
  $stateChanged = $true
} elseif ($state -eq 'maximized') {
  $showResult = [DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 3)
  $stateChanged = $true
} elseif ($state -eq 'normal') {
  $showResult = [DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 9)
  $stateChanged = $true
}

if ($snap -or $requestedX -ne $null -or $requestedY -ne $null -or $requestedWidth -ne $null -or $requestedHeight -ne $null -or -not [string]::IsNullOrWhiteSpace($targetRole) -or $targetIndex -gt 0 -or -not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
  if ($state -ne 'minimized') {
    [void][DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 9)
    Start-Sleep -Milliseconds 60
    $boundsChanged = [DesktopPetTopLevelWindowEnumerator]::SetWindowPos(
      $handle,
      [IntPtr]::Zero,
      [int]$targetBounds.x,
      [int]$targetBounds.y,
      [int]$targetBounds.width,
      [int]$targetBounds.height,
      0x0004
    )
  } else {
    $reason = 'bounds-change-skipped-while-minimized'
  }
}

Start-Sleep -Milliseconds 180
$afterBounds = Get-DesktopPetWindowBounds $handle
$afterState = Get-DesktopPetWindowState $handle

@{
  ok = [bool]($showResult -and (($boundsChanged -eq $true) -or (-not $snap -and $requestedX -eq $null -and $requestedY -eq $null -and $requestedWidth -eq $null -and $requestedHeight -eq $null -and [string]::IsNullOrWhiteSpace($targetRole) -and $targetIndex -le 0 -and [string]::IsNullOrWhiteSpace($targetDisplayText))))
  controlled = [bool]($showResult -or $boundsChanged)
  stateChanged = [bool]$stateChanged
  boundsChanged = [bool]$boundsChanged
  requestedState = $state
  requestedSnap = $snap
  beforeState = $beforeState
  afterState = $afterState
  processName = $targetWindow.processName
  title = $match.Title
  pid = $match.Pid
  hwnd = $match.Hwnd
  matchReason = $match.MatchReason
  matchCount = @($matches).Count
  reason = $reason
  fromBounds = $beforeBounds
  toBounds = $afterBounds
  targetBounds = $targetBounds
  targetDisplay = (Convert-DesktopPetScreenSummary $targetScreen)
  query = $query
} | ConvertTo-Json -Depth 8 -Compress
`;

module.exports = { windowControlApplyScript };
