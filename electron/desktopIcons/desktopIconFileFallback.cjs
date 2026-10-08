function getDesktopFallbackFolders(app, fs, path) {
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

function createDesktopFileFallbackIcon(path, entry, index) {
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

function createDesktopIconFileFallbackReader({ app, fs, path, logMessage, normalizeDesktopIcon, attachDesktopIconCoordinateSpaces }) {
  function listDesktopFileFallbackIcons() {
    const entries = [];
    for (const folderPath of getDesktopFallbackFolders(app, fs, path)) {
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
      .map((entry, index) => createDesktopFileFallbackIcon(path, entry, index))
      .map(normalizeDesktopIcon)
      .map(attachDesktopIconCoordinateSpaces)
      .filter(Boolean);
  }

  return listDesktopFileFallbackIcons;
}

module.exports = { createDesktopIconFileFallbackReader };
