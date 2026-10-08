const { createWindowUiAutomation } = require('./appLauncher/windowUiAutomation.cjs');
const { createWindowMoveGeometry } = require('./appLauncher/windowMoveGeometry.cjs');
const { createWindowMoveOperation } = require('./appLauncher/windowMoveOperation.cjs');
const { createWindowControlOperation } = require('./appLauncher/windowControlOperation.cjs');
const { createWindowCloseOperation } = require('./appLauncher/windowCloseOperation.cjs');
const { createWindowFocusOperation } = require('./appLauncher/windowFocusOperation.cjs');
const { createWindowObservationGeometry } = require('./appLauncher/windowObservationGeometry.cjs');
const { createRunningAppObservation } = require('./appLauncher/runningAppObservation.cjs');
const { createInstalledAppObservation } = require('./appLauncher/installedAppObservation.cjs');
const { createWindowsAndAppsObservation } = require('./appLauncher/windowsAndAppsObservation.cjs');
const { createInstalledAppIndex } = require('./appLauncher/installedAppIndex.cjs');
const { createPackagedAppIndex } = require('./appLauncher/packagedAppIndex.cjs');
const { execFileAsync, spawnDetachedAsync } = require('./appLauncher/processBridge.cjs');
const { createPowerShellExecutor } = require('./appLauncher/powerShellExecutor.cjs');
const { createLocalAppCatalog } = require('./appLauncher/localAppCatalog.cjs');
const { createShortcutFocusCandidates } = require('./appLauncher/shortcutFocusCandidates.cjs');
const { createDefaultUriAppLookup } = require('./appLauncher/defaultUriApp.cjs');
const { createResourceOpener } = require('./appLauncher/resourceOpener.cjs');
const { createLaunchVerifier } = require('./appLauncher/launchVerification.cjs');
const { createPackagedAppLauncher } = require('./appLauncher/packagedAppLauncher.cjs');
const { createLocalAppLauncher } = require('./appLauncher/localAppLauncher.cjs');
const { shell } = require('electron');

function createAppLauncherService({
  app,
  log,
  packagedAppLauncher,
  packagedAppProvider,
  screen,
  shellApi = shell,
} = {}) {
  const shortcutTargetPathCache = new Map();
  const { runPowerShellScript } = createPowerShellExecutor({ execFileAsync });
  const { createInstalledProgramRegistryEntries } = createInstalledAppIndex({ runPowerShellScript, logMessage });
  const { createPackagedAppEntries } = createPackagedAppIndex({ runPowerShellScript, logMessage, packagedAppProvider });
  const { listRememberedApps, searchRememberedApps, rememberLocalApp, listApps, searchLocalApps } = createLocalAppCatalog({ app, shortcutTargetPathCache, createInstalledProgramRegistryEntries, createPackagedAppEntries, logMessage });
  const { readShortcutTargetPath, buildFocusCandidates } = createShortcutFocusCandidates({ runPowerShellScript, shortcutTargetPathCache });
  const { nativeScreenRectToDipRect, normalizeRunningAppWindow, getDisplaySnapshots, findDisplayForBounds, enrichWindowDisplay } = createWindowObservationGeometry({ screen, logMessage });
  const { inspectWindowUi, invokeWindowUi } = createWindowUiAutomation({ runPowerShellScript });
  const { normalizeDisplayRect, normalizeWindowMoveBounds, createMoveWindowNativeDisplayHint } = createWindowMoveGeometry({ getDisplaySnapshots });
  const { moveWindowToDisplay } = createWindowMoveOperation({ createMoveWindowNativeDisplayHint, runPowerShellScript, normalizeWindowMoveBounds, nativeScreenRectToDipRect, normalizeDisplayRect, findDisplayForBounds });
  const { controlWindow } = createWindowControlOperation({ createMoveWindowNativeDisplayHint, runPowerShellScript, normalizeWindowMoveBounds, nativeScreenRectToDipRect, normalizeDisplayRect, findDisplayForBounds });
  const { closeWindow } = createWindowCloseOperation({ runPowerShellScript });
  const { focusExistingAppWindow, focusWindow } = createWindowFocusOperation({ buildFocusCandidates, runPowerShellScript });
  const { listRunningApps, getActiveWindowInfo } = createRunningAppObservation({ runPowerShellScript, normalizeRunningAppWindow, enrichWindowDisplay });
  const { listInstalledApps, listTaskbarPinnedApps, listObservedInstalledAndTaskbarPinnedApps } = createInstalledAppObservation({ listApps, searchLocalApps, readShortcutTargetPath });
  const { observeWindowsAndApps } = createWindowsAndAppsObservation({ listObservedInstalledAndTaskbarPinnedApps, listRunningApps, getActiveWindowInfo, getDisplaySnapshots });
  const { getDefaultAppForUri } = createDefaultUriAppLookup({ runPowerShellScript });
  const { createLaunchVerification } = createLaunchVerifier({ focusExistingAppWindow });
  const { launchPackagedApp } = createPackagedAppLauncher({ packagedAppLauncher, spawnDetachedAsync });
  const { launchLocalApp } = createLocalAppLauncher({ searchRememberedApps, searchLocalApps, focusExistingAppWindow, shellApi, launchPackagedApp, createLaunchVerification, logMessage });
  const { openResource } = createResourceOpener({ shellApi, launchLocalApp });

  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  return {
    closeWindow,
    controlWindow,
    focusWindow,
    getActiveWindowInfo,
    getDefaultAppForUri,
    inspectWindowUi,
    invokeWindowUi,
    launchLocalApp,
    listInstalledApps,
    listRememberedApps,
    listRunningApps,
    listTaskbarPinnedApps,
    moveWindowToDisplay,
    openResource,
    observeWindowsAndApps,
    rememberLocalApp,
    listApps,
    searchLocalApps,
  };
}

module.exports = {
  createAppLauncherService,
};
