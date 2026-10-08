const desktopIconListViewInteropCSharp = String.raw`using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class DesktopPetDesktopIconInfo {
  public bool canMove { get; set; }
  public string extension { get; set; }
  public string filePath { get; set; }
  public int index { get; set; }
  public string name { get; set; }
  public string path { get; set; }
  public string positionSource { get; set; }
  public int x { get; set; }
  public int y { get; set; }
  public int width { get; set; }
  public int height { get; set; }
  public int centerX { get; set; }
  public int centerY { get; set; }
  public int desktopGridCellWidth { get; set; }
  public int desktopGridCellHeight { get; set; }
}

public static class DesktopPetDesktopIconReader {
  private const int LVM_FIRST = 0x1000;
  private const int LVM_GETITEMCOUNT = LVM_FIRST + 4;
  private const int LVM_GETITEMPOSITION = LVM_FIRST + 16;
  private const int LVM_GETITEMSPACING = LVM_FIRST + 51;
  private const int LVM_GETITEMTEXTW = LVM_FIRST + 115;
  private const uint PROCESS_QUERY_INFORMATION = 0x0400;
  private const uint PROCESS_VM_OPERATION = 0x0008;
  private const uint PROCESS_VM_READ = 0x0010;
  private const uint PROCESS_VM_WRITE = 0x0020;
  private const uint MEM_COMMIT = 0x1000;
  private const uint MEM_RESERVE = 0x2000;
  private const uint MEM_RELEASE = 0x8000;
  private const uint PAGE_READWRITE = 0x04;
  private const int DEFAULT_ICON_WIDTH = 96;
  private const int DEFAULT_ICON_HEIGHT = 74;
  private const int TEXT_BUFFER_CHARS = 260;

  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  private struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct LVITEM {
    public uint mask;
    public int iItem;
    public int iSubItem;
    public uint state;
    public uint stateMask;
    public IntPtr pszText;
    public int cchTextMax;
    public int iImage;
    public IntPtr lParam;
    public int iIndent;
    public int iGroupId;
    public uint cColumns;
    public IntPtr puColumns;
    public IntPtr piColFmt;
    public int iGroup;
  }

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  private static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool CloseHandle(IntPtr hObject);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr VirtualAllocEx(IntPtr hProcess, IntPtr lpAddress, UIntPtr dwSize, uint flAllocationType, uint flProtect);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool VirtualFreeEx(IntPtr hProcess, IntPtr lpAddress, UIntPtr dwSize, uint dwFreeType);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, out IntPtr lpNumberOfBytesRead);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, out IntPtr lpNumberOfBytesWritten);

  private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

`;

module.exports = { desktopIconListViewInteropCSharp };
