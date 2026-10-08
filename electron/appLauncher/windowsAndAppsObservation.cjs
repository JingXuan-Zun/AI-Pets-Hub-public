const { getTaskbarPinnedRoot } = require('./appIndexRoots.cjs');

function createWindowsAndAppsObservation({ listObservedInstalledAndTaskbarPinnedApps, listRunningApps, getActiveWindowInfo, getDisplaySnapshots }) {
  async function observeWindowsAndApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const includeInstalledApps = request?.includeInstalledApps !== false;
    const includeTaskbarPinned = request?.includeTaskbarPinned !== false;
    const includeRunningApps = request?.includeRunningApps !== false;
    const includeActiveWindow = request?.includeActiveWindow !== false;
    const includeDisplays = request?.includeDisplays !== false;
    const limit = Math.max(1, Math.min(120, Math.round(Number(request?.limit ?? 40))));
    const observedAppLists = includeInstalledApps || includeTaskbarPinned
      ? await listObservedInstalledAndTaskbarPinnedApps({ forceRefresh: request?.forceRefresh, limit, query })
      : null;
    const installed = includeInstalledApps
      ? observedAppLists.installed
      : { apps: [], count: 0, ok: true, query };
    const taskbarPinned = includeTaskbarPinned
      ? observedAppLists.taskbarPinned
      : { apps: [], count: 0, ok: true, query, root: getTaskbarPinnedRoot() };
    const running = includeRunningApps
      ? await listRunningApps({ includeWindows: true, limit, query })
      : { apps: [], count: 0, ok: true, query };
    const activeWindow = includeActiveWindow
      ? (
        running.activeWindow
          ? {
            ...running.activeWindow,
            active: true,
            ok: true,
            source: 'running-window-list',
          }
          : await getActiveWindowInfo()
      )
      : null;
    const displays = includeDisplays ? getDisplaySnapshots() : [];

    return {
      ok: Boolean(installed.ok && taskbarPinned.ok && running.ok && (activeWindow === null || activeWindow.ok !== false)),
      activeWindow,
      displays,
      installedApps: installed.apps,
      installedCount: installed.count,
      query,
      runningApps: running.apps,
      runningCount: running.count,
      taskbarPinnedApps: taskbarPinned.apps,
      taskbarPinnedCount: taskbarPinned.count,
      taskbarPinnedRoot: taskbarPinned.root,
    };
  }
  return { observeWindowsAndApps };
}

module.exports = { createWindowsAndAppsObservation };
