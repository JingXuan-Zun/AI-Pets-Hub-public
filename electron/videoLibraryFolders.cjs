const fs = require('fs');
const path = require('path');

// A video character library is one root folder whose direct subfolders each
// hold a group of clips (待机/, 开心/, 伤心/ ...). Idle playback picks a random
// subfolder; emotion playback picks the subfolder whose name matches an alias.

function listVideoLibraryFolders(rootPath, inspectFolder) {
  return fs.readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const inspected = inspectFolder({ folderPath: path.join(rootPath, entry.name) });
      return inspected.ok
        ? { folderPath: inspected.folderPath, name: entry.name, videoCount: inspected.videoCount }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN', { numeric: true }));
}

function normalizeFolderName(value) {
  return String(value || '').trim().toLowerCase();
}

function createVideoLibraryFolders({ inspect2DVideoFolder, pick2DVideoFromFolder }) {
  function inspect2DVideoLibrary(request = {}) {
    const rootPath = typeof request.rootPath === 'string' ? request.rootPath.trim() : '';
    if (!rootPath) return { error: '请选择角色视频根目录。', ok: false };
    try {
      const resolvedRoot = path.resolve(rootPath);
      if (!fs.statSync(resolvedRoot).isDirectory()) return { error: '所选路径不是文件夹。', ok: false };
      const folders = listVideoLibraryFolders(resolvedRoot, inspect2DVideoFolder);
      if (folders.length === 0) {
        return { error: '根目录下没有包含视频的子文件夹。', ok: false, rootPath: resolvedRoot };
      }
      return { folders, ok: true, rootPath: resolvedRoot };
    } catch {
      return { error: '角色视频根目录不存在或无法读取。', ok: false };
    }
  }

  // The imported clip usually sits in <root>/<group>/clip.webm, so the library
  // root is the grandparent folder of the selected source file.
  function resolve2DVideoLibraryRootFromSource(request = {}) {
    const sourcePath = typeof request.sourcePath === 'string' ? request.sourcePath.trim() : '';
    if (!sourcePath) return { ok: false };
    return inspect2DVideoLibrary({ rootPath: path.dirname(path.dirname(path.resolve(sourcePath))) });
  }

  async function pick2DVideoFromLibrary(request = {}) {
    const inspected = inspect2DVideoLibrary(request);
    if (!inspected.ok) return inspected;
    const wantedNames = new Set(
      (Array.isArray(request.folderNames) ? request.folderNames : []).map(normalizeFolderName).filter(Boolean),
    );
    const candidates = wantedNames.size > 0
      ? inspected.folders.filter((folder) => wantedNames.has(normalizeFolderName(folder.name)))
      : inspected.folders;
    if (candidates.length === 0) return { error: '没有匹配的视频文件夹。', ok: false };
    const remaining = [...candidates];
    while (remaining.length > 0) {
      const [folder] = remaining.splice(Math.floor(Math.random() * remaining.length), 1);
      const picked = await pick2DVideoFromFolder({ folderPath: folder.folderPath });
      if (picked.ok) return { ...picked, folderName: folder.name };
    }
    return { error: '匹配的视频文件夹中没有可播放的视频。', ok: false };
  }

  return { inspect2DVideoLibrary, pick2DVideoFromLibrary, resolve2DVideoLibraryRootFromSource };
}

module.exports = { createVideoLibraryFolders };
