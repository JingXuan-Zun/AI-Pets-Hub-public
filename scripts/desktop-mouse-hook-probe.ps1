param(
  [int]$Seconds = 30,
  [string]$OutputPath = '',
  [switch]$MinimizeConsole,
  [switch]$StopAfterFirstPhysicalClick
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public static class DesktopMouseHookProbe {
  public const int WH_MOUSE_LL = 14;
  public const int WM_LBUTTONDOWN = 0x0201;
  public const int WM_LBUTTONUP = 0x0202;
  public const int LLMHF_INJECTED = 0x00000001;
  public const int LLMHF_LOWER_IL_INJECTED = 0x00000002;

  public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MSLLHOOKSTRUCT {
    public POINT pt;
    public uint mouseData;
    public uint flags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool UnhookWindowsHookEx(IntPtr hhk);

  [DllImport("user32.dll")]
  public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  public static extern IntPtr GetModuleHandle(string lpModuleName);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  public static IntPtr HookId = IntPtr.Zero;
  public static LowLevelMouseProc Proc = HookCallback;
  public static List<MouseEventRecord> Events = new List<MouseEventRecord>();
  public static Stopwatch Watch = new Stopwatch();
  public static bool StopAfterFirstPhysicalClick = false;
  public static bool SawPhysicalDown = false;

  public class WindowRecord {
    public long hwnd;
    public int pid;
    public string processName;
    public string title;
  }

  public class MouseEventRecord {
    public string kind;
    public int elapsedMs;
    public int x;
    public int y;
    public uint flags;
    public bool injected;
    public bool lowerIntegrityInjected;
    public WindowRecord foreground;
    public WindowRecord underCursor;
  }

  public static WindowRecord SnapshotWindow(IntPtr handle) {
    if (handle == IntPtr.Zero) {
      return new WindowRecord { hwnd = 0, pid = 0, processName = "", title = "" };
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

    return new WindowRecord {
      hwnd = handle.ToInt64(),
      pid = (int)pid,
      processName = processName,
      title = titleBuilder.ToString()
    };
  }

  public static void Start(bool stopAfterFirstPhysicalClick) {
    StopAfterFirstPhysicalClick = stopAfterFirstPhysicalClick;
    SawPhysicalDown = false;
    Events.Clear();
    Watch.Restart();
    HookId = SetWindowsHookEx(WH_MOUSE_LL, Proc, GetModuleHandle(null), 0);
    if (HookId == IntPtr.Zero) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }

  public static void Stop() {
    Watch.Stop();
    if (HookId != IntPtr.Zero) {
      UnhookWindowsHookEx(HookId);
      HookId = IntPtr.Zero;
    }
  }

  public static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0 && (wParam.ToInt32() == WM_LBUTTONDOWN || wParam.ToInt32() == WM_LBUTTONUP)) {
      var data = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
      bool injected = (data.flags & LLMHF_INJECTED) != 0;
      bool lowerIntegrityInjected = (data.flags & LLMHF_LOWER_IL_INJECTED) != 0;
      string kind = wParam.ToInt32() == WM_LBUTTONDOWN ? "left_down" : "left_up";
      Events.Add(new MouseEventRecord {
        kind = kind,
        elapsedMs = (int)Watch.ElapsedMilliseconds,
        x = data.pt.X,
        y = data.pt.Y,
        flags = data.flags,
        injected = injected,
        lowerIntegrityInjected = lowerIntegrityInjected,
        foreground = SnapshotWindow(GetForegroundWindow()),
        underCursor = SnapshotWindow(WindowFromPoint(data.pt))
      });
      if (!injected && kind == "left_down") {
        SawPhysicalDown = true;
      }
      if (StopAfterFirstPhysicalClick && SawPhysicalDown && !injected && kind == "left_up") {
        BeginInvokeExit();
      }
    }

    return CallNextHookEx(HookId, nCode, wParam, lParam);
  }

  public static void BeginInvokeExit() {
    try {
      Application.OpenForms[0].BeginInvoke(new Action(() => Application.ExitThread()));
    } catch {
      Application.ExitThread();
    }
  }
}
"@

if ($MinimizeConsole) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class DesktopMouseHookProbeConsole {
  [DllImport("kernel32.dll")]
  public static extern IntPtr GetConsoleWindow();

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
  $consoleWindow = [DesktopMouseHookProbeConsole]::GetConsoleWindow()
  if ($consoleWindow -ne [IntPtr]::Zero) {
    [void][DesktopMouseHookProbeConsole]::ShowWindow($consoleWindow, 6)
  }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = [Math]::Max(1000, $Seconds * 1000)
$timer.Add_Tick({
  $timer.Stop()
  [System.Windows.Forms.Application]::ExitThread()
})

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Desktop Mouse Hook Probe'
$form.WindowState = 'Minimized'
$form.ShowInTaskbar = $false
$form.Opacity = 0
$form.Add_Shown({
  $timer.Start()
})

Write-Host "Desktop mouse hook probe started. seconds=$Seconds stopAfterFirstPhysicalClick=$StopAfterFirstPhysicalClick"
[DesktopMouseHookProbe]::Start([bool]$StopAfterFirstPhysicalClick)
try {
  [System.Windows.Forms.Application]::Run($form)
} finally {
  [DesktopMouseHookProbe]::Stop()
}

$events = [DesktopMouseHookProbe]::Events
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
Write-Host 'DESKTOP_MOUSE_HOOK_PROBE_JSON_START'
Write-Host $json
Write-Host 'DESKTOP_MOUSE_HOOK_PROBE_JSON_END'
