const { createWindowTopmostScheduler } = require('./windowTopmostScheduler.cjs');
const { createAuxWindowTopmostActions, createAuxWindowTopmostScheduler } = require('./auxiliaryWindowTopmost.cjs');
const { createWindowStackTopmost } = require('./windowStackTopmost.cjs');
const { createMainWindowSettingsResizer, createMainWindowCenterResizer } = require('./mainWindowResize.cjs');
const { createAuxWindowVisibilityQuery, createMainWindowTopmostGuard } = require('./mainWindowTopmostGuard.cjs');

function createWindowTopmostControllers({
  getMainWindow, getInputProxyWindow, getSettingsWindow, getChatWindow,
  getAreaPickerWindow, getPersistentAreaBorderWindow, keepWindowOnTop,
  MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
  AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
  PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL, setTimeout,
}) {
  const { scheduleKeepWindowOnTop } = createWindowTopmostScheduler({
    keepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL, setTimeout,
  });
  const { keepAuxWindowsOnTop, keepAreaPickerOnTop, keepPersistentAreaBorderOnTop } = createAuxWindowTopmostActions({
    getSettingsWindow, getChatWindow,
    getAreaPickerWindow, getPersistentAreaBorderWindow, keepWindowOnTop,
    AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
    PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
  const { scheduleAuxWindowsOnTop, scheduleAreaPickerOnTop, schedulePersistentAreaBorderOnTop } = createAuxWindowTopmostScheduler({
    getSettingsWindow, getChatWindow,
    getAreaPickerWindow, getPersistentAreaBorderWindow, scheduleKeepWindowOnTop,
    AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
    PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
  const { keepWindowStackOnTop, scheduleWindowStackOnTop } = createWindowStackTopmost({
    getMainWindow, getInputProxyWindow,
    MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
    keepWindowOnTop, keepAuxWindowsOnTop, keepPersistentAreaBorderOnTop, keepAreaPickerOnTop,
    scheduleKeepWindowOnTop, scheduleAuxWindowsOnTop, schedulePersistentAreaBorderOnTop, scheduleAreaPickerOnTop,
  });
  return {
    scheduleKeepWindowOnTop, keepAuxWindowsOnTop, keepAreaPickerOnTop, keepPersistentAreaBorderOnTop,
    keepWindowStackOnTop, scheduleWindowStackOnTop,
  };
}

function createWindowPlacementControllers(dependencies) {
  const {
    getMainWindow, getSettingsWindow, getChatWindow, getAreaPickerWindow,
    getSettingsWindowBounds, getCompactWindowBounds, captureService,
    getGuardTimer, setGuardTimer, keepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL,
    TOPMOST_GUARD_INTERVAL_MS, setInterval, clearInterval,
  } = dependencies;
  const topmost = createWindowTopmostControllers(dependencies);
  const { scheduleWindowStackOnTop } = topmost;
  const resizeWindowForSettings = createMainWindowSettingsResizer({
    getMainWindow, getSettingsWindowBounds, getCompactWindowBounds, scheduleWindowStackOnTop,
  });
  const resizeWindowAroundCurrentCenter = createMainWindowCenterResizer({
    getMainWindow, getSettingsWindowBounds, getCompactWindowBounds, captureService, scheduleWindowStackOnTop,
  });
  const hasVisibleAuxWindow = createAuxWindowVisibilityQuery({ getSettingsWindow, getChatWindow, getAreaPickerWindow });
  const { startMainTopmostGuard, stopMainTopmostGuard } = createMainWindowTopmostGuard({
    getGuardTimer, setGuardTimer, getMainWindow, hasVisibleAuxWindow, keepWindowOnTop,
    MAIN_TOPMOST_RELATIVE_LEVEL, TOPMOST_GUARD_INTERVAL_MS, setInterval, clearInterval,
  });
  return {
    ...topmost, resizeWindowForSettings, resizeWindowAroundCurrentCenter, startMainTopmostGuard, stopMainTopmostGuard,
  };
}

function createWindowManagerPlacementControllers({
  managerState, areaPickerService, keepWindowOnTop,
  MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
  PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  getSettingsWindowBounds, getCompactWindowBounds, captureService, TOPMOST_GUARD_INTERVAL_MS, setTimeout, setInterval, clearInterval,
}) {
  const getAreaPickerWindow = () => areaPickerService?.getAreaPickerWindow?.() ?? null;
  const getPersistentAreaBorderWindow = () => areaPickerService?.getPersistentAreaBorderWindow?.() ?? null;
  return createWindowPlacementControllers({
    getMainWindow: () => managerState.mainWindow, getInputProxyWindow: () => managerState.postDragInputProxyWindow,
    getSettingsWindow: () => managerState.settingsWindow, getChatWindow: () => managerState.chatWindow,
    getAreaPickerWindow, getPersistentAreaBorderWindow, keepWindowOnTop,
    MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
    AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
    PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    getSettingsWindowBounds, getCompactWindowBounds, captureService,
    getGuardTimer: () => managerState.mainTopmostGuard, setGuardTimer: (timer) => { managerState.mainTopmostGuard = timer; },
    TOPMOST_GUARD_INTERVAL_MS, setTimeout,
    setInterval, clearInterval,
  });
}

module.exports = { createWindowPlacementControllers, createWindowManagerPlacementControllers };
