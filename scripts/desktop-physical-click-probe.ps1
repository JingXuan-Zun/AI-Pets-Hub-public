param(
  [int]$Seconds = 20,
  [string]$OutputPath = '',
  [switch]$StopAfterFirstClick
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopPhysicalClickProbe {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int vKey);

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

function Get-WindowSnapshot {
  param([IntPtr]$Handle)

  if ($Handle -eq [IntPtr]::Zero) {
    return @{
      hwnd = 0
      pid = 0
      processName = ''
      title = ''
    }
  }

  $pidValue = [uint32]0
  [void][DesktopPhysicalClickProbe]::GetWindowThreadProcessId($Handle, [ref]$pidValue)
  $titleBuilder = New-Object System.Text.StringBuilder 512
  [void][DesktopPhysicalClickProbe]::GetWindowText($Handle, $titleBuilder, $titleBuilder.Capacity)
  $processName = ''
  try {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction Stop
    $processName = [string]$process.ProcessName
  } catch {
  }

  return @{
    hwnd = [int64]$Handle.ToInt64()
    pid = [int]$pidValue
    processName = $processName
    title = [string]$titleBuilder.ToString()
  }
}

function Get-ProbeSnapshot {
  param(
    [string]$Kind,
    [Diagnostics.Stopwatch]$Watch
  )

  $point = New-Object DesktopPhysicalClickProbe+POINT
  $cursorOk = [DesktopPhysicalClickProbe]::GetCursorPos([ref]$point)
  $foreground = [DesktopPhysicalClickProbe]::GetForegroundWindow()
  $underCursor = if ($cursorOk) {
    [DesktopPhysicalClickProbe]::WindowFromPoint($point)
  } else {
    [IntPtr]::Zero
  }

  return @{
    kind = $Kind
    elapsedMs = [int]$Watch.ElapsedMilliseconds
    cursor = @{
      ok = [bool]$cursorOk
      x = [int]$point.X
      y = [int]$point.Y
    }
    foreground = Get-WindowSnapshot $foreground
    underCursor = Get-WindowSnapshot $underCursor
  }
}

$events = @()
$watch = [Diagnostics.Stopwatch]::StartNew()
$deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
$wasDown = $false

Write-Host "Desktop physical click probe started. seconds=$Seconds"
Write-Host "Please physically click the target button once, then wait for the probe to finish."

while ([DateTime]::UtcNow -lt $deadline) {
  $isDown = ([DesktopPhysicalClickProbe]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0
  if ($isDown -and -not $wasDown) {
    $events += Get-ProbeSnapshot 'left_down' $watch
  }
  if (-not $isDown -and $wasDown) {
    $events += Get-ProbeSnapshot 'left_up' $watch
    if ($StopAfterFirstClick) {
      Start-Sleep -Milliseconds 250
      break
    }
  }
  $wasDown = $isDown
  Start-Sleep -Milliseconds 12
}

$watch.Stop()

$result = @{
  ok = $true
  seconds = $Seconds
  eventCount = $events.Count
  events = $events
}

$json = $result | ConvertTo-Json -Depth 10
if ($OutputPath.Trim()) {
  $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Host "OutputPath=$OutputPath"
}
Write-Host 'DESKTOP_PHYSICAL_CLICK_PROBE_JSON_START'
Write-Host $json
Write-Host 'DESKTOP_PHYSICAL_CLICK_PROBE_JSON_END'
