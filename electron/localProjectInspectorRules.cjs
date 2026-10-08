const path = require('path');

const README_LINE_LIMIT = 12;

function normalizeInputPath(value) {
  return String(value || '')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

function getEntryByName(entries, name) {
  const normalizedName = name.toLowerCase();
  return entries.find((entry) => entry.name.toLowerCase() === normalizedName) ?? null;
}

function hasEntry(entries, name) {
  return Boolean(getEntryByName(entries, name));
}

function resolveInsideRoot(rootPath, relativePath) {
  const resolvedPath = path.resolve(rootPath, relativePath);
  const normalizedRoot = `${path.resolve(rootPath)}${path.sep}`;
  return resolvedPath === path.resolve(rootPath) || resolvedPath.startsWith(normalizedRoot)
    ? resolvedPath
    : null;
}

function createDetection(id, label, confidence, reason) {
  return {
    confidence,
    id,
    label,
    reason,
  };
}

function createSuggestedAction(label, command, cwd, source, risk = 'read') {
  const normalizedCommand = String(command || '').trim();
  const kind = /^https?:\/\//iu.test(normalizedCommand)
    ? 'open-url'
    : path.isAbsolute(normalizedCommand)
      ? 'open-path'
      : 'terminal-command';

  return {
    command,
    cwd,
    kind,
    label,
    risk,
    source,
  };
}

function selectPackageManager(entries) {
  if (hasEntry(entries, 'pnpm-lock.yaml')) {
    return 'pnpm';
  }

  if (hasEntry(entries, 'yarn.lock')) {
    return 'yarn';
  }

  return 'npm';
}

function createNodeRunCommand(packageManager, scriptName) {
  const safeScriptName = /^[\w:-]+$/u.test(scriptName) ? scriptName : '';
  if (!safeScriptName) {
    return '';
  }

  if (packageManager === 'yarn') {
    return safeScriptName === 'start' ? 'yarn start' : `yarn ${safeScriptName}`;
  }

  if (packageManager === 'pnpm') {
    return safeScriptName === 'start' ? 'pnpm start' : `pnpm run ${safeScriptName}`;
  }

  return safeScriptName === 'start' ? 'npm start' : `npm run ${safeScriptName}`;
}

function extractReadmeHints(readmeText) {
  if (!readmeText) {
    return [];
  }

  return readmeText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 3
      && line.length <= 180
      && /(?:npm|pnpm|yarn|python|pip|cargo|go run|mvn|gradle|unity|start|dev|serve|install|run|启动|运行|安装|使用)/iu.test(line)
    ))
    .slice(0, README_LINE_LIMIT);
}

function summarizeDirectoryEntries(entries) {
  const directories = entries.filter((entry) => entry.isDirectory).map((entry) => entry.name);
  const files = entries.filter((entry) => entry.isFile).map((entry) => entry.name);

  return {
    directories: directories.slice(0, 24),
    files: files.slice(0, 36),
  };
}

module.exports = {
  normalizeInputPath,
  getEntryByName,
  hasEntry,
  resolveInsideRoot,
  createDetection,
  createSuggestedAction,
  selectPackageManager,
  createNodeRunCommand,
  extractReadmeHints,
  summarizeDirectoryEntries
};
