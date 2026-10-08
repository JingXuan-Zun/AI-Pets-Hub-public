const desktopIconFolderViewMoveInteropCSharp = String.raw`using System;
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

`;

module.exports = { desktopIconFolderViewMoveInteropCSharp };
