const desktopIconListViewMoveInteropCSharp = String.raw`using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopPetDesktopIconMover {
  private const int LVM_FIRST = 0x1000;
  private const int LVM_GETITEMCOUNT = LVM_FIRST + 4;
  private const int LVM_SETITEMPOSITION = LVM_FIRST + 15;
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  private struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  private static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

  private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

`;

module.exports = { desktopIconListViewMoveInteropCSharp };
