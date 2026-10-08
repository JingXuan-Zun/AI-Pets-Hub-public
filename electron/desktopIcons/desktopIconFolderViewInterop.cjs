const desktopIconFolderViewInteropCSharp = String.raw`using System;
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

`;

module.exports = { desktopIconFolderViewInteropCSharp };
