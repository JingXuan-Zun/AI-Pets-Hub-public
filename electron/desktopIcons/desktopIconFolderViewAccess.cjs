const desktopIconFolderViewAccessCSharp = String.raw`  private static DesktopPetIFolderView GetDesktopFolderView(out int hwnd) {
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
`;

module.exports = { desktopIconFolderViewAccessCSharp };
