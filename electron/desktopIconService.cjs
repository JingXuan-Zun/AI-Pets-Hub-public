const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DESKTOP_ICON_CACHE_TTL_MS = 5000;
const DESKTOP_ICON_SCRIPT_TIMEOUT_MS = 2500;

function stripPowerShellCliXml(value) {
  return String(value || '')
    .replace(/^#< CLIXML\s*/u, '')
    .replace(/<Objs[^>]*>/gu, '')
    .replace(/<\/Objs>/gu, '')
    .replace(/<S[^>]*>/gu, '')
    .replace(/<\/S>/gu, '')
    .replace(/_x000D__x000A_/gu, '\n')
    .replace(/_x000D_/gu, '\r')
    .replace(/_x000A_/gu, '\n')
    .replace(/_x0009_/gu, '\t')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&')
    .trim();
}

function compactDesktopIconPowerShellError(value, maxLength = 1200) {
  const text = stripPowerShellCliXml(value)
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createDesktopIconPowerShellError(error, stdout, stderr) {
  const stderrText = compactDesktopIconPowerShellError(stderr);
  const stdoutText = compactDesktopIconPowerShellError(stdout);
  const messageText = compactDesktopIconPowerShellError(error?.message || String(error || ''));
  const detailText = [stderrText, stdoutText, messageText]
    .filter(Boolean)
    .find((text) => !/^Command failed:/iu.test(text))
    || stderrText
    || stdoutText
    || messageText
    || 'PowerShell desktop icon command failed.';
  const wrapped = new Error(detailText);
  wrapped.code = error?.code;
  wrapped.signal = error?.signal;
  wrapped.stderr = stderrText;
  wrapped.stdout = stdoutText;
  return wrapped;
}

function getDesktopIconFolderViewReaderPowerShellBlock() {
  return String.raw`
function Get-DesktopPetFolderViewIcons {
  try {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

[ComImport, Guid("9BA05972-F6A8-11CF-A442-00A0C90A8F39")]
public class DesktopPetShellWindows {
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIDispatch), Guid("85CB6900-4D95-11CF-960C-0080C7F4EE85")]
public interface DesktopPetIShellWindows {
  [return: MarshalAs(UnmanagedType.IDispatch)]
  object FindWindowSW(ref object pvarLoc, ref object pvarLocRoot, int swClass, out int pHWND, int swfwOptions);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("6d5140c1-7436-11ce-8034-00aa006009fa")]
public interface DesktopPetIServiceProviderRaw {
  [PreserveSig]
  int QueryService(ref Guid guidService, ref Guid riid, out IntPtr ppvObject);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214E2-0000-0000-C000-000000000046")]
public interface DesktopPetIShellBrowser {
  [PreserveSig] int GetWindow(out IntPtr phwnd);
  [PreserveSig] int ContextSensitiveHelp(bool fEnterMode);
  [PreserveSig] int InsertMenusSB(IntPtr hmenuShared, IntPtr lpMenuWidths);
  [PreserveSig] int SetMenuSB(IntPtr hmenuShared, IntPtr holemenuRes, IntPtr hwndActiveObject);
  [PreserveSig] int RemoveMenusSB(IntPtr hmenuShared);
  [PreserveSig] int SetStatusTextSB(IntPtr pszStatusText);
  [PreserveSig] int EnableModelessSB(bool fEnable);
  [PreserveSig] int TranslateAcceleratorSB(IntPtr pmsg, short wID);
  [PreserveSig] int BrowseObject(IntPtr pidl, uint wFlags);
  [PreserveSig] int GetViewStateStream(uint grfMode, out IntPtr ppStrm);
  [PreserveSig] int GetControlWindow(uint id, out IntPtr lphwnd);
  [PreserveSig] int SendControlMsg(uint id, uint uMsg, IntPtr wParam, IntPtr lParam, out IntPtr pret);
  [PreserveSig] int QueryActiveShellView(out IntPtr ppshv);
  [PreserveSig] int OnViewWindowActive(IntPtr pshv);
  [PreserveSig] int SetToolbarItems(IntPtr lpButtons, uint nButtons, uint uFlags);
}

[StructLayout(LayoutKind.Sequential)]
public struct DesktopPetFolderViewPoint {
  public int X;
  public int Y;
}

[StructLayout(LayoutKind.Sequential)]
public struct DesktopPetFolderViewRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("cde725b0-ccc9-4519-917e-325d72fab4ce")]
public interface DesktopPetIFolderView {
  [PreserveSig] int GetCurrentViewMode(out uint pViewMode);
  [PreserveSig] int SetCurrentViewMode(uint ViewMode);
  [PreserveSig] int GetFolder(ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppv);
  [PreserveSig] int Item(int iItemIndex, out IntPtr ppidl);
  [PreserveSig] int ItemCount(uint uFlags, out int pcItems);
  [PreserveSig] int Items(uint uFlags, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int GetSelectionMarkedItem(out int piItem);
  [PreserveSig] int GetFocusedItem(out int piItem);
  [PreserveSig] int GetItemPosition(IntPtr pidl, out DesktopPetFolderViewPoint ppt);
  [PreserveSig] int GetSpacing(out DesktopPetFolderViewPoint ppt);
  [PreserveSig] int GetDefaultSpacing(out DesktopPetFolderViewPoint ppt);
  [PreserveSig] int GetAutoArrange();
  [PreserveSig] int SelectItem(int iItem, uint dwFlags);
  [PreserveSig] int SelectAndPositionItems(uint cidl, IntPtr apidl, IntPtr apt, uint dwFlags);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("b63ea76d-1f85-456f-a19c-48159efa858b")]
public interface DesktopPetIShellItemArray {
  [PreserveSig] int BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppvOut);
  [PreserveSig] int GetPropertyStore(int flags, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int GetPropertyDescriptionList(IntPtr keyType, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int GetAttributes(uint attribFlags, uint sfgaoMask, out uint psfgaoAttribs);
  [PreserveSig] int GetCount(out uint pdwNumItems);
  [PreserveSig] int GetItemAt(uint dwIndex, out DesktopPetIShellItem ppsi);
  [PreserveSig] int EnumItems(out IntPtr ppenumShellItems);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
public interface DesktopPetIShellItem {
  [PreserveSig] int BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int GetParent(out DesktopPetIShellItem ppsi);
  [PreserveSig] int GetDisplayName(uint sigdnName, out IntPtr ppszName);
  [PreserveSig] int GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
  [PreserveSig] int Compare(DesktopPetIShellItem psi, uint hint, out int piOrder);
}

public static class DesktopPetDesktopIconFolderViewReader {
  private const int CSIDL_DESKTOP = 0;
  private const int DEFAULT_ICON_HEIGHT = 74;
  private const int DEFAULT_ICON_WIDTH = 96;
  private const uint SIGDN_FILESYSPATH = 0x80058000;
  private const uint SIGDN_NORMALDISPLAY = 0;
  private const uint SVGIO_ALLVIEW = 2;
  private const int SWC_DESKTOP = 8;
  private const int SWFO_NEEDDISPATCH = 1;

  [DllImport("ole32.dll")]
  private static extern void CoTaskMemFree(IntPtr pv);

  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr hWnd, out DesktopPetFolderViewRect lpRect);

  public static DesktopPetDesktopIconInfo[] GetIcons() {
    int hwnd;
    DesktopPetIFolderView folderView = GetDesktopFolderView(out hwnd);
    if (folderView == null) {
      return new DesktopPetDesktopIconInfo[0];
    }

    int count;
    if (folderView.ItemCount(SVGIO_ALLVIEW, out count) != 0 || count <= 0) {
      return new DesktopPetDesktopIconInfo[0];
    }

    DesktopPetIShellItemArray shellItems = GetShellItemArray(folderView);
    uint shellItemCount = 0;
    if (shellItems != null) {
      shellItems.GetCount(out shellItemCount);
    }

    DesktopPetFolderViewRect viewRect;
    if (!GetWindowRect(new IntPtr(hwnd), out viewRect)) {
      viewRect = new DesktopPetFolderViewRect();
    }

    DesktopPetFolderViewPoint spacing = new DesktopPetFolderViewPoint();
    folderView.GetSpacing(out spacing);
    int cellWidth = spacing.X > 0 ? spacing.X : DEFAULT_ICON_WIDTH;
    int cellHeight = spacing.Y > 0 ? spacing.Y : DEFAULT_ICON_HEIGHT;

    List<DesktopPetDesktopIconInfo> icons = new List<DesktopPetDesktopIconInfo>();
    for (int index = 0; index < count; index += 1) {
      IntPtr pidl;
      DesktopPetFolderViewPoint point;
      if (folderView.Item(index, out pidl) != 0 || folderView.GetItemPosition(pidl, out point) != 0) {
        continue;
      }

      string name = "";
      string filePath = "";
      if (shellItems != null && index < shellItemCount) {
        DesktopPetIShellItem shellItem;
        if (shellItems.GetItemAt((uint)index, out shellItem) == 0 && shellItem != null) {
          name = GetShellItemDisplayName(shellItem, SIGDN_NORMALDISPLAY);
          filePath = GetShellItemDisplayName(shellItem, SIGDN_FILESYSPATH);
        }
      }

      int x = viewRect.Left + point.X;
      int y = viewRect.Top + point.Y;
      string extension = String.IsNullOrWhiteSpace(filePath)
        ? ""
        : Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();

      icons.Add(new DesktopPetDesktopIconInfo {
        canMove = true,
        desktopGridCellHeight = cellHeight,
        desktopGridCellWidth = cellWidth,
        extension = extension,
        filePath = filePath,
        height = DEFAULT_ICON_HEIGHT,
        index = index,
        name = String.IsNullOrWhiteSpace(name) ? "Desktop item " + (index + 1).ToString() : name,
        path = filePath,
        positionSource = "folder-view",
        width = DEFAULT_ICON_WIDTH,
        x = x,
        y = y,
        centerX = x + DEFAULT_ICON_WIDTH / 2,
        centerY = y + DEFAULT_ICON_HEIGHT / 2
      });
    }

    return icons.ToArray();
  }

  private static DesktopPetIFolderView GetDesktopFolderView(out int hwnd) {
    hwnd = 0;
    try {
      object loc = CSIDL_DESKTOP;
      object root = Type.Missing;
      DesktopPetIShellWindows shellWindows = (DesktopPetIShellWindows)new DesktopPetShellWindows();
      object dispatch = shellWindows.FindWindowSW(ref loc, ref root, SWC_DESKTOP, out hwnd, SWFO_NEEDDISPATCH);
      DesktopPetIServiceProviderRaw serviceProvider = dispatch as DesktopPetIServiceProviderRaw;
      if (serviceProvider == null) {
        return null;
      }

      DesktopPetIFolderView shellBrowserFolderView = GetFolderViewFromShellBrowser(serviceProvider);
      if (shellBrowserFolderView != null) {
        return shellBrowserFolderView;
      }

      return GetFolderViewDirectly(serviceProvider);
    } catch {
      return null;
    }
  }

  private static DesktopPetIFolderView GetFolderViewFromShellBrowser(DesktopPetIServiceProviderRaw serviceProvider) {
    Guid sidTopLevelBrowser = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
    Guid iidShellBrowser = new Guid("000214E2-0000-0000-C000-000000000046");
    Guid iidFolderView = new Guid("cde725b0-ccc9-4519-917e-325d72fab4ce");
    IntPtr shellBrowserPtr = IntPtr.Zero;
    IntPtr shellViewPtr = IntPtr.Zero;
    IntPtr folderViewPtr = IntPtr.Zero;

    try {
      int hr = serviceProvider.QueryService(ref sidTopLevelBrowser, ref iidShellBrowser, out shellBrowserPtr);
      if (hr != 0 || shellBrowserPtr == IntPtr.Zero) {
        return null;
      }

      DesktopPetIShellBrowser shellBrowser = (DesktopPetIShellBrowser)Marshal.GetObjectForIUnknown(shellBrowserPtr);
      hr = shellBrowser.QueryActiveShellView(out shellViewPtr);
      if (hr != 0 || shellViewPtr == IntPtr.Zero) {
        return null;
      }

      hr = Marshal.QueryInterface(shellViewPtr, ref iidFolderView, out folderViewPtr);
      if (hr != 0 || folderViewPtr == IntPtr.Zero) {
        return null;
      }

      return (DesktopPetIFolderView)Marshal.GetObjectForIUnknown(folderViewPtr);
    } catch {
      return null;
    } finally {
      if (folderViewPtr != IntPtr.Zero) {
        Marshal.Release(folderViewPtr);
      }
      if (shellViewPtr != IntPtr.Zero) {
        Marshal.Release(shellViewPtr);
      }
      if (shellBrowserPtr != IntPtr.Zero) {
        Marshal.Release(shellBrowserPtr);
      }
    }
  }

  private static DesktopPetIFolderView GetFolderViewDirectly(DesktopPetIServiceProviderRaw serviceProvider) {
    Guid sidFolderView = new Guid("cde725b0-ccc9-4519-917e-325d72fab4ce");
    Guid iidFolderView = new Guid("cde725b0-ccc9-4519-917e-325d72fab4ce");
    IntPtr folderViewPtr = IntPtr.Zero;

    try {
      int hr = serviceProvider.QueryService(ref sidFolderView, ref iidFolderView, out folderViewPtr);
      if (hr != 0 || folderViewPtr == IntPtr.Zero) {
        return null;
      }

      return (DesktopPetIFolderView)Marshal.GetObjectForIUnknown(folderViewPtr);
    } catch {
      return null;
    } finally {
      if (folderViewPtr != IntPtr.Zero) {
        Marshal.Release(folderViewPtr);
      }
    }
  }

  private static DesktopPetIShellItemArray GetShellItemArray(DesktopPetIFolderView folderView) {
    Guid iidShellItemArray = new Guid("b63ea76d-1f85-456f-a19c-48159efa858b");
    IntPtr shellItemArrayPtr = IntPtr.Zero;
    int hr = folderView.Items(SVGIO_ALLVIEW, ref iidShellItemArray, out shellItemArrayPtr);
    if (hr != 0 || shellItemArrayPtr == IntPtr.Zero) {
      return null;
    }

    try {
      return (DesktopPetIShellItemArray)Marshal.GetObjectForIUnknown(shellItemArrayPtr);
    } finally {
      Marshal.Release(shellItemArrayPtr);
    }
  }

  private static string GetShellItemDisplayName(DesktopPetIShellItem shellItem, uint sigdn) {
    IntPtr namePtr;
    int hr = shellItem.GetDisplayName(sigdn, out namePtr);
    if (hr != 0 || namePtr == IntPtr.Zero) {
      return "";
    }

    try {
      return Marshal.PtrToStringUni(namePtr) ?? "";
    } finally {
      CoTaskMemFree(namePtr);
    }
  }
}
"@

    return [DesktopPetDesktopIconFolderViewReader]::GetIcons()
  } catch {
    return @()
  }
}
`;
}

function getDesktopIconPowerShellScript(options = {}) {
  const includeReadOnlyPositionFallback = Boolean(options?.includeReadOnlyPositionFallback);
  return String.raw`
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$IncludeReadOnlyPositionFallback = ${includeReadOnlyPositionFallback ? '$true' : '$false'}

Add-Type -TypeDefinition @"
using System;
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

  public static DesktopPetDesktopIconInfo[] GetIcons() {
    TryEnableDpiAwareness();
    IntPtr listView = FindDesktopListView();
    if (listView == IntPtr.Zero) {
      return new DesktopPetDesktopIconInfo[0];
    }

    uint processId;
    GetWindowThreadProcessId(listView, out processId);
    if (processId == 0) {
      return new DesktopPetDesktopIconInfo[0];
    }

    IntPtr process = OpenProcess(
      PROCESS_QUERY_INFORMATION | PROCESS_VM_OPERATION | PROCESS_VM_READ | PROCESS_VM_WRITE,
      false,
      processId
    );
    if (process == IntPtr.Zero) {
      return new DesktopPetDesktopIconInfo[0];
    }

    IntPtr remotePoint = IntPtr.Zero;
    IntPtr remoteText = IntPtr.Zero;
    IntPtr remoteItem = IntPtr.Zero;

    try {
      int count = SendMessage(listView, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
      if (count <= 0) {
        return new DesktopPetDesktopIconInfo[0];
      }

      RECT listViewRect;
      if (!GetWindowRect(listView, out listViewRect)) {
        listViewRect = new RECT();
      }
      POINT itemSpacing = GetIconSpacing(listView);

      remotePoint = VirtualAllocEx(process, IntPtr.Zero, (UIntPtr)Marshal.SizeOf(typeof(POINT)), MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
      remoteText = VirtualAllocEx(process, IntPtr.Zero, (UIntPtr)(TEXT_BUFFER_CHARS * 2), MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
      remoteItem = VirtualAllocEx(process, IntPtr.Zero, (UIntPtr)Marshal.SizeOf(typeof(LVITEM)), MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
      if (remotePoint == IntPtr.Zero || remoteText == IntPtr.Zero || remoteItem == IntPtr.Zero) {
        return new DesktopPetDesktopIconInfo[0];
      }

      List<DesktopPetDesktopIconInfo> icons = new List<DesktopPetDesktopIconInfo>();
      for (int index = 0; index < count; index += 1) {
        POINT point;
        if (!TryReadPoint(listView, process, remotePoint, index, out point)) {
          continue;
        }

        string name = TryReadText(listView, process, remoteText, remoteItem, index);
        int x = listViewRect.Left + point.X;
        int y = listViewRect.Top + point.Y;

        icons.Add(new DesktopPetDesktopIconInfo {
          canMove = true,
          index = index,
          name = String.IsNullOrWhiteSpace(name) ? "Desktop item " + (index + 1).ToString() : name,
          positionSource = "shell-list-view",
          x = x,
          y = y,
          width = DEFAULT_ICON_WIDTH,
          height = DEFAULT_ICON_HEIGHT,
          centerX = x + DEFAULT_ICON_WIDTH / 2,
          centerY = y + DEFAULT_ICON_HEIGHT / 2,
          desktopGridCellWidth = itemSpacing.X,
          desktopGridCellHeight = itemSpacing.Y
        });
      }

      return icons.ToArray();
    } finally {
      if (remotePoint != IntPtr.Zero) {
        VirtualFreeEx(process, remotePoint, UIntPtr.Zero, MEM_RELEASE);
      }
      if (remoteText != IntPtr.Zero) {
        VirtualFreeEx(process, remoteText, UIntPtr.Zero, MEM_RELEASE);
      }
      if (remoteItem != IntPtr.Zero) {
        VirtualFreeEx(process, remoteItem, UIntPtr.Zero, MEM_RELEASE);
      }
      CloseHandle(process);
    }
  }

  private static bool TryReadPoint(IntPtr listView, IntPtr process, IntPtr remotePoint, int index, out POINT point) {
    point = new POINT();
    SendMessage(listView, LVM_GETITEMPOSITION, (IntPtr)index, remotePoint);
    byte[] pointBytes = new byte[Marshal.SizeOf(typeof(POINT))];
    IntPtr bytesRead;
    if (!ReadProcessMemory(process, remotePoint, pointBytes, pointBytes.Length, out bytesRead)) {
      return false;
    }

    point.X = BitConverter.ToInt32(pointBytes, 0);
    point.Y = BitConverter.ToInt32(pointBytes, 4);
    return true;
  }

  private static POINT GetIconSpacing(IntPtr listView) {
    POINT spacing = new POINT();
    int packedSpacing = SendMessage(listView, LVM_GETITEMSPACING, IntPtr.Zero, IntPtr.Zero).ToInt32();
    int width = packedSpacing & 0xFFFF;
    int height = (packedSpacing >> 16) & 0xFFFF;

    spacing.X = width > 0 ? width : DEFAULT_ICON_WIDTH;
    spacing.Y = height > 0 ? height : DEFAULT_ICON_HEIGHT;
    return spacing;
  }

  private static string TryReadText(IntPtr listView, IntPtr process, IntPtr remoteText, IntPtr remoteItem, int index) {
    LVITEM item = new LVITEM();
    item.iItem = index;
    item.iSubItem = 0;
    item.pszText = remoteText;
    item.cchTextMax = TEXT_BUFFER_CHARS;

    byte[] itemBytes = StructureToBytes(item);
    IntPtr bytesWritten;
    if (!WriteProcessMemory(process, remoteItem, itemBytes, itemBytes.Length, out bytesWritten)) {
      return "";
    }

    SendMessage(listView, LVM_GETITEMTEXTW, (IntPtr)index, remoteItem);
    byte[] textBytes = new byte[TEXT_BUFFER_CHARS * 2];
    IntPtr bytesRead;
    if (!ReadProcessMemory(process, remoteText, textBytes, textBytes.Length, out bytesRead)) {
      return "";
    }

    string text = Encoding.Unicode.GetString(textBytes);
    int nullIndex = text.IndexOf('\0');
    return nullIndex >= 0 ? text.Substring(0, nullIndex) : text;
  }

  private static byte[] StructureToBytes(object value) {
    int size = Marshal.SizeOf(value);
    byte[] bytes = new byte[size];
    IntPtr buffer = Marshal.AllocHGlobal(size);
    try {
      Marshal.StructureToPtr(value, buffer, false);
      Marshal.Copy(buffer, bytes, 0, size);
      return bytes;
    } finally {
      Marshal.FreeHGlobal(buffer);
    }
  }

  private static IntPtr FindDesktopListView() {
    IntPtr progman = FindWindow("Progman", null);
    List<IntPtr> candidates = new List<IntPtr>();

    AddListViewCandidates(progman, candidates);
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      string className = GetWindowClassName(hWnd);
      if (className == "Progman" || className == "WorkerW") {
        AddListViewCandidates(hWnd, candidates);
      }

      return true;
    }, IntPtr.Zero);

    IntPtr bestCandidate = ChooseBestListViewCandidate(candidates);
    if (bestCandidate != IntPtr.Zero) {
      return bestCandidate;
    }

    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      AddListViewCandidates(hWnd, candidates);
      return true;
    }, IntPtr.Zero);

    return ChooseBestListViewCandidate(candidates);
  }

  private static void AddListViewCandidates(IntPtr root, List<IntPtr> candidates) {
    if (root == IntPtr.Zero) {
      return;
    }

    EnumChildWindows(root, delegate(IntPtr child, IntPtr lParam) {
      if (GetWindowClassName(child) == "SysListView32" && !candidates.Contains(child)) {
        candidates.Add(child);
      }

      return true;
    }, IntPtr.Zero);
  }

  private static IntPtr ChooseBestListViewCandidate(List<IntPtr> candidates) {
    IntPtr bestCandidate = IntPtr.Zero;
    int bestCount = 0;

    foreach (IntPtr candidate in candidates) {
      int count = SendMessage(candidate, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
      if (count > bestCount) {
        bestCandidate = candidate;
        bestCount = count;
      }
    }

    return bestCandidate;
  }

  private static string GetWindowClassName(IntPtr hWnd) {
    StringBuilder className = new StringBuilder(256);
    GetClassName(hWnd, className, className.Capacity);
    return className.ToString();
  }
}
"@

$icons = [DesktopPetDesktopIconReader]::GetIcons()
${getDesktopIconFolderViewReaderPowerShellBlock()}
if (@($icons).Count -eq 0) {
  $folderViewIcons = Get-DesktopPetFolderViewIcons
  if (@($folderViewIcons).Count -gt 0) {
    $icons = $folderViewIcons
  }
}
if ($IncludeReadOnlyPositionFallback -and @($icons).Count -eq 0) {
  try {
    Add-Type -ReferencedAssemblies @('UIAutomationClient', 'UIAutomationTypes', 'WindowsBase') -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using System.Windows.Automation;

public class DesktopPetDesktopIconAutomationInfo {
  public bool canMove { get; set; }
  public int index { get; set; }
  public string name { get; set; }
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

public static class DesktopPetDesktopIconAutomationReader {
  private const int DEFAULT_ICON_WIDTH = 96;
  private const int DEFAULT_ICON_HEIGHT = 74;
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDPIAware();

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

  public static DesktopPetDesktopIconAutomationInfo[] GetIcons() {
    TryEnableDpiAwareness();
    List<IntPtr> candidates = FindDesktopListViews();
    List<DesktopPetDesktopIconAutomationInfo> bestIcons = new List<DesktopPetDesktopIconAutomationInfo>();

    foreach (IntPtr candidate in candidates) {
      List<DesktopPetDesktopIconAutomationInfo> icons = ReadListViewItems(candidate);
      if (icons.Count > bestIcons.Count) {
        bestIcons = icons;
      }
    }

    return bestIcons.ToArray();
  }

  private static List<DesktopPetDesktopIconAutomationInfo> ReadListViewItems(IntPtr listView) {
    List<DesktopPetDesktopIconAutomationInfo> icons = new List<DesktopPetDesktopIconAutomationInfo>();
    if (listView == IntPtr.Zero) {
      return icons;
    }

    AutomationElement element = null;
    try {
      element = AutomationElement.FromHandle(listView);
    } catch {
      return icons;
    }

    if (element == null) {
      return icons;
    }

    AutomationElementCollection items;
    try {
      Condition listItemCondition = new PropertyCondition(
        AutomationElement.ControlTypeProperty,
        ControlType.ListItem
      );
      items = element.FindAll(TreeScope.Children, listItemCondition);
      if (items == null || items.Count == 0) {
        items = element.FindAll(TreeScope.Descendants, listItemCondition);
      }
    } catch {
      return icons;
    }

    if (items == null || items.Count == 0) {
      return icons;
    }

    int index = 0;
    foreach (AutomationElement item in items) {
      try {
        string name = item.Current.Name;
        Rect rect = item.Current.BoundingRectangle;
        if (String.IsNullOrWhiteSpace(name) || rect.IsEmpty || rect.Width <= 1 || rect.Height <= 1) {
          continue;
        }

        object offscreenValue = item.GetCurrentPropertyValue(AutomationElement.IsOffscreenProperty, true);
        if (offscreenValue is bool && (bool)offscreenValue) {
          continue;
        }

        int x = (int)Math.Round(rect.Left);
        int y = (int)Math.Round(rect.Top);
        int width = Math.Max(1, (int)Math.Round(rect.Width));
        int height = Math.Max(1, (int)Math.Round(rect.Height));
        icons.Add(new DesktopPetDesktopIconAutomationInfo {
          canMove = false,
          index = index,
          name = name,
          positionSource = "ui-automation",
          x = x,
          y = y,
          width = width,
          height = height,
          centerX = x + width / 2,
          centerY = y + height / 2,
          desktopGridCellWidth = DEFAULT_ICON_WIDTH,
          desktopGridCellHeight = DEFAULT_ICON_HEIGHT
        });
        index += 1;
      } catch {
      }
    }

    return icons;
  }

  private static List<IntPtr> FindDesktopListViews() {
    IntPtr progman = FindWindow("Progman", null);
    List<IntPtr> candidates = new List<IntPtr>();

    AddListViewCandidates(progman, candidates);
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      string className = GetWindowClassName(hWnd);
      if (className == "Progman" || className == "WorkerW") {
        AddListViewCandidates(hWnd, candidates);
      }

      return true;
    }, IntPtr.Zero);

    return candidates;
  }

  private static void AddListViewCandidates(IntPtr root, List<IntPtr> candidates) {
    if (root == IntPtr.Zero) {
      return;
    }

    EnumChildWindows(root, delegate(IntPtr child, IntPtr lParam) {
      if (GetWindowClassName(child) == "SysListView32" && !candidates.Contains(child)) {
        candidates.Add(child);
      }

      return true;
    }, IntPtr.Zero);
  }

  private static string GetWindowClassName(IntPtr hWnd) {
    StringBuilder className = new StringBuilder(256);
    GetClassName(hWnd, className, className.Capacity);
    return className.ToString();
  }
}
"@
    $automationIcons = [DesktopPetDesktopIconAutomationReader]::GetIcons()
    if (@($automationIcons).Count -gt 0) {
      $icons = $automationIcons
    }
  } catch {
  }
}
function Get-DesktopPetDesktopFolders {
  $folders = New-Object System.Collections.Generic.List[string]
  foreach ($kind in @('Desktop', 'CommonDesktopDirectory')) {
    try {
      $folder = [Environment]::GetFolderPath($kind)
      if (-not [string]::IsNullOrWhiteSpace($folder) -and (Test-Path -LiteralPath $folder)) {
        $folders.Add($folder)
      }
    } catch {}
  }

  $folders | Select-Object -Unique
}

function Get-DesktopPetShortcutTargetPath($entry) {
  $extension = [IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
  if ($extension -ne '.lnk') {
    return ''
  }

  try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($entry.FullName)
    return [string]$shortcut.TargetPath
  } catch {
    return ''
  }
}

function New-DesktopPetFileMetadata($entry) {
  $extension = ''
  if (-not $entry.PSIsContainer) {
    $extension = [IO.Path]::GetExtension($entry.Name).TrimStart('.').ToLowerInvariant()
  }
  $rawExtension = if ($entry.PSIsContainer) { '' } else { [IO.Path]::GetExtension($entry.Name).ToLowerInvariant() }
  $isShortcut = @('.lnk', '.url', '.appref-ms') -contains $rawExtension
  $targetPath = Get-DesktopPetShortcutTargetPath $entry

  [pscustomobject]@{
    extension = $extension
    filePath = [string]$entry.FullName
    isDirectory = [bool]$entry.PSIsContainer
    isFile = -not [bool]$entry.PSIsContainer
    isShortcut = [bool]$isShortcut
    isSystemIcon = $false
    itemKind = if ($entry.PSIsContainer) { 'folder' } elseif ($isShortcut) { 'shortcut' } else { 'file' }
    path = [string]$entry.FullName
    targetPath = $targetPath
  }
}

function Add-DesktopPetMetadataCandidate($map, $key, $metadata) {
  if ([string]::IsNullOrWhiteSpace($key)) {
    return
  }

  $normalizedKey = $key.Trim().ToLowerInvariant()
  if (-not $map.ContainsKey($normalizedKey)) {
    $map[$normalizedKey] = New-Object System.Collections.Generic.List[object]
  }

  $map[$normalizedKey].Add($metadata)
}

function Get-DesktopPetFileMetadataMap {
  $map = @{}
  foreach ($folder in Get-DesktopPetDesktopFolders) {
    try {
      foreach ($entry in Get-ChildItem -LiteralPath $folder -Force -ErrorAction SilentlyContinue) {
        $metadata = New-DesktopPetFileMetadata $entry
        Add-DesktopPetMetadataCandidate $map $entry.Name $metadata
        if (-not $entry.PSIsContainer) {
          Add-DesktopPetMetadataCandidate $map ([IO.Path]::GetFileNameWithoutExtension($entry.Name)) $metadata
        }
      }
    } catch {}
  }

  return $map
}

function Find-DesktopPetFileMetadata($map, $name) {
  if ([string]::IsNullOrWhiteSpace($name)) {
    return $null
  }

  try {
    $normalizedName = ([string]$name).Trim().ToLowerInvariant()
    if (-not $map.ContainsKey($normalizedName)) {
      return $null
    }

    $matchValue = $map[$normalizedName]
    $matches = @($matchValue)
    if ($matches.Count -ne 1) {
      return $null
    }

    return $matches[0]
  } catch {
    return $null
  }
}

function Test-DesktopPetSystemIconName($name) {
  if ([string]::IsNullOrWhiteSpace($name)) {
    return $false
  }

  $normalizedName = $name.Trim().ToLowerInvariant()
  return @(
    'control panel',
    'network',
    'recycle bin',
    'this pc'
  ) -contains $normalizedName
}

function Add-DesktopPetIconProperty($icon, $name, $value) {
  if ($null -eq $value) {
    return
  }

  $icon | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force
}

function Resolve-DesktopPetIconMetadata($icons) {
  if ($null -eq $icons) {
    return @()
  }

  $metadataMap = Get-DesktopPetFileMetadataMap
  foreach ($icon in @($icons)) {
    try {
      $metadata = Find-DesktopPetFileMetadata $metadataMap $icon.name
      if ($null -ne $metadata) {
        foreach ($propertyName in @('extension', 'filePath', 'isDirectory', 'isFile', 'isShortcut', 'isSystemIcon', 'itemKind', 'path', 'targetPath')) {
          Add-DesktopPetIconProperty $icon $propertyName $metadata.$propertyName
        }
      } elseif (Test-DesktopPetSystemIconName $icon.name) {
        Add-DesktopPetIconProperty $icon 'isSystemIcon' $true
        Add-DesktopPetIconProperty $icon 'itemKind' 'system-icon'
      }
    } catch {}
  }

  return @($icons)
}

$icons = Resolve-DesktopPetIconMetadata $icons
if ($null -eq $icons) {
  @() | ConvertTo-Json -Depth 4 -Compress
} else {
  @($icons) | ConvertTo-Json -Depth 4 -Compress
}
`;
}

function getDesktopIconFolderViewMovePowerShellScript({ index, nativeScreenX, nativeScreenY }) {
  const targetIndex = Math.max(0, Math.round(Number(index)));
  const targetX = Math.round(Number(nativeScreenX));
  const targetY = Math.round(Number(nativeScreenY));

  return String.raw`
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$TargetIndex = ${targetIndex}
$ScreenX = ${targetX}
$ScreenY = ${targetY}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("9BA05972-F6A8-11CF-A442-00A0C90A8F39")]
public class DesktopPetShellWindowsMove {
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIDispatch), Guid("85CB6900-4D95-11CF-960C-0080C7F4EE85")]
public interface DesktopPetIShellWindowsMove {
  [return: MarshalAs(UnmanagedType.IDispatch)]
  object FindWindowSW(ref object pvarLoc, ref object pvarLocRoot, int swClass, out int pHWND, int swfwOptions);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("6d5140c1-7436-11ce-8034-00aa006009fa")]
public interface DesktopPetIServiceProviderRawMove {
  [PreserveSig]
  int QueryService(ref Guid guidService, ref Guid riid, out IntPtr ppvObject);
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214E2-0000-0000-C000-000000000046")]
public interface DesktopPetIShellBrowserMove {
  [PreserveSig] int GetWindow(out IntPtr phwnd);
  [PreserveSig] int ContextSensitiveHelp(bool fEnterMode);
  [PreserveSig] int InsertMenusSB(IntPtr hmenuShared, IntPtr lpMenuWidths);
  [PreserveSig] int SetMenuSB(IntPtr hmenuShared, IntPtr holemenuRes, IntPtr hwndActiveObject);
  [PreserveSig] int RemoveMenusSB(IntPtr hmenuShared);
  [PreserveSig] int SetStatusTextSB(IntPtr pszStatusText);
  [PreserveSig] int EnableModelessSB(bool fEnable);
  [PreserveSig] int TranslateAcceleratorSB(IntPtr pmsg, short wID);
  [PreserveSig] int BrowseObject(IntPtr pidl, uint wFlags);
  [PreserveSig] int GetViewStateStream(uint grfMode, out IntPtr ppStrm);
  [PreserveSig] int GetControlWindow(uint id, out IntPtr lphwnd);
  [PreserveSig] int SendControlMsg(uint id, uint uMsg, IntPtr wParam, IntPtr lParam, out IntPtr pret);
  [PreserveSig] int QueryActiveShellView(out IntPtr ppshv);
  [PreserveSig] int OnViewWindowActive(IntPtr pshv);
  [PreserveSig] int SetToolbarItems(IntPtr lpButtons, uint nButtons, uint uFlags);
}

[StructLayout(LayoutKind.Sequential)]
public struct DesktopPetFolderViewMovePoint {
  public int X;
  public int Y;
}

[StructLayout(LayoutKind.Sequential)]
public struct DesktopPetFolderViewMoveRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("cde725b0-ccc9-4519-917e-325d72fab4ce")]
public interface DesktopPetIFolderViewMove {
  [PreserveSig] int GetCurrentViewMode(out uint pViewMode);
  [PreserveSig] int SetCurrentViewMode(uint ViewMode);
  [PreserveSig] int GetFolder(ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppv);
  [PreserveSig] int Item(int iItemIndex, out IntPtr ppidl);
  [PreserveSig] int ItemCount(uint uFlags, out int pcItems);
  [PreserveSig] int Items(uint uFlags, ref Guid riid, out IntPtr ppv);
  [PreserveSig] int GetSelectionMarkedItem(out int piItem);
  [PreserveSig] int GetFocusedItem(out int piItem);
  [PreserveSig] int GetItemPosition(IntPtr pidl, out DesktopPetFolderViewMovePoint ppt);
  [PreserveSig] int GetSpacing(out DesktopPetFolderViewMovePoint ppt);
  [PreserveSig] int GetDefaultSpacing(out DesktopPetFolderViewMovePoint ppt);
  [PreserveSig] int GetAutoArrange();
  [PreserveSig] int SelectItem(int iItem, uint dwFlags);
  [PreserveSig] int SelectAndPositionItems(uint cidl, IntPtr apidl, IntPtr apt, uint dwFlags);
}

public static class DesktopPetDesktopIconFolderViewMover {
  private const int CSIDL_DESKTOP = 0;
  private const uint SVGIO_ALLVIEW = 2;
  private const int SWC_DESKTOP = 8;
  private const int SWFO_NEEDDISPATCH = 1;

  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr hWnd, out DesktopPetFolderViewMoveRect lpRect);

  public static bool MoveIcon(int index, int nativeScreenX, int nativeScreenY) {
    int hwnd;
    DesktopPetIFolderViewMove folderView = GetDesktopFolderView(out hwnd);
    if (folderView == null) {
      return false;
    }

    int count;
    if (folderView.ItemCount(SVGIO_ALLVIEW, out count) != 0 || index < 0 || index >= count) {
      return false;
    }

    IntPtr pidl;
    if (folderView.Item(index, out pidl) != 0 || pidl == IntPtr.Zero) {
      return false;
    }

    DesktopPetFolderViewMoveRect viewRect;
    if (!GetWindowRect(new IntPtr(hwnd), out viewRect)) {
      viewRect = new DesktopPetFolderViewMoveRect();
    }

    DesktopPetFolderViewMovePoint point = new DesktopPetFolderViewMovePoint {
      X = nativeScreenX - viewRect.Left,
      Y = nativeScreenY - viewRect.Top
    };
    IntPtr pidlArray = IntPtr.Zero;
    IntPtr pointArray = IntPtr.Zero;

    try {
      pidlArray = Marshal.AllocHGlobal(IntPtr.Size);
      Marshal.WriteIntPtr(pidlArray, pidl);
      pointArray = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(DesktopPetFolderViewMovePoint)));
      Marshal.StructureToPtr(point, pointArray, false);
      return folderView.SelectAndPositionItems(1, pidlArray, pointArray, 0) == 0;
    } finally {
      if (pidlArray != IntPtr.Zero) {
        Marshal.FreeHGlobal(pidlArray);
      }
      if (pointArray != IntPtr.Zero) {
        Marshal.FreeHGlobal(pointArray);
      }
    }
  }

  private static DesktopPetIFolderViewMove GetDesktopFolderView(out int hwnd) {
    hwnd = 0;
    try {
      object loc = CSIDL_DESKTOP;
      object root = Type.Missing;
      DesktopPetIShellWindowsMove shellWindows = (DesktopPetIShellWindowsMove)new DesktopPetShellWindowsMove();
      object dispatch = shellWindows.FindWindowSW(ref loc, ref root, SWC_DESKTOP, out hwnd, SWFO_NEEDDISPATCH);
      DesktopPetIServiceProviderRawMove serviceProvider = dispatch as DesktopPetIServiceProviderRawMove;
      if (serviceProvider == null) {
        return null;
      }

      DesktopPetIFolderViewMove shellBrowserFolderView = GetFolderViewFromShellBrowser(serviceProvider);
      if (shellBrowserFolderView != null) {
        return shellBrowserFolderView;
      }

      return GetFolderViewDirectly(serviceProvider);
    } catch {
      return null;
    }
  }

  private static DesktopPetIFolderViewMove GetFolderViewFromShellBrowser(DesktopPetIServiceProviderRawMove serviceProvider) {
    Guid sidTopLevelBrowser = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
    Guid iidShellBrowser = new Guid("000214E2-0000-0000-C000-000000000046");
    Guid iidFolderView = new Guid("cde725b0-ccc9-4519-917e-325d72fab4ce");
    IntPtr shellBrowserPtr = IntPtr.Zero;
    IntPtr shellViewPtr = IntPtr.Zero;
    IntPtr folderViewPtr = IntPtr.Zero;

    try {
      int hr = serviceProvider.QueryService(ref sidTopLevelBrowser, ref iidShellBrowser, out shellBrowserPtr);
      if (hr != 0 || shellBrowserPtr == IntPtr.Zero) {
        return null;
      }

      DesktopPetIShellBrowserMove shellBrowser = (DesktopPetIShellBrowserMove)Marshal.GetObjectForIUnknown(shellBrowserPtr);
      hr = shellBrowser.QueryActiveShellView(out shellViewPtr);
      if (hr != 0 || shellViewPtr == IntPtr.Zero) {
        return null;
      }

      hr = Marshal.QueryInterface(shellViewPtr, ref iidFolderView, out folderViewPtr);
      if (hr != 0 || folderViewPtr == IntPtr.Zero) {
        return null;
      }

      return (DesktopPetIFolderViewMove)Marshal.GetObjectForIUnknown(folderViewPtr);
    } catch {
      return null;
    } finally {
      if (folderViewPtr != IntPtr.Zero) {
        Marshal.Release(folderViewPtr);
      }
      if (shellViewPtr != IntPtr.Zero) {
        Marshal.Release(shellViewPtr);
      }
      if (shellBrowserPtr != IntPtr.Zero) {
        Marshal.Release(shellBrowserPtr);
      }
    }
  }

  private static DesktopPetIFolderViewMove GetFolderViewDirectly(DesktopPetIServiceProviderRawMove serviceProvider) {
    Guid sidFolderView = new Guid("cde725b0-ccc9-4519-917e-325d72fab4ce");
    Guid iidFolderView = new Guid("cde725b0-ccc9-4519-917e-325d72fab4ce");
    IntPtr folderViewPtr = IntPtr.Zero;

    try {
      int hr = serviceProvider.QueryService(ref sidFolderView, ref iidFolderView, out folderViewPtr);
      if (hr != 0 || folderViewPtr == IntPtr.Zero) {
        return null;
      }

      return (DesktopPetIFolderViewMove)Marshal.GetObjectForIUnknown(folderViewPtr);
    } catch {
      return null;
    } finally {
      if (folderViewPtr != IntPtr.Zero) {
        Marshal.Release(folderViewPtr);
      }
    }
  }
}
"@

$ok = [DesktopPetDesktopIconFolderViewMover]::MoveIcon($TargetIndex, $ScreenX, $ScreenY)
@{ ok = $ok } | ConvertTo-Json -Depth 4 -Compress
`;
}

function getDesktopIconMovePowerShellScript({ index, nativeScreenX, nativeScreenY }) {
  const targetIndex = Math.max(0, Math.round(Number(index)));
  const targetX = Math.round(Number(nativeScreenX));
  const targetY = Math.round(Number(nativeScreenY));

  return String.raw`
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$TargetIndex = ${targetIndex}
$ScreenX = ${targetX}
$ScreenY = ${targetY}

Add-Type -TypeDefinition @"
using System;
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

  public static bool MoveIcon(int index, int nativeScreenX, int nativeScreenY) {
    TryEnableDpiAwareness();
    IntPtr listView = FindDesktopListView();
    if (listView == IntPtr.Zero) {
      return false;
    }

    int count = SendMessage(listView, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
    if (index < 0 || index >= count) {
      return false;
    }

    RECT listViewRect;
    if (!GetWindowRect(listView, out listViewRect)) {
      return false;
    }

    int clientX = nativeScreenX - listViewRect.Left;
    int clientY = nativeScreenY - listViewRect.Top;
    IntPtr packedPoint = (IntPtr)((clientY << 16) | (clientX & 0xFFFF));
    SendMessage(listView, LVM_SETITEMPOSITION, (IntPtr)index, packedPoint);
    return true;
  }

  private static IntPtr FindDesktopListView() {
    IntPtr progman = FindWindow("Progman", null);
    List<IntPtr> candidates = new List<IntPtr>();

    AddListViewCandidates(progman, candidates);
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      string className = GetWindowClassName(hWnd);
      if (className == "Progman" || className == "WorkerW") {
        AddListViewCandidates(hWnd, candidates);
      }

      return true;
    }, IntPtr.Zero);

    IntPtr bestCandidate = ChooseBestListViewCandidate(candidates);
    if (bestCandidate != IntPtr.Zero) {
      return bestCandidate;
    }

    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      AddListViewCandidates(hWnd, candidates);
      return true;
    }, IntPtr.Zero);

    return ChooseBestListViewCandidate(candidates);
  }

  private static void AddListViewCandidates(IntPtr root, List<IntPtr> candidates) {
    if (root == IntPtr.Zero) {
      return;
    }

    EnumChildWindows(root, delegate(IntPtr child, IntPtr lParam) {
      if (GetWindowClassName(child) == "SysListView32" && !candidates.Contains(child)) {
        candidates.Add(child);
      }

      return true;
    }, IntPtr.Zero);
  }

  private static IntPtr ChooseBestListViewCandidate(List<IntPtr> candidates) {
    IntPtr bestCandidate = IntPtr.Zero;
    int bestCount = 0;

    foreach (IntPtr candidate in candidates) {
      int count = SendMessage(candidate, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
      if (count > bestCount) {
        bestCandidate = candidate;
        bestCount = count;
      }
    }

    return bestCandidate;
  }

  private static string GetWindowClassName(IntPtr hWnd) {
    StringBuilder className = new StringBuilder(256);
    GetClassName(hWnd, className, className.Capacity);
    return className.ToString();
  }
}
"@

$ok = [DesktopPetDesktopIconMover]::MoveIcon($TargetIndex, $ScreenX, $ScreenY)
@{ ok = $ok } | ConvertTo-Json -Depth 4 -Compress
`;
}

function normalizeDesktopIcon(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const index = Number(value.index);
  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);
  const centerX = Number(value.centerX);
  const centerY = Number(value.centerY);
  const desktopGridCellWidth = Number(value.desktopGridCellWidth);
  const desktopGridCellHeight = Number(value.desktopGridCellHeight);
  if (![index, x, y, width, height, centerX, centerY].every(Number.isFinite)) {
    return null;
  }

  const rawName = typeof value.name === 'string' ? value.name : '';
  const sanitizedName = rawName
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e]/g, '')
    .trim();
  const normalizedIndex = Math.max(0, Math.round(index));
  const optionalStringFields = {};
  for (const key of ['filePath', 'itemKind', 'path', 'positionSource', 'targetPath']) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      optionalStringFields[key] = value[key].trim();
    }
  }

  const rawExtension = typeof value.extension === 'string'
    ? value.extension.trim().replace(/^\./, '').toLowerCase()
    : '';
  if (/^[a-z0-9][a-z0-9-]{0,15}$/.test(rawExtension)) {
    optionalStringFields.extension = rawExtension;
  }

  const optionalBooleanFields = {};
  for (const key of ['canMove', 'isDirectory', 'isFile', 'isShortcut', 'isSystemIcon']) {
    if (typeof value[key] === 'boolean') {
      optionalBooleanFields[key] = value[key];
    }
  }

  return {
    ...optionalStringFields,
    ...optionalBooleanFields,
    id: `desktop-icon-${normalizedIndex}`,
    index: normalizedIndex,
    name: sanitizedName || `Desktop item ${normalizedIndex + 1}`,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    centerX: Math.round(centerX),
    centerY: Math.round(centerY),
    desktopGridCellWidth: Number.isFinite(desktopGridCellWidth) && desktopGridCellWidth > 0
      ? Math.round(desktopGridCellWidth)
      : undefined,
    desktopGridCellHeight: Number.isFinite(desktopGridCellHeight) && desktopGridCellHeight > 0
      ? Math.round(desktopGridCellHeight)
      : undefined,
  };
}

