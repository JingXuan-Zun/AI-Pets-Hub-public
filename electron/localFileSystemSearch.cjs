const fs = require('fs');
const path = require('path');
const { normalizeAbsolutePath, clampInteger } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');
const { normalizeEntry } = require('./localFileSystemDirectoryReader.cjs');

const DEFAULT_SEARCH_LIMIT = 80;

const DEFAULT_SEARCH_MAX_DEPTH = 4;

const MAX_SEARCH_LIMIT = 300;

const MAX_SEARCH_DEPTH = 8;

const DEFAULT_IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'release',
  'target',
  '.venv',
  'venv',
  '__pycache__',
]);

function normalizeExtensionFilter(value) {
  if (!value) {
    return null;
  }

  const values = Array.isArray(value)
    ? value
    : String(value).split(/[,;\s]+/u);
  const extensions = values
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .map((item) => (item.startsWith('.') ? item : `.${item}`));

  return extensions.length ? new Set(extensions) : null;
}

function shouldSkipSearchDirectory(entryName, includeHidden) {
  if (!includeHidden && entryName.startsWith('.')) {
    return true;
  }

  return DEFAULT_IGNORED_DIRECTORY_NAMES.has(entryName);
}

function resolveSearchInput(request) {
  const resolved = normalizeAbsolutePath(request.path || request.folderPath || request.rootPath || request.queryRoot);
  if (!resolved.ok) {
    return resolved;
  }
  const query = String(request.nameQuery || request.fileName || request.pattern || request.query || '')
    .trim()
    .toLowerCase();
  if (!query) {
    return { error: 'Missing file search query.', ok: false, path: resolved.path };
  }
  const rootStat = getSafeStat(resolved.path);
  if (!rootStat?.isDirectory()) {
    return { error: 'Search root must be an existing directory.', ok: false, path: resolved.path };
  }
  return { resolved, query };
}

function readSearchOptions(request) {
  const includeHidden = Boolean(request.includeHidden);
  const extensionFilter = normalizeExtensionFilter(request.extensions || request.extension);
  const limit = clampInteger(request.limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);
  const maxDepth = clampInteger(request.maxDepth, DEFAULT_SEARCH_MAX_DEPTH, 0, MAX_SEARCH_DEPTH);
  return { includeHidden, extensionFilter, limit, maxDepth };
}

function collectSearchEntry(entry, directoryPath, depth, options, state, query) {
  const fullPath = path.join(directoryPath, entry.name);
  if (entry.isDirectory()) {
    if (depth < options.maxDepth && !shouldSkipSearchDirectory(entry.name, options.includeHidden)) {
      visitSearchDirectory(fullPath, depth + 1, options, state, query);
    }
    return;
  }
  if (!entry.isFile()) {
    return;
  }
  state.visitedFileCount += 1;
  const extension = path.extname(entry.name).toLowerCase();
  if (options.extensionFilter && !options.extensionFilter.has(extension)) {
    return;
  }
  if (!entry.name.toLowerCase().includes(query)) {
    return;
  }
  const stat = getSafeStat(fullPath);
  if (stat) {
    state.matches.push(normalizeEntry(fullPath, entry.name, stat));
  }
}

function visitSearchDirectory(directoryPath, depth, options, state, query) {
  if (state.matches.length >= options.limit) {
    state.truncated = true;
    return;
  }
  state.visitedDirectoryCount += 1;
  let entries = [];
  try {
    entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (state.matches.length >= options.limit) {
      state.truncated = true;
      return;
    }
    collectSearchEntry(entry, directoryPath, depth, options, state, query);
  }
}

function searchFiles(request = {}) {
  const input = resolveSearchInput(request);
  if (input.ok === false) {
    return input;
  }
  const options = readSearchOptions(request);
  const state = { matches: [], visitedDirectoryCount: 0, visitedFileCount: 0, truncated: false };
  visitSearchDirectory(input.resolved.path, 0, options, state, input.query);
  return {
    limit: options.limit,
    matches: state.matches,
    maxDepth: options.maxDepth,
    ok: true,
    path: input.resolved.path,
    query: input.query,
    truncated: state.truncated,
    visitedDirectoryCount: state.visitedDirectoryCount,
    visitedFileCount: state.visitedFileCount,
  };
}

module.exports = { searchFiles, normalizeExtensionFilter, shouldSkipSearchDirectory };
