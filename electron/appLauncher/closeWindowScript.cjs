const { createTopLevelWindowEnumeratorPowerShell } = require('./topLevelWindowEnumeratorPowerShell.cjs');

function createCloseWindowScript({ query, hasPid, requestedPid, hasHwnd, requestedHwnd }) {
  return [
    String.raw`
$ErrorActionPreference = 'Stop'
$query = @'
`,
    String.raw`${JSON.stringify(query)}`,
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
using System.Text;
using System.Runtime.InteropServices;

public static class DesktopPetWindowClose {
  public const UInt32 WM_CLOSE = 0x0010;

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessage(IntPtr hWnd, UInt32 Msg, IntPtr wParam, IntPtr lParam);
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\(\)\[\]\{\}"''._\-:：，。、【】（）「」『』]+', ''
}

function Get-DesktopPetWindowTitle($handle) {
  $builder = New-Object System.Text.StringBuilder 1024
  [void][DesktopPetWindowClose]::GetWindowText($handle, $builder, $builder.Capacity)
  return [string]$builder.ToString()
}

`,
    String.raw`${createTopLevelWindowEnumeratorPowerShell()}`,
    String.raw`

$normalizedQuery = Normalize-DesktopPetText $query
$windows = Get-DesktopPetTopLevelWindows
$matches = @()

foreach ($window in $windows) {
  $handle = [IntPtr]$window.handle
  if (-not [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle) -or -not [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible($handle)) {
    continue
  }

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
      Handle = $handle
      Hwnd = [int64]$window.hwnd
      Pid = [int]$window.pid
      Score = $score
      MatchReason = $reason
      Title = $title
    }
  }
}

$match = $matches | Sort-Object -Property Score -Descending | Select-Object -First 1
if ($null -eq $match) {
  @{
    ok = $false
    closed = $false
    reason = 'no-window-match'
    query = $query
    matchCount = 0
  } | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

$targetProcess = $match.Process
$handle = [IntPtr]$match.Handle
$sent = [DesktopPetTopLevelWindowEnumerator]::PostMessage($handle, [DesktopPetTopLevelWindowEnumerator]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
Start-Sleep -Milliseconds 700
$stillWindow = [DesktopPetTopLevelWindowEnumerator]::IsWindow($handle)
$stillProcess = $false
try {
  $processAfter = Get-Process -Id $match.Pid -ErrorAction Stop
  $stillProcess = $null -ne $processAfter
} catch {
  $stillProcess = $false
}

@{
  ok = [bool]$sent
  closed = -not $stillWindow
  processName = $targetProcess.processName
  title = $match.Title
  pid = $match.Pid
  hwnd = $match.Hwnd
  matchReason = $match.MatchReason
  matchCount = @($matches).Count
  stillWindow = [bool]$stillWindow
  stillProcessWindow = [bool]$stillProcess
  query = $query
} | ConvertTo-Json -Depth 5 -Compress
`,
  ].join('');
}

module.exports = { createCloseWindowScript };
