const fs = require('fs');
const path = require('path');
const { normalizeSearchText, isLikelyAppContainerDirectory, scoreAppNameMatch } = require('./appSearchMatching.cjs');
const { APP_DISK_FALLBACK_MAX_CANDIDATES, APP_DISK_FALLBACK_MAX_DEPTH, APP_DISK_FALLBACK_MAX_DIRECTORIES, APP_DISK_FALLBACK_MAX_FILES, APP_EXECUTABLE_EXTENSIONS } = require('./appLauncherConstants.cjs');
const { getDiskFallbackRoots } = require('./appIndexRoots.cjs');
const { createLocalAppEntry } = require('./appFileEntries.cjs');

async function searchDiskFallbackApps(query, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const limit = Math.max(1, Math.min(APP_DISK_FALLBACK_MAX_CANDIDATES, Math.round(Number(options?.limit ?? 6))));
  if (!normalizedQuery || process.platform !== 'win32') {
    return [];
  }

  const maxDepth = Math.max(1, Math.min(APP_DISK_FALLBACK_MAX_DEPTH, Math.round(Number(options?.maxDepth ?? APP_DISK_FALLBACK_MAX_DEPTH))));
  const roots = getDiskFallbackRoots();
  const queue = roots.map((root) => ({ depth: 0, directory: root }));
  const visited = new Set();
  const candidates = [];
  let scannedFiles = 0;

  while (
    queue.length
    && visited.size < APP_DISK_FALLBACK_MAX_DIRECTORIES
    && scannedFiles < APP_DISK_FALLBACK_MAX_FILES
    && candidates.length < APP_DISK_FALLBACK_MAX_CANDIDATES
  ) {
    const { depth, directory } = queue.shift();
    const key = String(directory || '').toLowerCase();
    if (!key || visited.has(key)) {
      continue;
    }
    visited.add(key);

    let entries = [];
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (scannedFiles >= APP_DISK_FALLBACK_MAX_FILES || candidates.length >= APP_DISK_FALLBACK_MAX_CANDIDATES) {
        break;
      }

      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (
          depth < maxDepth
          && !/^(?:windows|\$recycle\.bin|system volume information|node_modules|cache|temp|tmp|logs?|debug|backup|packages?)$/iu.test(entry.name)
          && (depth < 1 || isLikelyAppContainerDirectory(entry.name, query))
        ) {
          queue.push({ depth: depth + 1, directory: fullPath });
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }
      scannedFiles += 1;

      const extension = path.extname(entry.name).toLowerCase();
      if (!APP_EXECUTABLE_EXTENSIONS.has(extension)) {
        continue;
      }

      const baseName = path.basename(entry.name, extension);
      const score = Math.max(
        scoreAppNameMatch(baseName, query),
        normalizeSearchText(fullPath).includes(normalizedQuery) ? 72 : 0,
      ) - depth - (/(?:unins|uninstall|update|crash|helper|service|setup|install|repair|patch|redist|vcredist)/iu.test(baseName) ? 70 : 0);

      if (score <= 0) {
        continue;
      }

      candidates.push(createLocalAppEntry(baseName, fullPath, extension.slice(1), {
        aliases: [query, baseName],
        category: 'disk-fallback',
      }));
      candidates[candidates.length - 1].score = score;
    }
  }

  const seen = new Set();
  return candidates
    .filter((item) => {
      const key = String(item.path || '').toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((first, second) => (
      (second.score ?? 0) - (first.score ?? 0)
      || first.name.length - second.name.length
      || first.path.length - second.path.length
    ))
    .slice(0, limit);
}

module.exports = { searchDiskFallbackApps };
