param(
  [int]$DelaySeconds = 5,
  [int]$PostClickSeconds = 3,
  [string]$OutputPath = '',
  [switch]$MouseEventSupplement,
  [switch]$Visible
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

public static class DesktopSyntheticClickHookProbe {
  public const int WH_MOUSE_LL = 14;
  public const int WM_LBUTTONDOWN = 0x0201;
  public const int WM_LBUTTONUP = 0x0202;
  public const int LLMHF_INJECTED = 0x00000001;
  public const int LLMHF_LOWER_IL_INJECTED = 0x00000002;
  public const uint INPUT_MOUSE = 0;
  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;

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

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public MOUSEINPUT mi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
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
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

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
    public ulong extraInfo;
    public WindowRecord foreground;
    public WindowRecord underCursor;
  }

  public class InjectionRecord {
    public bool cursorOk;
    public int x;
    public int y;
    public bool cursorSet;
    public uint downSent;
    public int downLastError;
    public uint upSent;
    public int upLastError;
    public bool mouseEventSupplement;
    public WindowRecord foregroundBefore;
    public WindowRecord foregroundAfter;
  }

  public static InjectionRecord LastInjection = null;
  public static int DelaySeconds = 5;
  public static int PostClickSeconds = 3;
  public static bool UseMouseEventSupplement = false;

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

  public static void Start() {
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

  public static InjectionRecord InjectClick(bool mouseEventSupplement) {
    POINT point;
    bool cursorOk = GetCursorPos(out point);
    var record = new InjectionRecord {
      cursorOk = cursorOk,
      x = point.X,
      y = point.Y,
      foregroundBefore = SnapshotWindow(GetForegroundWindow()),
      mouseEventSupplement = mouseEventSupplement
    };
    record.cursorSet = cursorOk && SetCursorPos(point.X, point.Y);

    INPUT down = new INPUT();
    down.type = INPUT_MOUSE;
    down.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    down.mi.dwExtraInfo = (UIntPtr)0xC0DEC0DE;
    INPUT up = new INPUT();
    up.type = INPUT_MOUSE;
    up.mi.dwFlags = MOUSEEVENTF_LEFTUP;
    up.mi.dwExtraInfo = (UIntPtr)0xC0DEC0DE;

    record.downSent = SendInput(1, new INPUT[] { down }, Marshal.SizeOf(typeof(INPUT)));
    record.downLastError = Marshal.GetLastWin32Error();
    System.Threading.Thread.Sleep(140);
    record.upSent = SendInput(1, new INPUT[] { up }, Marshal.SizeOf(typeof(INPUT)));
    record.upLastError = Marshal.GetLastWin32Error();

    if (mouseEventSupplement) {
      mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, (UIntPtr)0xC0DEC0DF);
      System.Threading.Thread.Sleep(140);
      mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, (UIntPtr)0xC0DEC0DF);
    }

    System.Threading.Thread.Sleep(100);
    record.foregroundAfter = SnapshotWindow(GetForegroundWindow());
    LastInjection = record;
    return record;
  }

  public static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0 && (wParam.ToInt32() == WM_LBUTTONDOWN || wParam.ToInt32() == WM_LBUTTONUP)) {
      var data = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
      string kind = wParam.ToInt32() == WM_LBUTTONDOWN ? "left_down" : "left_up";
      Events.Add(new MouseEventRecord {
        kind = kind,
        elapsedMs = (int)Watch.ElapsedMilliseconds,
        x = data.pt.X,
        y = data.pt.Y,
        flags = data.flags,
        injected = (data.flags & LLMHF_INJECTED) != 0,
        lowerIntegrityInjected = (data.flags & LLMHF_LOWER_IL_INJECTED) != 0,
        extraInfo = data.dwExtraInfo.ToUInt64(),
        foreground = SnapshotWindow(GetForegroundWindow()),
        underCursor = SnapshotWindow(WindowFromPoint(data.pt))
      });
    }

    return CallNextHookEx(HookId, nCode, wParam, lParam);
  }

  public static void StartWorker() {
    var thread = new System.Threading.Thread(() => {
      System.Threading.Thread.Sleep(Math.Max(100, DelaySeconds * 1000));
      InjectClick(UseMouseEventSupplement);
      System.Threading.Thread.Sleep(Math.Max(1000, PostClickSeconds * 1000));
      BeginInvokeExit();
    });
    thread.IsBackground = true;
    thread.Start();
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

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Desktop Synthetic Click Hook Probe'
if ($Visible) {
  $form.Width = 420
  $form.Height = 120
  $form.StartPosition = 'CenterScreen'
  $label = New-Object System.Windows.Forms.Label
  $label.Dock = 'Fill'
  $label.TextAlign = 'MiddleCenter'
  $label.Text = "Synthetic click hook probe running.`r`nDelay: $DelaySeconds seconds"
  $form.Controls.Add($label)
} else {
  $form.WindowState = 'Minimized'
  $form.ShowInTaskbar = $false
  $form.Opacity = 0
}

$form.Add_Shown({
  [DesktopSyntheticClickHookProbe]::StartWorker()
})

Write-Host "Desktop synthetic click hook probe started. delaySeconds=$DelaySeconds postClickSeconds=$PostClickSeconds mouseEventSupplement=$MouseEventSupplement"
[DesktopSyntheticClickHookProbe]::DelaySeconds = $DelaySeconds
[DesktopSyntheticClickHookProbe]::PostClickSeconds = $PostClickSeconds
[DesktopSyntheticClickHookProbe]::UseMouseEventSupplement = [bool]$MouseEventSupplement
[DesktopSyntheticClickHookProbe]::Start()
try {
  [System.Windows.Forms.Application]::Run($form)
} finally {
  [DesktopSyntheticClickHookProbe]::Stop()
}

$result = @{
  ok = $true
  delaySeconds = $DelaySeconds
  postClickSeconds = $PostClickSeconds
  mouseEventSupplement = [bool]$MouseEventSupplement
  injection = [DesktopSyntheticClickHookProbe]::LastInjection
  eventCount = [DesktopSyntheticClickHookProbe]::Events.Count
  events = [DesktopSyntheticClickHookProbe]::Events
}
$json = $result | ConvertTo-Json -Depth 10
if ($OutputPath.Trim()) {
  $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Host "OutputPath=$OutputPath"
}
Write-Host 'DESKTOP_SYNTHETIC_CLICK_HOOK_PROBE_JSON_START'
Write-Host $json
Write-Host 'DESKTOP_SYNTHETIC_CLICK_HOOK_PROBE_JSON_END'
