const fs = require('fs');
const path = require('path');
const { APP_INDEX_MAX_SHORTCUT_DIRECTORIES, APP_INDEX_MAX_SHORTCUTS, APP_SHORTCUT_EXTENSIONS } = require('./appLauncherConstants.cjs');

async function walkShortcutRoot(root, shortcuts, state = { directoriesVisited: 0 }, depth = 0) {
  const queue = [{ depth, root }];

  while (
    queue.length
    && state.directoriesVisited < APP_INDEX_MAX_SHORTCUT_DIRECTORIES
    && shortcuts.length < APP_INDEX_MAX_SHORTCUTS
  ) {
    const current = queue.shift();
    if (!current || current.depth > 8) {
      continue;
    }
    state.directoriesVisited += 1;

    let entries = [];
    try {
      entries = await fs.promises.readdir(current.root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (shortcuts.length >= APP_INDEX_MAX_SHORTCUTS) {
        break;
      }

      const fullPath = path.join(current.root, entry.name);

      if (entry.isDirectory()) {
        queue.push({ depth: current.depth + 1, root: fullPath });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!APP_SHORTCUT_EXTENSIONS.has(extension)) {
        continue;
      }

      shortcuts.push({
        name: path.basename(entry.name, extension),
        path: fullPath,
        sourceRoot: current.root,
        type: extension.slice(1),
      });
    }
  }
}

module.exports = { walkShortcutRoot };
