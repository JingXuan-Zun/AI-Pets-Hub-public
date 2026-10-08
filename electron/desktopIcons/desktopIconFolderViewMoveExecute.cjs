const desktopIconFolderViewMoveExecuteCSharp = String.raw`  public static bool MoveIcon(int index, int nativeScreenX, int nativeScreenY) {
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

`;

module.exports = { desktopIconFolderViewMoveExecuteCSharp };
