const fs = require('fs');
const path = require('path');
const { APP_EXECUTABLE_EXTENSIONS } = require('./appLauncherConstants.cjs');
const { normalizeAliasList } = require('./appSearchMatching.cjs');

function isSupportedLocalAppPath(appPath) {
  const extension = path.extname(appPath || '').toLowerCase();
  return APP_EXECUTABLE_EXTENSIONS.has(extension);
}

function isExistingLocalAppFile(appPath) {
  try {
    return Boolean(appPath && fs.statSync(appPath).isFile() && isSupportedLocalAppPath(appPath));
  } catch {
    return false;
  }
}

function sanitizeInstalledAppPath(value) {
  let text = String(value || '').trim();
  if (!text) {
    return '';
  }

  text = text
    .replace(/^["']|["']$/g, '')
    .replace(/^\s*@/u, '')
    .replace(/,-?\d+\s*$/u, '')
    .trim();

  const quotedMatch = text.match(/^"([^"]+)"/u);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const executableMatch = text.match(/^(.+?\.exe)\b/iu);
  if (executableMatch?.[1]) {
    return executableMatch[1].trim();
  }

  return text;
}

function resolveDirectAppPath(query) {
  const normalizedQuery = String(query || '').trim().replace(/^["']|["']$/g, '');
  if (!normalizedQuery || !path.isAbsolute(normalizedQuery)) {
    return null;
  }

  let stats = null;
  try {
    stats = fs.statSync(normalizedQuery);
  } catch {
    return null;
  }

  if (!stats.isFile()) {
    return null;
  }

  const extension = path.extname(normalizedQuery).toLowerCase();
  if (!['.appref-ms', '.exe', '.lnk', '.url'].includes(extension)) {
    return null;
  }

  return {
    name: path.basename(normalizedQuery, extension),
    path: normalizedQuery,
    sourceRoot: path.dirname(normalizedQuery),
    type: extension.slice(1),
  };
}

function createLocalAppEntry(name, appPath, type = path.extname(appPath).slice(1) || 'exe', options = {}) {
  return {
    aliases: normalizeAliasList([
      name,
      path.basename(appPath || '', path.extname(appPath || '')),
      ...(Array.isArray(options.aliases) ? options.aliases : []),
    ]),
    category: options.category || undefined,
    name,
    path: appPath,
    sourceRoot: path.dirname(appPath),
    type,
  };
}

function resolveExistingFile(paths) {
  return paths.find((candidatePath) => {
    try {
      return candidatePath && fs.statSync(candidatePath).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function isPathInside(rootPath, candidatePath) {
  const normalizedRoot = path.resolve(rootPath || '').toLowerCase();
  const normalizedCandidate = path.resolve(candidatePath || '').toLowerCase();
  return Boolean(normalizedRoot && normalizedCandidate && (
    normalizedCandidate === normalizedRoot
    || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  ));
}

module.exports = { isSupportedLocalAppPath, isExistingLocalAppFile, sanitizeInstalledAppPath, resolveDirectAppPath, createLocalAppEntry, resolveExistingFile, isPathInside };
