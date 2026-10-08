const desktopIconListViewMoveExecuteCSharp = String.raw`  private static void TryEnableDpiAwareness() {
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

`;

module.exports = { desktopIconListViewMoveExecuteCSharp };
