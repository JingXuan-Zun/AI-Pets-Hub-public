

function createTopLevelWindowEnumeratorPowerShell() {
  return String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;

public delegate bool DesktopPetTopLevelWindowEnumProc(IntPtr hWnd, IntPtr lParam);

public sealed class DesktopPetTopLevelWindowInfo {
  public long Hwnd;
  public int Pid;
  public string Title;
  public int X;
  public int Y;
  public int Width;
  public int Height;
  public int TopLevelOrder;
}

public sealed class DesktopPetFilteredWindowInfo {
  public long Hwnd;
  public int Pid;
  public string Title;
  public string[] Reasons;
}

public sealed class DesktopPetTopLevelWindowEnumerationResult {
  public DesktopPetTopLevelWindowInfo[] Windows;
  public DesktopPetFilteredWindowInfo[] FilteredOut;
  public int EnumeratedCount;
}

public static class DesktopPetTopLevelWindowEnumerator {
  public const int DWMWA_CLOAKED = 14;
  public const int GWL_EXSTYLE = -20;
  public const UInt32 WM_CLOSE = 0x0010;
  public const int WS_EX_TOOLWINDOW = 0x00000080;

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(DesktopPetTopLevelWindowEnumProc lpEnumFunc, IntPtr lParam);

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
  public static extern bool GetWindowRect(IntPtr hWnd, out DesktopPetWindowRect rect);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsZoomed(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessage(IntPtr hWnd, UInt32 Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

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

  public static DesktopPetTopLevelWindowEnumerationResult EnumerateTopLevelWindowsWithDiagnostics() {
    TryEnableDpiAwareness();
    var windows = new List<DesktopPetTopLevelWindowInfo>();
    var filteredOut = new List<DesktopPetFilteredWindowInfo>();
    var enumeratedCount = 0;
    var shellWindow = GetShellWindow();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (hWnd == IntPtr.Zero || hWnd == shellWindow) {
        return true;
      }

      enumeratedCount += 1;
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      var title = ReadWindowText(hWnd);
      var reasons = new List<string>();
      if (!IsWindow(hWnd)) reasons.Add("invalid-window");
      if (!IsWindowVisible(hWnd)) reasons.Add("not-visible");
      if (IsToolWindow(hWnd)) reasons.Add("tool-window");
      if (IsWindowCloaked(hWnd)) reasons.Add("cloaked");
      DesktopPetWindowRect candidateRect;
      if (!GetWindowRect(hWnd, out candidateRect)) {
        reasons.Add("bounds-unavailable");
      } else if (candidateRect.Right - candidateRect.Left < 1 || candidateRect.Bottom - candidateRect.Top < 1) {
        reasons.Add("invalid-bounds");
      }
      if (pid == 0) reasons.Add("missing-pid");
      if (reasons.Count > 0) {
        filteredOut.Add(new DesktopPetFilteredWindowInfo {
          Hwnd = hWnd.ToInt64(),
          Pid = unchecked((int)pid),
          Title = title,
          Reasons = reasons.ToArray(),
        });
        return true;
      }

      DesktopPetWindowRect rect;
      if (!GetWindowRect(hWnd, out rect)) {
        return true;
      }

      var width = Math.Max(0, rect.Right - rect.Left);
      var height = Math.Max(0, rect.Bottom - rect.Top);
      if (width < 1 || height < 1) {
        return true;
      }

      windows.Add(new DesktopPetTopLevelWindowInfo {
        Hwnd = hWnd.ToInt64(),
        Pid = unchecked((int)pid),
        Title = title,
        X = rect.Left,
        Y = rect.Top,
        Width = width,
        Height = height,
        TopLevelOrder = windows.Count,
      });
      return true;
    }, IntPtr.Zero);

    return new DesktopPetTopLevelWindowEnumerationResult {
      EnumeratedCount = enumeratedCount,
      FilteredOut = filteredOut.ToArray(),
      Windows = windows.ToArray(),
    };
  }

  public static DesktopPetTopLevelWindowInfo[] EnumerateTopLevelWindows() {
    return EnumerateTopLevelWindowsWithDiagnostics().Windows;
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

public struct DesktopPetWindowRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
"@

function Normalize-DesktopPetText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

function Get-DesktopPetTopLevelWindows {
  $windows = @()
  foreach ($rawWindow in @([DesktopPetTopLevelWindowEnumerator]::EnumerateTopLevelWindows())) {
    $process = $null
    $processPath = ''
    try {
      $process = Get-Process -Id ([int]$rawWindow.Pid) -ErrorAction Stop
      try { $processPath = [string]$process.Path } catch { $processPath = '' }
    } catch {
      continue
    }

    $windows += [PSCustomObject]@{
      bounds = @{
        x = [int]$rawWindow.X
        y = [int]$rawWindow.Y
        width = [int]$rawWindow.Width
        height = [int]$rawWindow.Height
      }
      executablePath = $processPath
      handle = [IntPtr]([int64]$rawWindow.Hwnd)
      hwnd = [int64]$rawWindow.Hwnd
      path = $processPath
      pid = [int]$rawWindow.Pid
      process = $process
      processName = [string]$process.ProcessName
      title = [string]$rawWindow.Title
      topLevelOrder = [int]$rawWindow.TopLevelOrder
    }
  }

  return @($windows)
}

function Get-DesktopPetTopLevelWindowDiagnostics {
  $diagnostics = [DesktopPetTopLevelWindowEnumerator]::EnumerateTopLevelWindowsWithDiagnostics()
  $filtered = @($diagnostics.FilteredOut | Select-Object -First 24 | ForEach-Object {
    [PSCustomObject]@{
      hwnd = [int64]$_.Hwnd
      pid = [int]$_.Pid
      title = [string]$_.Title
      reasons = @($_.Reasons)
    }
  })
  [PSCustomObject]@{
    enumeratedCount = [int]$diagnostics.EnumeratedCount
    filteredOut = $filtered
    windows = @(Get-DesktopPetTopLevelWindows)
  }
}
`;
}

module.exports = { createTopLevelWindowEnumeratorPowerShell };
