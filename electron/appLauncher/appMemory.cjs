const fs = require('fs');
const path = require('path');
const os = require('os');
const { USER_APP_MEMORY_FILE_NAME, USER_APP_MEMORY_MAX_ENTRIES, USER_APP_MEMORY_SCHEMA_VERSION } = require('./appLauncherConstants.cjs');
const { isExistingLocalAppFile } = require('./appFileEntries.cjs');
const { normalizeAliasList } = require('./appSearchMatching.cjs');

function getUserAppMemoryPath(app) {
  let userDataPath = '';
  try {
    userDataPath = typeof app?.getPath === 'function' ? app.getPath('userData') : '';
  } catch {
    userDataPath = '';
  }

  return path.join(userDataPath || path.join(os.homedir(), '.ai-desktop-pet'), USER_APP_MEMORY_FILE_NAME);
}

function normalizeRememberedAppEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  const appPath = String(rawEntry.path || '').trim().replace(/^["']|["']$/g, '');
  if (!isExistingLocalAppFile(appPath)) {
    return null;
  }

  const extension = path.extname(appPath).toLowerCase();
  const defaultName = path.basename(appPath, extension);
  const name = String(rawEntry.name || defaultName).trim() || defaultName;
  const aliases = normalizeAliasList([
    name,
    defaultName,
    ...(Array.isArray(rawEntry.aliases) ? rawEntry.aliases : []),
  ]);

  return {
    aliases,
    name,
    path: appPath,
    sourceRoot: path.dirname(appPath),
    type: extension.slice(1),
    userDefined: true,
  };
}

function readRememberedApps(memoryPath) {
  try {
    const rawText = fs.readFileSync(memoryPath, 'utf8').trim();
    if (!rawText) {
      return [];
    }

    const parsed = JSON.parse(rawText);
    const rawApps = Array.isArray(parsed?.apps) ? parsed.apps : [];
    return rawApps
      .map(normalizeRememberedAppEntry)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeRememberedApps(memoryPath, apps) {
  const normalizedApps = apps
    .map(normalizeRememberedAppEntry)
    .filter(Boolean)
    .slice(0, USER_APP_MEMORY_MAX_ENTRIES);
  const payload = {
    version: USER_APP_MEMORY_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    apps: normalizedApps.map((appEntry) => ({
      aliases: appEntry.aliases,
      name: appEntry.name,
      path: appEntry.path,
      updatedAt: new Date().toISOString(),
    })),
  };
  const tempPath = `${memoryPath}.${process.pid}.tmp`;

  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.copyFileSync(tempPath, memoryPath);
  fs.rmSync(tempPath, { force: true });

  return normalizedApps;
}

module.exports = { getUserAppMemoryPath, normalizeRememberedAppEntry, readRememberedApps, writeRememberedApps };
