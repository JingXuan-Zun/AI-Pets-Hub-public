const fs = require('fs');
const path = require('path');
const { resolveInsideRoot } = require('./localProjectInspectorRules.cjs');

const MAX_TOP_LEVEL_ENTRIES = 180;
const MAX_KEY_FILE_BYTES = 256 * 1024;
const IGNORED_DIRECTORY_NAMES = new Set([
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

function getSafeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function normalizeEntry(entry, rootPath) {
  const fullPath = path.join(rootPath, entry.name);
  const stat = getSafeStat(fullPath);
  const extension = entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase();

  return {
    extension,
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile(),
    name: entry.name,
    path: fullPath,
    sizeBytes: stat?.isFile() ? stat.size : 0,
  };
}

function listTopLevelEntries(rootPath) {
  const rawEntries = fs.readdirSync(rootPath, { withFileTypes: true });
  const entries = rawEntries
    .filter((entry) => !IGNORED_DIRECTORY_NAMES.has(entry.name))
    .map((entry) => normalizeEntry(entry, rootPath))
    .sort((first, second) => (
      Number(second.isDirectory) - Number(first.isDirectory)
      || first.name.localeCompare(second.name, 'zh-Hans-CN', { numeric: true })
    ));

  return {
    entries: entries.slice(0, MAX_TOP_LEVEL_ENTRIES),
    totalEntryCount: rawEntries.length,
    truncated: rawEntries.length > MAX_TOP_LEVEL_ENTRIES,
  };
}

function readKeyTextFile(rootPath, relativePath, readFiles, warnings) {
  const filePath = resolveInsideRoot(rootPath, relativePath);
  if (!filePath) {
    return null;
  }

  const stat = getSafeStat(filePath);
  if (!stat?.isFile()) {
    return null;
  }

  if (stat.size > MAX_KEY_FILE_BYTES) {
    warnings.push(`跳过过大的关键文件：${relativePath}`);
    return null;
  }

  try {
    const text = fs.readFileSync(filePath, 'utf8');
    readFiles.push(relativePath);
    return text;
  } catch (error) {
    warnings.push(`读取 ${relativePath} 失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

module.exports = { MAX_TOP_LEVEL_ENTRIES, getSafeStat, normalizeEntry, listTopLevelEntries, readKeyTextFile };
