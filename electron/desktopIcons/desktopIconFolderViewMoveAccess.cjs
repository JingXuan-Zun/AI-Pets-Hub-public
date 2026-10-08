const desktopIconFolderViewMoveAccessCSharp = String.raw`  private static DesktopPetIFolderViewMove GetDesktopFolderView(out int hwnd) {
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
`;

module.exports = { desktopIconFolderViewMoveAccessCSharp };
