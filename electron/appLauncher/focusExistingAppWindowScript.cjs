const { createTopLevelWindowEnumeratorPowerShell } = require('./topLevelWindowEnumeratorPowerShell.cjs');

function createFocusExistingAppWindowScript({ focusCandidates, hasPid, requestedPid, hasHwnd, requestedHwnd }) {
  return [
    String.raw`
$ErrorActionPreference = 'Stop'
$processNames = @'
`,
    String.raw`${JSON.stringify(focusCandidates.processNames)}`,
    String.raw`
'@ | ConvertFrom-Json
$titleQueries = @'
`,
    String.raw`${JSON.stringify(focusCandidates.titleQueries)}`,
    String.raw`
'@ | ConvertFrom-Json
$requestedPid = `,
    String.raw`${hasPid ? Math.round(requestedPid) : 0}`,
    String.raw`
$requestedHwnd = `,
    String.raw`${hasHwnd ? Math.round(requestedHwnd) : 0}`,
    String.raw`

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class DesktopPetWindowFocus {
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\(\)\[\]\{\}"''._\-:：,，。、【】（）「」『』]+', ''
}

`,
    String.raw`${createTopLevelWindowEnumeratorPowerShell()}`,
    String.raw`

$normalizedProcessNames = @($processNames | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
$normalizedTitleQueries = @($titleQueries | ForEach-Object { Normalize-DesktopPetText $_ } | Where-Object { $_ })
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $processName = ([string]$window.processName).Trim().ToLowerInvariant()
  $title = Normalize-DesktopPetText $window.title
  $processMatch = $normalizedProcessNames -contains $processName
  $titleMatch = $false

  foreach ($titleQuery in $normalizedTitleQueries) {
    if ($title -and $title.Contains($titleQuery)) {
      $titleMatch = $true
      break
    }
  }

  $handleMatch = ($requestedHwnd -gt 0 -and [int64]$window.hwnd -eq $requestedHwnd)
  $pidMatch = ($requestedPid -gt 0 -and [int64]$window.pid -eq $requestedPid)
  if ($handleMatch -or $pidMatch -or $processMatch -or $titleMatch) {
    $matches += [PSCustomObject]@{
      Process = $window
      Score = $(if ($handleMatch) { 10000 } elseif ($pidMatch) { 1000 } elseif ($processMatch) { 100 } else { 60 }) + [Math]::Max(0, 40 - [int]$window.topLevelOrder)
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match) {
  @{ ok = $false; reason = 'no-window-match' } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}

$targetProcess = $match.Process
$handle = [IntPtr]$targetProcess.handle
if ([DesktopPetTopLevelWindowEnumerator]::IsIconic($handle)) {
  [void][DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 9)
} else {
  [void][DesktopPetTopLevelWindowEnumerator]::ShowWindowAsync($handle, 5)
}

 $targetAlive = [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle)
 $focused = $false
 $foregroundHwnd = 0
 $foregroundMatchesTarget = $false
 $focusStatus = 'unverified'
for ($attempt = 0; $attempt -lt 5; $attempt++) {
  $targetAlive = [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle)
  if (!$targetAlive) {
    $focusStatus = 'failed'
    break
  }

  $foregroundBeforeHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  $foregroundProcessId = [uint32]0
  $foregroundThreadId = $(if ($foregroundBeforeHandle -eq [IntPtr]::Zero) { 0 } else { [DesktopPetTopLevelWindowEnumerator]::GetWindowThreadProcessId($foregroundBeforeHandle, [ref]$foregroundProcessId) })
  $currentThreadId = [DesktopPetTopLevelWindowEnumerator]::GetCurrentThreadId()
  $attached = $false
  if ($foregroundThreadId -gt 0 -and $foregroundThreadId -ne $currentThreadId) {
    $attached = [DesktopPetTopLevelWindowEnumerator]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
  }
  try {
    $focused = [DesktopPetTopLevelWindowEnumerator]::SetForegroundWindow($handle)
  } finally {
    if ($attached) {
      [void][DesktopPetTopLevelWindowEnumerator]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false)
    }
  }
  $settleDelay = @(120, 240, 400, 600, 900)[$attempt]
  Start-Sleep -Milliseconds $settleDelay
  $foregroundHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  $foregroundHwnd = $(if ($foregroundHandle -eq [IntPtr]::Zero) { 0 } else { [int64]$foregroundHandle.ToInt64() })
  $foregroundMatchesTarget = ([int64]$foregroundHwnd -eq [int64]$targetProcess.hwnd)
  if ($foregroundMatchesTarget) {
    $focusStatus = 'confirmed'
    break
  }
  if ($foregroundHwnd -eq 0) {
    $focusStatus = 'unverified'
    continue
  }
  $focusStatus = 'failed'
}
@{
  ok = [bool]$foregroundMatchesTarget
  hwnd = $targetProcess.hwnd
  processName = $targetProcess.processName
  title = $targetProcess.title
  pid = $targetProcess.pid
  foregroundHwnd = $foregroundHwnd
  foregroundMatchesTarget = $foregroundMatchesTarget
  focusRequestAccepted = [bool]$focused
  focusAttempts = $attempt + 1
  focusStatus = $focusStatus
  targetAlive = $targetAlive
  reason = $(if ($foregroundMatchesTarget) { '' } elseif ($focusStatus -eq 'unverified') { "foreground query remained transient after $($attempt + 1) attempt(s); last foreground hwnd $foregroundHwnd" } else { "foreground hwnd $foregroundHwnd did not match target hwnd $($targetProcess.hwnd)" })
} | ConvertTo-Json -Depth 4 -Compress
`,
  ].join('');
}

module.exports = { createFocusExistingAppWindowScript };