function createDesktopIconService({ app, log, screen } = {}) {
  let cachedIcons = [];
  let cacheUpdatedAt = 0;
  let pendingRequest = null;

  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  function screenToPetCoordinate(point) {
    if (
      screen
      && typeof screen.screenToDipPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.screenToDipPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: convertedPoint.x,
            y: convertedPoint.y,
          };
        }
      } catch (error) {
        logMessage('desktop icon coordinate conversion failed', error?.stack || error);
      }
    }

    return point;
  }

  function petToScreenCoordinate(point) {
    if (
      screen
      && typeof screen.dipToScreenPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.dipToScreenPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: convertedPoint.x,
            y: convertedPoint.y,
          };
        }
      } catch (error) {
        logMessage('desktop icon reverse coordinate conversion failed', error?.stack || error);
      }
    }

    return point;
  }

  function attachDesktopIconCoordinateSpaces(icon) {
    if (!icon) {
      return null;
    }

    const topLeft = screenToPetCoordinate({ x: icon.x, y: icon.y });
    const bottomRight = screenToPetCoordinate({
      x: icon.x + icon.width,
      y: icon.y + icon.height,
    });
    const center = screenToPetCoordinate({ x: icon.centerX, y: icon.centerY });

    const nativeScreenIcon = {
      ...icon,
      coordinateSpace: 'native-screen',
      desktopGridCellHeight: icon.desktopGridCellHeight,
      desktopGridCellWidth: icon.desktopGridCellWidth,
      nativeScreenCenterX: Math.round(icon.centerX),
      nativeScreenCenterY: Math.round(icon.centerY),
      nativeScreenHeight: Math.max(1, Math.round(icon.height)),
      nativeScreenWidth: Math.max(1, Math.round(icon.width)),
      nativeScreenX: Math.round(icon.x),
      nativeScreenY: Math.round(icon.y),
    };

    return {
      ...nativeScreenIcon,
      dipCenterX: Math.round(center.x),
      dipCenterY: Math.round(center.y),
      dipHeight: Math.max(1, Math.round(Math.abs(bottomRight.y - topLeft.y))),
      dipWidth: Math.max(1, Math.round(Math.abs(bottomRight.x - topLeft.x))),
      dipX: Math.round(topLeft.x),
      dipY: Math.round(topLeft.y),
    };
  }

  function selectDesktopIconCoordinateSpace(icon, coordinateSpace = 'dip') {
    if (!icon) {
      return null;
    }

    if (coordinateSpace === 'native-screen') {
      return {
        ...icon,
        centerX: icon.nativeScreenCenterX ?? icon.centerX,
        centerY: icon.nativeScreenCenterY ?? icon.centerY,
        coordinateSpace: 'native-screen',
        desktopGridCellHeight: icon.desktopGridCellHeight,
        desktopGridCellWidth: icon.desktopGridCellWidth,
        height: icon.nativeScreenHeight ?? icon.height,
        width: icon.nativeScreenWidth ?? icon.width,
        x: icon.nativeScreenX ?? icon.x,
        y: icon.nativeScreenY ?? icon.y,
      };
    }

    return {
      ...icon,
      centerX: icon.dipCenterX ?? icon.centerX,
      centerY: icon.dipCenterY ?? icon.centerY,
      coordinateSpace: 'dip',
      desktopGridCellHeight: icon.desktopGridCellHeight,
      desktopGridCellWidth: icon.desktopGridCellWidth,
      height: icon.dipHeight ?? icon.height,
      width: icon.dipWidth ?? icon.width,
      x: icon.dipX ?? icon.x,
      y: icon.dipY ?? icon.y,
    };
  }

  function normalizeDesktopIconCoordinateSpaceOption(value) {
    return value === 'native-screen' ? 'native-screen' : 'dip';
  }

  function getDesktopFallbackFolders() {
    const folders = [];
    const userDesktop = app?.getPath?.('desktop');
    const publicRoot = process.env.PUBLIC || 'C:\\Users\\Public';
    const publicDesktop = path.join(publicRoot, 'Desktop');

    for (const folderPath of [userDesktop, publicDesktop]) {
      if (
        typeof folderPath === 'string'
        && folderPath.trim()
        && fs.existsSync(folderPath)
        && !folders.includes(folderPath)
      ) {
        folders.push(folderPath);
      }
    }

    return folders;
  }

  function createDesktopFileFallbackIcon(entry, index) {
    const fullPath = path.join(entry.folderPath, entry.name);
    const extension = entry.isDirectory
      ? ''
      : path.extname(entry.name).replace(/^\./, '').toLowerCase();
    const rawExtension = entry.isDirectory ? '' : path.extname(entry.name).toLowerCase();
    const isShortcut = ['.lnk', '.url', '.appref-ms'].includes(rawExtension);
    const x = 0;
    const y = index * 96;
    return {
      canMove: false,
      centerX: x + 48,
      centerY: y + 37,
      desktopGridCellHeight: 96,
      desktopGridCellWidth: 96,
      extension,
      filePath: fullPath,
      height: 74,
      index,
      isDirectory: entry.isDirectory,
      isFile: !entry.isDirectory,
      isShortcut,
      itemKind: entry.isDirectory ? 'folder' : isShortcut ? 'shortcut' : 'file',
      name: entry.name,
      path: fullPath,
      positionSource: 'filesystem-fallback',
      width: 96,
      x,
      y,
    };
  }

  function listDesktopFileFallbackIcons() {
    const entries = [];
    for (const folderPath of getDesktopFallbackFolders()) {
      try {
        for (const dirent of fs.readdirSync(folderPath, { withFileTypes: true })) {
          entries.push({
            folderPath,
            isDirectory: dirent.isDirectory(),
            name: dirent.name,
          });
        }
      } catch (error) {
        logMessage('desktop file fallback read failed', {
          error: error?.message || String(error),
          folderPath,
        });
      }
    }

    return entries
      .sort((first, second) => first.name.localeCompare(second.name, 'zh-CN'))
      .map(createDesktopFileFallbackIcon)
      .map(normalizeDesktopIcon)
      .map(attachDesktopIconCoordinateSpaces)
      .filter(Boolean);
  }

  function runPowerShellScript(script) {
    const tempRoot = app?.getPath?.('temp') || process.cwd();
    const scriptPath = path.join(
      tempRoot,
      `desktop-pet-icons-${process.pid}-${Date.now()}-${Math.round(Math.random() * 100000)}.ps1`,
    );

    fs.writeFileSync(scriptPath, script, 'utf8');

    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        {
          windowsHide: true,
          encoding: 'utf8',
          timeout: DESKTOP_ICON_SCRIPT_TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          fs.unlink(scriptPath, () => {});
          if (error) {
            reject(createDesktopIconPowerShellError(error, stdout, stderr));
            return;
          }

          resolve(stdout);
        },
      );
    });
  }

  async function fetchDesktopIcons(options = {}) {
    if (process.platform !== 'win32') {
      return [];
    }

    const stdout = await runPowerShellScript(getDesktopIconPowerShellScript({
      includeReadOnlyPositionFallback: Boolean(options?.includeReadOnlyPositionFallback),
    }));
    const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
    const rawIcons = Array.isArray(parsed) ? parsed : [parsed];
    return rawIcons
      .map(normalizeDesktopIcon)
      .map(attachDesktopIconCoordinateSpaces)
      .filter(Boolean);
  }

  async function resolveDesktopIconReadFallbacks(icons, options = {}) {
    const includeReadOnlyPositionFallback = Boolean(options?.includeReadOnlyPositionFallback);
    const includeFileSystemFallback = Boolean(options?.includeFileSystemFallback);
    if (includeReadOnlyPositionFallback && !icons.length) {
      try {
        const positionFallbackIcons = await fetchDesktopIcons({
          includeReadOnlyPositionFallback: true,
        });
        if (positionFallbackIcons.length) {
          logMessage('desktop icon read-only position fallback used', {
            count: positionFallbackIcons.length,
          });
          return positionFallbackIcons;
        }
      } catch (error) {
        logMessage('desktop icon read-only position fallback failed', error?.stack || error);
      }
    }

    if (includeFileSystemFallback && !icons.length) {
      const fileFallbackIcons = listDesktopFileFallbackIcons();
      if (fileFallbackIcons.length) {
        logMessage('desktop icon filesystem fallback used', { count: fileFallbackIcons.length });
      }
      return fileFallbackIcons;
    }

    return icons;
  }

  async function listDesktopIcons(options = {}) {
    const forceRefresh = Boolean(options?.forceRefresh);
    const includeFileSystemFallback = Boolean(options?.includeFileSystemFallback);
    const includeReadOnlyPositionFallback = Boolean(options?.includeReadOnlyPositionFallback);
    const wantsFallback = includeFileSystemFallback || includeReadOnlyPositionFallback;
    const coordinateSpace = normalizeDesktopIconCoordinateSpaceOption(options?.coordinateSpace);
    if (
      !forceRefresh
      && cacheUpdatedAt > 0
      && Date.now() - cacheUpdatedAt <= DESKTOP_ICON_CACHE_TTL_MS
      && (!wantsFallback || cachedIcons.length > 0)
    ) {
      return cachedIcons.map((icon) => selectDesktopIconCoordinateSpace(icon, coordinateSpace));
    }

    if (pendingRequest) {
      return pendingRequest.then(async (icons) => {
        const effectiveIcons = await resolveDesktopIconReadFallbacks(icons, {
          includeFileSystemFallback,
          includeReadOnlyPositionFallback,
        });
        return effectiveIcons.map((icon) => selectDesktopIconCoordinateSpace(icon, coordinateSpace));
      });
    }

    pendingRequest = fetchDesktopIcons()
      .then((icons) => {
        cachedIcons = icons;
        cacheUpdatedAt = Date.now();
        logMessage('desktop icons refreshed', { count: icons.length });
        return icons;
      })
      .catch((error) => {
        logMessage('desktop icons refresh failed', error?.stack || error);
        return cachedIcons;
      })
      .finally(() => {
        pendingRequest = null;
      });

    return pendingRequest.then(async (icons) => {
      const effectiveIcons = await resolveDesktopIconReadFallbacks(icons, {
        includeFileSystemFallback,
        includeReadOnlyPositionFallback,
      });
      return effectiveIcons.map((icon) => selectDesktopIconCoordinateSpace(icon, coordinateSpace));
    });
  }

  function findDesktopIconForMove(icons, request) {
    const iconId = typeof request?.iconId === 'string' ? request.iconId.trim() : '';
    const iconName = typeof request?.iconName === 'string' ? request.iconName.trim() : '';

    return icons.find((icon) => icon.id === iconId)
      || icons.find((icon) => icon.name === iconName)
      || null;
  }

  async function moveDesktopIcon(request = {}) {
    if (process.platform !== 'win32') {
      return {
        error: 'Desktop icon movement is only supported on Windows.',
        ok: false,
      };
    }

    const targetX = Number(request?.x);
    const targetY = Number(request?.y);
    if (![targetX, targetY].every(Number.isFinite)) {
      return {
        error: 'Invalid target position.',
        ok: false,
      };
    }

    const coordinateSpace = normalizeDesktopIconCoordinateSpaceOption(request?.coordinateSpace);
    const icons = await listDesktopIcons({ coordinateSpace, forceRefresh: true });
    const icon = findDesktopIconForMove(icons, request);
    if (!icon) {
      return {
        error: 'Desktop icon not found.',
        ok: false,
      };
    }

    const targetNativeScreenPoint = coordinateSpace === 'native-screen'
      ? {
          x: Math.round(targetX),
          y: Math.round(targetY),
        }
      : petToScreenCoordinate({
          x: Math.round(targetX),
          y: Math.round(targetY),
        });
    if (icon.canMove === false) {
      return {
        error: 'Desktop icon position source is read-only.',
        icon,
        ok: false,
      };
    }

    const moveScript = icon.positionSource === 'folder-view'
      ? getDesktopIconFolderViewMovePowerShellScript({
          index: icon.index,
          nativeScreenX: targetNativeScreenPoint.x,
          nativeScreenY: targetNativeScreenPoint.y,
        })
      : getDesktopIconMovePowerShellScript({
          index: icon.index,
          nativeScreenX: targetNativeScreenPoint.x,
          nativeScreenY: targetNativeScreenPoint.y,
        });
    let stdout = '';
    try {
      stdout = await runPowerShellScript(moveScript);
    } catch (error) {
      invalidate();
      const errorText = compactDesktopIconPowerShellError(error?.message || String(error));
      logMessage('desktop icon move PowerShell failed', {
        error: errorText,
        iconName: icon.name,
        positionSource: icon.positionSource,
        stderr: error?.stderr,
        stdout: error?.stdout,
        targetX: targetNativeScreenPoint.x,
        targetY: targetNativeScreenPoint.y,
      });
      return {
        error: errorText || 'PowerShell desktop icon move command failed.',
        icon,
        ok: false,
      };
    }
    const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
    if (!parsed?.ok) {
      invalidate();
      return {
        error: 'Windows desktop did not accept the icon movement request.',
        icon,
        ok: false,
      };
    }

    invalidate();
    const nextIcons = await listDesktopIcons({ coordinateSpace, forceRefresh: true });
    const movedIcon = findDesktopIconForMove(nextIcons, {
      iconId: icon.id,
      iconName: icon.name,
    });
    const tolerance = 8;
    const verified = Boolean(
      movedIcon
      && Math.abs(movedIcon.x - Math.round(targetX)) <= tolerance
      && Math.abs(movedIcon.y - Math.round(targetY)) <= tolerance
    );

    logMessage('desktop icon moved', {
      iconName: icon.name,
      targetX: Math.round(targetX),
      targetY: Math.round(targetY),
      verified,
    });

    return {
      icon: movedIcon ?? icon,
      ok: true,
      verified,
    };
  }

  function invalidate() {
    cacheUpdatedAt = 0;
  }

  return {
    invalidate,
    listDesktopIcons,
    moveDesktopIcon,
  };
}

module.exports = {
  createDesktopIconService,
};
