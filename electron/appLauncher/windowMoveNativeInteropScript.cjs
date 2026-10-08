

const windowMoveNativeInteropScript = String.raw`
'@ | ConvertFrom-Json
$query = [string]$payload.query
$queryCandidates = @($payload.queryCandidates | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
$requestedPid = [int64]$payload.pid
$requestedHwnd = [int64]$payload.hwnd
$fallbackToActiveWindow = [bool]$payload.fallbackToActiveWindow
$position = [string]$payload.position
$preserveSize = [bool]$payload.preserveSize
$targetRole = [string]$payload.targetRole
$targetIndex = [int]$payload.targetIndex
$targetDisplayText = [string]$payload.targetDisplayText

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;

public delegate bool DesktopPetWindowMoveEnumWindowsProc(IntPtr hWnd, IntPtr lParam);

public struct DesktopPetWindowMoveRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public sealed class DesktopPetWindowMoveInfo {
  public long Hwnd;
  public int Pid;
  public string Title;
  public int X;
  public int Y;
  public int Width;
  public int Height;
  public int TopLevelOrder;
}

public static class DesktopPetWindowMove {
  public const int DWMWA_CLOAKED = 14;
  public const int GWL_EXSTYLE = -20;
  public const int SW_RESTORE = 9;
  public const int WS_EX_TOOLWINDOW = 0x00000080;

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(DesktopPetWindowMoveEnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr GetShellWindow();

  [DllImport("user32.dll", SetLastError = true)]
  public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out DesktopPetWindowMoveRect rect);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

  private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

  private static void TryEnableDpiAwareness() {
    try {
      if (SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
        return;
      }
    } catch {
    }

    try {
      SetProcessDPIAware();
    } catch {
    }
  }

  public static DesktopPetWindowMoveInfo[] EnumerateTopLevelWindows() {
    TryEnableDpiAwareness();
    var windows = new List<DesktopPetWindowMoveInfo>();
    var shellWindow = GetShellWindow();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (hWnd == IntPtr.Zero || hWnd == shellWindow) {
        return true;
      }

      if (!IsWindow(hWnd) || !IsWindowVisible(hWnd) || IsToolWindow(hWnd) || IsWindowCloaked(hWnd)) {
        return true;
      }

      DesktopPetWindowMoveRect rect;
      if (!GetWindowRect(hWnd, out rect)) {
        return true;
      }

      var width = Math.Max(0, rect.Right - rect.Left);
      var height = Math.Max(0, rect.Bottom - rect.Top);
      if (width < 1 || height < 1) {
        return true;
      }

      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      if (pid == 0) {
        return true;
      }

      windows.Add(new DesktopPetWindowMoveInfo {
        Hwnd = hWnd.ToInt64(),
        Pid = unchecked((int)pid),
        Title = ReadWindowText(hWnd),
        X = rect.Left,
        Y = rect.Top,
        Width = width,
        Height = height,
        TopLevelOrder = windows.Count,
      });
      return true;
    }, IntPtr.Zero);

    return windows.ToArray();
  }

  public static string ReadWindowText(IntPtr hWnd) {
    var length = Math.Max(1024, GetWindowTextLength(hWnd) + 1);
    var builder = new StringBuilder(length);
    GetWindowText(hWnd, builder, builder.Capacity);
    return builder.ToString();
  }

  private static bool IsToolWindow(IntPtr hWnd) {
    try {
      return (GetWindowLong(hWnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0;
    } catch {
      return false;
    }
  }

  private static bool IsWindowCloaked(IntPtr hWnd) {
    try {
      int cloaked;
      return DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0;
    } catch {
      return false;
    }
  }
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

`;

module.exports = { windowMoveNativeInteropScript };
