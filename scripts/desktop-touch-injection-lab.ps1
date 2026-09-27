param(
  [int]$DelaySeconds = 0,
  [ValidateSet('direct-basic', 'direct-primary-button', 'hover-basic', 'hover-new-primary')]
  [string]$Variant = 'direct-basic',
  [ValidateSet(1, 2, 3)]
  [int]$FeedbackMode = 1,
  [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopTouchInjectionLab {
  public const uint POINTER_FLAG_INRANGE = 0x00000002;
  public const uint POINTER_FLAG_INCONTACT = 0x00000004;
  public const uint POINTER_FLAG_FIRSTBUTTON = 0x00000010;
  public const uint POINTER_FLAG_PRIMARY = 0x00002000;
  public const uint POINTER_FLAG_NEW = 0x00000001;
  public const uint POINTER_FLAG_DOWN = 0x00010000;
  public const uint POINTER_FLAG_UPDATE = 0x00020000;
  public const uint POINTER_FLAG_UP = 0x00040000;
  public const uint TOUCH_MASK_CONTACTAREA = 0x00000001;
  public const uint TOUCH_MASK_ORIENTATION = 0x00000002;
  public const uint TOUCH_MASK_PRESSURE = 0x00000004;
  public const uint PT_TOUCH = 2;

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int left;
    public int top;
    public int right;
    public int bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINTER_INFO {
    public uint pointerType;
    public uint pointerId;
    public uint frameId;
    public uint pointerFlags;
    public IntPtr sourceDevice;
    public IntPtr hwndTarget;
    public POINT ptPixelLocation;
    public POINT ptHimetricLocation;
    public POINT ptPixelLocationRaw;
    public POINT ptHimetricLocationRaw;
    public uint dwTime;
    public uint historyCount;
    public int inputData;
    public uint dwKeyStates;
    public ulong PerformanceCount;
    public int ButtonChangeType;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINTER_TOUCH_INFO {
    public POINTER_INFO pointerInfo;
    public uint touchFlags;
    public uint touchMask;
    public RECT rcContact;
    public RECT rcContactRaw;
    public uint orientation;
    public uint pressure;
  }

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool InitializeTouchInjection(uint maxCount, uint dwMode);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool InjectTouchInput(uint count, POINTER_TOUCH_INFO[] contacts);

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

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

  public static POINTER_TOUCH_INFO CreateTouch(uint id, int x, int y, uint flags, IntPtr hwndTarget) {
    POINTER_TOUCH_INFO contact = new POINTER_TOUCH_INFO();
    contact.pointerInfo.pointerType = PT_TOUCH;
    contact.pointerInfo.pointerId = id;
    contact.pointerInfo.frameId = 0;
    contact.pointerInfo.pointerFlags = flags;
    contact.pointerInfo.sourceDevice = IntPtr.Zero;
    contact.pointerInfo.hwndTarget = hwndTarget;
    contact.pointerInfo.ptPixelLocation.X = x;
    contact.pointerInfo.ptPixelLocation.Y = y;
    contact.pointerInfo.ptHimetricLocation.X = 0;
    contact.pointerInfo.ptHimetricLocation.Y = 0;
    contact.pointerInfo.ptPixelLocationRaw.X = x;
    contact.pointerInfo.ptPixelLocationRaw.Y = y;
    contact.pointerInfo.ptHimetricLocationRaw.X = 0;
    contact.pointerInfo.ptHimetricLocationRaw.Y = 0;
    contact.pointerInfo.dwTime = 0;
    contact.pointerInfo.historyCount = 1;
    contact.pointerInfo.inputData = 0;
    contact.pointerInfo.dwKeyStates = 0;
    contact.pointerInfo.PerformanceCount = 0;
    contact.pointerInfo.ButtonChangeType = 0;
    contact.touchFlags = 0;
    contact.touchMask = TOUCH_MASK_CONTACTAREA | TOUCH_MASK_ORIENTATION | TOUCH_MASK_PRESSURE;
    contact.rcContact.left = x - 3;
    contact.rcContact.right = x + 3;
    contact.rcContact.top = y - 3;
    contact.rcContact.bottom = y + 3;
    contact.rcContactRaw = contact.rcContact;
    contact.orientation = 90;
    contact.pressure = 512;
    return contact;
  }

  public static int PointerInfoSize() {
    return Marshal.SizeOf(typeof(POINTER_INFO));
  }

  public static int PointerTouchInfoSize() {
    return Marshal.SizeOf(typeof(POINTER_TOUCH_INFO));
  }
}
"@

if ($DelaySeconds -gt 0) {
  Write-Host "Desktop Touch Injection Lab waiting $DelaySeconds seconds before probing cursor..."
  Start-Sleep -Seconds $DelaySeconds
}

$point = New-Object DesktopTouchInjectionLab+POINT
$cursorOk = [DesktopTouchInjectionLab]::GetCursorPos([ref]$point)
$targetHwnd = [IntPtr]::Zero
if ($cursorOk) {
  $targetHwnd = [DesktopTouchInjectionLab]::WindowFromPoint($point)
}
$targetWindow = [DesktopTouchInjectionLab]::SnapshotWindow($targetHwnd)
$foregroundBefore = [DesktopTouchInjectionLab]::SnapshotWindow([DesktopTouchInjectionLab]::GetForegroundWindow())
$initOk = [DesktopTouchInjectionLab]::InitializeTouchInjection(1, [uint32]$FeedbackMode)
$initLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
$downOk = $false
$downLastError = $null
$hoverOk = $null
$hoverLastError = $null
$upOk = $false
$upLastError = $null
if ($cursorOk -and $initOk) {
  if ($Variant -like 'hover-*') {
    $hoverFlags = [DesktopTouchInjectionLab]::POINTER_FLAG_INRANGE -bor
      [DesktopTouchInjectionLab]::POINTER_FLAG_UPDATE
    if ($Variant -eq 'hover-new-primary') {
      $hoverFlags = $hoverFlags -bor
        [DesktopTouchInjectionLab]::POINTER_FLAG_NEW -bor
        [DesktopTouchInjectionLab]::POINTER_FLAG_PRIMARY
    }
    $hover = [DesktopTouchInjectionLab]::CreateTouch(
      1,
      [int]$point.X,
      [int]$point.Y,
      $hoverFlags,
      $targetHwnd
    )
    $hoverOk = [DesktopTouchInjectionLab]::InjectTouchInput(1, @($hover))
    $hoverLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Start-Sleep -Milliseconds 40
  }
  $downFlags = [DesktopTouchInjectionLab]::POINTER_FLAG_INRANGE -bor
    [DesktopTouchInjectionLab]::POINTER_FLAG_INCONTACT -bor
    [DesktopTouchInjectionLab]::POINTER_FLAG_DOWN
  if ($Variant -eq 'direct-primary-button' -or $Variant -eq 'hover-new-primary') {
    $downFlags = $downFlags -bor
      [DesktopTouchInjectionLab]::POINTER_FLAG_FIRSTBUTTON -bor
      [DesktopTouchInjectionLab]::POINTER_FLAG_PRIMARY
  }
  $down = [DesktopTouchInjectionLab]::CreateTouch(
    1,
    [int]$point.X,
    [int]$point.Y,
    $downFlags,
    $targetHwnd
  )
  $downOk = [DesktopTouchInjectionLab]::InjectTouchInput(1, @($down))
  $downLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Start-Sleep -Milliseconds 140
  $upFlags = [DesktopTouchInjectionLab]::POINTER_FLAG_INRANGE -bor
    [DesktopTouchInjectionLab]::POINTER_FLAG_UP
  if ($Variant -eq 'direct-primary-button' -or $Variant -eq 'hover-new-primary') {
    $upFlags = $upFlags -bor [DesktopTouchInjectionLab]::POINTER_FLAG_PRIMARY
  }
  $up = [DesktopTouchInjectionLab]::CreateTouch(
    1,
    [int]$point.X,
    [int]$point.Y,
    $upFlags,
    $targetHwnd
  )
  $upOk = [DesktopTouchInjectionLab]::InjectTouchInput(1, @($up))
  $upLastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
}

Start-Sleep -Milliseconds 300
$foregroundAfter = [DesktopTouchInjectionLab]::SnapshotWindow([DesktopTouchInjectionLab]::GetForegroundWindow())
$result = @{
  ok = $true
  cursor = @{
    ok = [bool]$cursorOk
    x = [int]$point.X
    y = [int]$point.Y
  }
  targetWindowFromPoint = $targetWindow
  foregroundBefore = $foregroundBefore
  foregroundAfter = $foregroundAfter
  initialize = @{
    ok = [bool]$initOk
    lastError = [int]$initLastError
    feedbackMode = [int]$FeedbackMode
  }
  structSizes = @{
    pointerInfo = [DesktopTouchInjectionLab]::PointerInfoSize()
    pointerTouchInfo = [DesktopTouchInjectionLab]::PointerTouchInfoSize()
  }
  touch = @{
    variant = $Variant
    hoverOk = $hoverOk
    hoverLastError = $hoverLastError
    downOk = [bool]$downOk
    downLastError = $downLastError
    upOk = [bool]$upOk
    upLastError = $upLastError
  }
}

$json = $result | ConvertTo-Json -Depth 10
if ($OutputPath.Trim()) {
  $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Host "OutputPath=$OutputPath"
}
Write-Host 'DESKTOP_TOUCH_INJECTION_LAB_JSON_START'
Write-Host $json
Write-Host 'DESKTOP_TOUCH_INJECTION_LAB_JSON_END'
