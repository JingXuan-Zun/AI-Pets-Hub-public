param(
  [ValidateSet('postmessage', 'sendmessage', 'bmclick')]
  [string]$Strategy = 'postmessage',
  [int]$DelaySeconds = 0,
  [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopWin32MessageLab {
  public const uint WM_LBUTTONDOWN = 0x0201;
  public const uint WM_LBUTTONUP = 0x0202;
  public const uint MK_LBUTTON = 0x0001;
  public const uint BM_CLICK = 0x00F5;

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll")]
  public static extern bool ScreenToClient(IntPtr hWnd, ref POINT lpPoint);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  public static IntPtr MakeLParam(int low, int high) {
    return (IntPtr)((high << 16) | (low & 0xFFFF));
  }

  public static object SnapshotWindow(IntPtr handle) {
    if (handle == IntPtr.Zero) {
      return new {
        hwnd = 0L,
        pid = 0,
        processName = "",
        title = ""
      };
    }

    uint pid;
    GetWindowThreadProcessId(handle, out pid);
    var titleBuilder = new StringBuilder(512);
    GetWindowText(handle, titleBuilder, titleBuilder.Capacity);
    string processName = "";
    try {
      processName = Process.GetProcessById((int)pid).ProcessName;
    } catch {
    }

    return new {
      hwnd = handle.ToInt64(),
      pid = (int)pid,
      processName = processName,
      title = titleBuilder.ToString()
    };
  }
}
"@

if ($DelaySeconds -gt 0) {
  Write-Host "Desktop Win32 Message Lab waiting $DelaySeconds seconds before probing cursor..."
  Start-Sleep -Seconds $DelaySeconds
}

$point = New-Object DesktopWin32MessageLab+POINT
$cursorOk = [DesktopWin32MessageLab]::GetCursorPos([ref]$point)
$targetHwnd = if ($cursorOk) {
  [DesktopWin32MessageLab]::WindowFromPoint($point)
} else {
  [IntPtr]::Zero
}
$clientPoint = $point
$clientOk = $false
if ($targetHwnd -ne [IntPtr]::Zero) {
  $clientOk = [DesktopWin32MessageLab]::ScreenToClient($targetHwnd, [ref]$clientPoint)
}
$lParam = [DesktopWin32MessageLab]::MakeLParam([int]$clientPoint.X, [int]$clientPoint.Y)
$foregroundBefore = [DesktopWin32MessageLab]::SnapshotWindow([DesktopWin32MessageLab]::GetForegroundWindow())
$targetWindow = [DesktopWin32MessageLab]::SnapshotWindow($targetHwnd)
$downOk = $null
$upOk = $null
$downLastError = $null
$upLastError = $null
$sendMessageDownResult = $null
$sendMessageUpResult = $null

switch ($Strategy) {
  'postmessage' {
    $downOk = [DesktopWin32MessageLab]::PostMessage($targetHwnd, [DesktopWin32MessageLab]::WM_LBUTTONDOWN, [IntPtr][DesktopWin32MessageLab]::MK_LBUTTON, $lParam)
    $downLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Start-Sleep -Milliseconds 120
    $upOk = [DesktopWin32MessageLab]::PostMessage($targetHwnd, [DesktopWin32MessageLab]::WM_LBUTTONUP, [IntPtr]::Zero, $lParam)
    $upLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  }
  'sendmessage' {
    $sendMessageDownResult = [int64][DesktopWin32MessageLab]::SendMessage($targetHwnd, [DesktopWin32MessageLab]::WM_LBUTTONDOWN, [IntPtr][DesktopWin32MessageLab]::MK_LBUTTON, $lParam)
    $downLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Start-Sleep -Milliseconds 120
    $sendMessageUpResult = [int64][DesktopWin32MessageLab]::SendMessage($targetHwnd, [DesktopWin32MessageLab]::WM_LBUTTONUP, [IntPtr]::Zero, $lParam)
    $upLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $downOk = $true
    $upOk = $true
  }
  'bmclick' {
    $sendMessageDownResult = [int64][DesktopWin32MessageLab]::SendMessage($targetHwnd, [DesktopWin32MessageLab]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
    $downLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $downOk = $true
    $upOk = $true
  }
}

Start-Sleep -Milliseconds 250
$foregroundAfter = [DesktopWin32MessageLab]::SnapshotWindow([DesktopWin32MessageLab]::GetForegroundWindow())
$result = @{
  ok = $true
  strategy = $Strategy
  cursor = @{
    ok = [bool]$cursorOk
    x = [int]$point.X
    y = [int]$point.Y
  }
  target = @{
    hwnd = [int64]$targetHwnd.ToInt64()
    screenToClientOk = [bool]$clientOk
    clientX = [int]$clientPoint.X
    clientY = [int]$clientPoint.Y
    lParam = [int64]$lParam.ToInt64()
    window = $targetWindow
  }
  foregroundBefore = $foregroundBefore
  foregroundAfter = $foregroundAfter
  messageResult = @{
    downOk = $downOk
    upOk = $upOk
    downLastError = $downLastError
    upLastError = $upLastError
    sendMessageDownResult = $sendMessageDownResult
    sendMessageUpResult = $sendMessageUpResult
  }
}

$json = $result | ConvertTo-Json -Depth 10
if ($OutputPath.Trim()) {
  $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Host "OutputPath=$OutputPath"
}
Write-Host 'DESKTOP_WIN32_MESSAGE_LAB_JSON_START'
Write-Host $json
Write-Host 'DESKTOP_WIN32_MESSAGE_LAB_JSON_END'
