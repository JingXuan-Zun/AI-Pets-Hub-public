const path = require('path');
const { normalizeSearchText, isBrowserCategoryQuery, normalizeAliasList, scoreRememberedAppMatch, scoreIndexedAppMatch } = require('./appSearchMatching.cjs');
const { isExistingLocalAppFile, createLocalAppEntry } = require('./appFileEntries.cjs');
const { getShortcutRoots } = require('./appIndexRoots.cjs');
const { walkShortcutRoot } = require('./shortcutIndex.cjs');
const { getUserAppMemoryPath, normalizeRememberedAppEntry, readRememberedApps, writeRememberedApps } = require('./appMemory.cjs');
const { APP_INDEX_CACHE_TTL_MS } = require('./appLauncherConstants.cjs');
const { getDetectedBrowserCandidates } = require('../browserSearchService.cjs');

function createLocalAppCatalog({ app, shortcutTargetPathCache, createInstalledProgramRegistryEntries, createPackagedAppEntries, logMessage }) {
  let cachedApps = [];
  let cacheUpdatedAt = 0;
  const userAppMemoryPath = getUserAppMemoryPath(app);

  function listRememberedApps() {
    return readRememberedApps(userAppMemoryPath);
  }

  function searchRememberedApps(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    const limit = Math.max(1, Math.min(20, Math.round(Number(options?.limit ?? 6))));

    if (!normalizedQuery) {
      return [];
    }

    return listRememberedApps()
      .map((item) => ({
        ...item,
        score: scoreRememberedAppMatch(item, normalizedQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => (
        second.score - first.score
        || first.name.length - second.name.length
        || first.name.localeCompare(second.name, 'zh-Hans-CN')
      ))
      .slice(0, limit);
  }

  function createDetectedBrowserAppEntries() {
    return getDetectedBrowserCandidates()
      .map((candidate) => createLocalAppEntry(candidate.browserLabel, candidate.path, 'exe', {
        aliases: [
          candidate.browserLabel,
          candidate.browserLabel === 'Chrome' ? 'Google Chrome' : '',
          candidate.browserLabel === 'Edge' ? 'Microsoft Edge' : '',
          path.basename(candidate.path || '', path.extname(candidate.path || '')),
        ],
        category: 'browser',
      }));
  }

  function rememberLocalApp(request = {}) {
    const appPath = String(request?.path || request?.appPath || '').trim().replace(/^["']|["']$/g, '');
    if (!appPath || !path.isAbsolute(appPath) || !isExistingLocalAppFile(appPath)) {
      return {
        ok: false,
        error: 'App path must be an existing .exe, .lnk, .url, or .appref-ms file.',
        app: null,
      };
    }

    const extension = path.extname(appPath).toLowerCase();
    const defaultName = path.basename(appPath, extension);
    const name = String(request?.name || request?.alias || defaultName).trim() || defaultName;
    const aliases = normalizeAliasList([
      name,
      defaultName,
      request?.alias,
      ...(Array.isArray(request?.aliases) ? request.aliases : []),
    ]);
    const nextEntry = normalizeRememberedAppEntry({
      aliases,
      name,
      path: appPath,
    });

    if (!nextEntry) {
      return {
        ok: false,
        error: 'Unable to normalize app memory entry.',
        app: null,
      };
    }

    const nextPathKey = appPath.toLowerCase();
    const nextAliasKeys = new Set(nextEntry.aliases.map(normalizeSearchText));
    const preservedApps = listRememberedApps()
      .filter((entry) => {
        if (entry.path.toLowerCase() === nextPathKey) {
          return false;
        }

        return !entry.aliases.some((alias) => nextAliasKeys.has(normalizeSearchText(alias)));
      });
    const savedApps = writeRememberedApps(userAppMemoryPath, [nextEntry, ...preservedApps]);
    const savedEntry = savedApps[0] ?? nextEntry;
    cachedApps = [];
    cacheUpdatedAt = 0;
    shortcutTargetPathCache.clear();

    logMessage('local app memory saved', {
      aliases: savedEntry.aliases,
      name: savedEntry.name,
      path: savedEntry.path,
    });

    return {
      ok: true,
      app: savedEntry,
      memoryPath: userAppMemoryPath,
    };
  }

  async function buildAppIndex() {
    if (process.platform !== 'win32') {
      return [
        ...listRememberedApps(),
        ...createDetectedBrowserAppEntries(),
        ...await createInstalledProgramRegistryEntries(),
      ];
    }

    const shortcuts = [];
    await Promise.all(getShortcutRoots(app).map((root) => walkShortcutRoot(root, shortcuts)));

    return [
      ...listRememberedApps(),
      ...createDetectedBrowserAppEntries(),
      ...await createPackagedAppEntries(),
      ...await createInstalledProgramRegistryEntries(),
      ...shortcuts,
    ]
      .sort((first, second) => first.name.localeCompare(second.name, 'zh-Hans-CN'));
  }

  async function listApps(options = {}) {
    const forceRefresh = Boolean(options?.forceRefresh);
    if (
      !forceRefresh
      && cacheUpdatedAt > 0
      && Date.now() - cacheUpdatedAt <= APP_INDEX_CACHE_TTL_MS
    ) {
      return cachedApps;
    }

    cachedApps = await buildAppIndex();
    cacheUpdatedAt = Date.now();
    logMessage('local app index refreshed', { count: cachedApps.length });
    return cachedApps;
  }

  async function searchLocalApps(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    const limit = Math.max(1, Math.min(20, Math.round(Number(options?.limit ?? 6))));
    const browserCategoryQuery = isBrowserCategoryQuery(normalizedQuery);

    if (!normalizedQuery) {
      return [];
    }

    return (await listApps(options))
      .map((item) => ({
        ...item,
        score: scoreIndexedAppMatch(item, normalizedQuery, { browserCategoryQuery }),
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => (
        second.score - first.score
        || Number(Boolean(second.userDefined)) - Number(Boolean(first.userDefined))
        || first.name.length - second.name.length
        || first.name.localeCompare(second.name, 'zh-Hans-CN')
      ))
      .slice(0, limit);
  }

  return { listRememberedApps, searchRememberedApps, rememberLocalApp, listApps, searchLocalApps };
}

module.exports = { createLocalAppCatalog };
