const { createMainWindowPresentationControllers } = require('./mainWindowPresentation.cjs');
const { createSettingsTrayControllers } = require('./trayConfiguration.cjs');

function createWindowPresentationTrayControllers({
  managerState, getPlatform, PREWARM_MAIN_INTERACTIVE_LAYER, warmMainInteractiveLayer,
  MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS, setTimeout, clearTimeout, scheduleKeepWindowOnTop,
  MAIN_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop, ensureSettingsWindowReady, showSettingsWindow,
  reportOpenSettingsError, windowOwnershipState, Menu, app,
  hideMainWindow,
}) {
  const { clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup, showMainWindow } = createMainWindowPresentationControllers({
    managerState, getPlatform, PREWARM_MAIN_INTERACTIVE_LAYER,
    warmMainInteractiveLayer, MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS,
    setTimeout, clearTimeout,
    scheduleKeepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  });
  const { closeSettingsWindow, openSettingsWindow, configureTray } = createSettingsTrayControllers({
    managerState, ensureSettingsWindowReady,
    showSettingsWindow,
    reportOpenSettingsError,
    windowOwnershipState, Menu, app, showMainWindow, hideMainWindow,
  });
  return { clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup, showMainWindow, closeSettingsWindow, openSettingsWindow, configureTray };
}

module.exports = { createWindowPresentationTrayControllers };
