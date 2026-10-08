const fs = require('fs');
const path = require('path');
const { normalizeAbsolutePath, clampInteger, getPathKind } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');

const DEFAULT_LIST_LIMIT = 80;

const MAX_LIST_LIMIT = 300;

function normalizeEntry(fullPath, name, stat) {
  return {
    createdAt: stat.birthtimeMs || 0,
    extension: stat.isFile() ? path.extname(name).toLowerCase() : '',
    kind: getPathKind(stat),
    modifiedAt: stat.mtimeMs || 0,
    name,
    path: fullPath,
    sizeBytes: stat.isFile() ? stat.size : 0,
  };
}

function listDirectoryEntries(directoryPath, options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  const rawEntries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const entries = rawEntries
    .filter((entry) => includeHidden || !entry.name.startsWith('.'))
    .map((entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      const stat = getSafeStat(fullPath);
      return stat ? normalizeEntry(fullPath, entry.name, stat) : null;
    })
    .filter(Boolean)
    .sort((first, second) => (
      Number(second.kind === 'directory') - Number(first.kind === 'directory')
      || first.name.localeCompare(second.name, 'zh-Hans-CN', { numeric: true })
    ));

  return {
    entries,
    totalEntryCount: rawEntries.length,
  };
}

function createPathInfo(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.target || request.query);
  if (!resolved.ok) {
    return resolved;
  }

  const stat = getSafeStat(resolved.path);
  const kind = getPathKind(stat);
  return {
    basename: path.basename(resolved.path),
    dirname: path.dirname(resolved.path),
    exists: Boolean(stat),
    extension: stat?.isFile() ? path.extname(resolved.path).toLowerCase() : '',
    kind,
    modifiedAt: stat?.mtimeMs || 0,
    ok: Boolean(stat),
    path: resolved.path,
    sizeBytes: stat?.isFile() ? stat.size : 0,
  };
}

function listDirectory(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.folderPath || request.query);
  if (!resolved.ok) {
    return resolved;
  }

  const stat = getSafeStat(resolved.path);
  if (!stat) {
    return {
      error: 'Path does not exist.',
      ok: false,
      path: resolved.path,
    };
  }

  if (!stat.isDirectory()) {
    return {
      error: 'Path is not a directory.',
      kind: getPathKind(stat),
      ok: false,
      path: resolved.path,
    };
  }

  try {
    const limit = clampInteger(request.limit, DEFAULT_LIST_LIMIT, 1, MAX_LIST_LIMIT);
    const { entries, totalEntryCount } = listDirectoryEntries(resolved.path, {
      includeHidden: request.includeHidden,
    });
    const visibleEntries = entries.slice(0, limit);

    return {
      entries: visibleEntries,
      limit,
      ok: true,
      path: resolved.path,
      totalEntryCount,
      truncated: entries.length > visibleEntries.length,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      path: resolved.path,
    };
  }
}

module.exports = { normalizeEntry, listDirectoryEntries, createPathInfo, listDirectory };
