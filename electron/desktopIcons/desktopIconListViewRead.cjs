const desktopIconListViewReadCSharp = String.raw`  private static void TryEnableDpiAwareness() {
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

`;

module.exports = { desktopIconListViewReadCSharp };
