const { resolveDirectAppPath } = require('./appFileEntries.cjs');
const { searchDiskFallbackApps } = require('./diskFallbackIndex.cjs');
const { createLaunchResult } = require('./launchResult.cjs');

function createLocalAppLauncher({ searchRememberedApps, searchLocalApps, focusExistingAppWindow, shellApi, launchPackagedApp, createLaunchVerification, logMessage }) {
  async function launchLocalApp(request = {}) {
    const query = String(request?.query || request?.name || '').trim();
    const forceNew = Boolean(request?.forceNew || request?.openMode === 'new');

    const directApp = resolveDirectAppPath(query);
    const rememberedMatches = directApp ? [] : searchRememberedApps(query, { limit: 6 });
    const rememberedApp = rememberedMatches[0] ?? null;
    const matches = directApp
      ? [directApp]
      : rememberedApp
        ? rememberedMatches
      : await searchLocalApps(query, { forceRefresh: Boolean(request?.forceRefresh), limit: 6 });
    let effectiveMatches = matches;
    let selectedApp = directApp ?? rememberedApp ?? effectiveMatches[0] ?? null;

    if (!selectedApp && !forceNew) {
      const focusResult = await focusExistingAppWindow(query, null);
      if (focusResult.ok) {
        const focusedApp = {
          name: query,
          path: '',
          sourceRoot: 'running-process',
          type: 'process',
        };
        logMessage('local app focused by process fallback', {
          processName: focusResult.processName,
          query,
        });
        return createLaunchResult({
          action: 'focused',
          app: focusedApp,
          forceNew,
          matches: [],
          ok: true,
          query,
          verification: {
            action: 'focused',
            ok: true,
            reason: 'existing-window-focused',
            window: focusResult,
          },
        });
      }
    }

    if (!selectedApp) {
      const diskFallbackMatches = await searchDiskFallbackApps(query, { limit: 6 });
      if (diskFallbackMatches.length) {
        effectiveMatches = diskFallbackMatches;
        selectedApp = diskFallbackMatches[0] ?? null;
        logMessage('local app resolved by bounded disk fallback', {
          matchCount: diskFallbackMatches.length,
          path: selectedApp?.path ?? '',
          query,
        });
      }
    }

    if (!selectedApp) {
      return createLaunchResult({
        action: 'failed',
        app: null,
        error: 'No matching app entry found after checking remembered apps, running windows, taskbar/start shortcuts, installed programs, and bounded local disk candidates. Please provide the app path once or remember it as an app alias.',
        forceNew,
        matches: effectiveMatches,
        ok: false,
        query,
      });
    }

    if (!forceNew) {
      const focusResult = await focusExistingAppWindow(query, selectedApp);
      if (focusResult.ok) {
        logMessage('local app focused', {
          name: selectedApp.name,
          processName: focusResult.processName,
          query,
          type: selectedApp.type,
        });

        return createLaunchResult({
          action: 'focused',
          app: selectedApp,
          forceNew,
          matches: effectiveMatches,
          ok: true,
          query,
          verification: {
            action: 'focused',
            ok: true,
            reason: 'existing-window-focused',
            window: focusResult,
          },
        });
      }
    }

    const isPackagedApp = selectedApp.type === 'aumid' && Boolean(selectedApp.appId);
    if (!isPackagedApp && typeof shellApi?.openPath !== 'function') {
      return createLaunchResult({
        action: 'failed',
        app: selectedApp,
        error: 'Electron shell.openPath is unavailable.',
        forceNew,
        matches: effectiveMatches,
        ok: false,
        query,
      });
    }

    const error = isPackagedApp
      ? await launchPackagedApp(selectedApp)
      : await shellApi.openPath(selectedApp.path);
    if (error) {
      return createLaunchResult({
        action: 'failed',
        app: selectedApp,
        error,
        forceNew,
        matches: effectiveMatches,
        ok: false,
        query,
      });
    }

    const verification = await createLaunchVerification('launched', query, selectedApp, { delay: true });
    logMessage('local app launched', {
      name: selectedApp.name,
      query,
      type: selectedApp.type,
      verified: verification.ok,
    });

    return createLaunchResult({
      action: 'launched',
      app: selectedApp,
      forceNew,
      matches: effectiveMatches,
      ok: verification.ok,
      query,
      verification,
    });
  }

  return { launchLocalApp };
}

module.exports = { createLocalAppLauncher };
