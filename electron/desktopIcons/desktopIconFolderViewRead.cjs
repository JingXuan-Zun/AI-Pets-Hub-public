const desktopIconFolderViewReadCSharp = String.raw`  public static DesktopPetDesktopIconInfo[] GetIcons() {
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

`;

module.exports = { desktopIconFolderViewReadCSharp };
