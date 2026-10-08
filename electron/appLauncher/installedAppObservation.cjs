const path = require('path');
const { getTaskbarPinnedRoot } = require('./appIndexRoots.cjs');
const { isPathInside } = require('./appFileEntries.cjs');
const { normalizeSearchText, isBrowserCategoryQuery, scoreIndexedAppMatch } = require('./appSearchMatching.cjs');

function createInstalledAppObservation({ listApps, searchLocalApps, readShortcutTargetPath }) {
  async function normalizeAppObservationEntry(item) {
    const taskbarPinnedRoot = getTaskbarPinnedRoot();
    const shortcutTargetPath = item?.path && path.extname(item.path).toLowerCase() === '.lnk'
      ? await readShortcutTargetPath(item.path)
      : null;

    return {
      aliases: Array.isArray(item?.aliases) ? item.aliases.slice(0, 12) : [],
      appId: item?.appId || undefined,
      category: item?.category || undefined,
      name: item?.name || '',
      path: item?.path || '',
      score: typeof item?.score === 'number' ? item.score : undefined,
      shortcutTargetPath: shortcutTargetPath || undefined,
      sourceRoot: item?.sourceRoot || '',
      taskbarPinned: isPathInside(taskbarPinnedRoot, item?.path || item?.sourceRoot || ''),
      type: item?.type || '',
      userDefined: Boolean(item?.userDefined),
    };
  }

  async function listInstalledApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const limit = Math.max(1, Math.min(200, Math.round(Number(request?.limit ?? 80))));
    const forceRefresh = Boolean(request?.forceRefresh);
    const apps = query
      ? await searchLocalApps(query, { forceRefresh, limit })
      : (await listApps({ forceRefresh })).slice(0, limit);

    return {
      ok: true,
      apps: await Promise.all(apps.map((item) => normalizeAppObservationEntry(item))),
      count: apps.length,
      query,
    };
  }

  async function listTaskbarPinnedApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const normalizedQuery = normalizeSearchText(query);
    const limit = Math.max(1, Math.min(80, Math.round(Number(request?.limit ?? 40))));
    const taskbarPinnedRoot = getTaskbarPinnedRoot();
    const normalizedApps = await Promise.all((await listApps({ forceRefresh: Boolean(request?.forceRefresh) }))
      .filter((item) => isPathInside(taskbarPinnedRoot, item.path || item.sourceRoot || ''))
      .map((item) => normalizeAppObservationEntry(item)));
    const apps = normalizedApps
      .filter((item) => (
        !normalizedQuery
        || normalizeSearchText(item.name).includes(normalizedQuery)
        || normalizeSearchText(item.path).includes(normalizedQuery)
        || normalizeSearchText(item.shortcutTargetPath).includes(normalizedQuery)
        || item.aliases.some((alias) => normalizeSearchText(alias).includes(normalizedQuery))
      ))
      .slice(0, limit);

    return {
      ok: true,
      apps,
      count: apps.length,
      query,
      root: taskbarPinnedRoot,
    };
  }

  function createCachedAppObservationNormalizer() {
    const normalizedEntries = new Map();
    return async (item) => {
      const key = [
        item?.path || '',
        item?.sourceRoot || '',
        item?.name || '',
        item?.type || '',
      ].join('\n').toLowerCase();

      if (normalizedEntries.has(key)) {
        return normalizedEntries.get(key);
      }

      const normalizedEntry = await normalizeAppObservationEntry(item);
      normalizedEntries.set(key, normalizedEntry);
      return normalizedEntry;
    };
  }

  function searchAppIndexForObservation(apps, query, limit) {
    const normalizedQuery = String(query || '').trim();
    const browserCategoryQuery = isBrowserCategoryQuery(normalizedQuery);
    if (!normalizedQuery) {
      return apps.slice(0, limit);
    }

    return apps
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

  async function listObservedInstalledAndTaskbarPinnedApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const normalizedQuery = normalizeSearchText(query);
    const limit = Math.max(1, Math.min(120, Math.round(Number(request?.limit ?? 40))));
    const installedLimit = Math.max(1, Math.min(200, limit));
    const taskbarLimit = Math.max(1, Math.min(80, limit));
    const forceRefresh = Boolean(request?.forceRefresh);
    const taskbarPinnedRoot = getTaskbarPinnedRoot();
    const appIndex = await listApps({ forceRefresh });
    const normalizeForObservation = createCachedAppObservationNormalizer();

    const installedApps = await Promise.all(searchAppIndexForObservation(appIndex, query, installedLimit)
      .map((item) => normalizeForObservation(item)));
    const normalizedTaskbarPinnedApps = await Promise.all(appIndex
      .filter((item) => isPathInside(taskbarPinnedRoot, item.path || item.sourceRoot || ''))
      .map((item) => normalizeForObservation(item)));
    const taskbarPinnedApps = normalizedTaskbarPinnedApps
      .filter((item) => (
        !normalizedQuery
        || normalizeSearchText(item.name).includes(normalizedQuery)
        || normalizeSearchText(item.path).includes(normalizedQuery)
        || normalizeSearchText(item.shortcutTargetPath).includes(normalizedQuery)
        || item.aliases.some((alias) => normalizeSearchText(alias).includes(normalizedQuery))
      ))
      .slice(0, taskbarLimit);

    return {
      installed: {
        ok: true,
        apps: installedApps,
        count: installedApps.length,
        query,
      },
      taskbarPinned: {
        ok: true,
        apps: taskbarPinnedApps,
        count: taskbarPinnedApps.length,
        query,
        root: taskbarPinnedRoot,
      },
    };
  }
  return { listInstalledApps, listTaskbarPinnedApps, listObservedInstalledAndTaskbarPinnedApps };
}

module.exports = { createInstalledAppObservation };
