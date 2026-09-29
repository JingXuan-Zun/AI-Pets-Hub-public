const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell } = require('electron');
const path = require('path');

const CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY = '__desktopPetCompactMinimumSizeActive';

const COMPACT_WINDOW_BOUNDS = {
  width: 520,
  height: 720,
  minWidth: 420,
  minHeight: 560,
  maxWidth: 720,
  maxHeight: 960,
};

const SETTINGS_PANEL_WINDOW_BOUNDS = {
  width: 544,
  height: 640,
  minWidth: 420,
  minHeight: 440,
  maxWidth: 8192,
  maxHeight: 1248,
};

const CHAT_PANEL_WINDOW_BOUNDS = {
  width: 320,
  height: 416,
  minWidth: 280,
  minHeight: 320,
  maxWidth: 8192,
  maxHeight: 1248,
};
const INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS = {
  width: 960,
  height: 300,
  minWidth: 620,
  minHeight: 240,
  maxWidth: 8192,
  maxHeight: 900,
};
const INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO = 0.69;

const TOPMOST_WINDOW_LEVEL = 'screen-saver';
const AREA_PICKER_TOPMOST_WINDOW_LEVEL = 'pop-up-menu';
const MAIN_TOPMOST_RELATIVE_LEVEL = 1;
const AUX_TOPMOST_RELATIVE_LEVEL = 3;
const PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL = 4;
const AREA_PICKER_TOPMOST_RELATIVE_LEVEL = 5;
const SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS = 80;
const SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS = 1600;
const SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS = 5000;
const DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS = 120;
const TOPMOST_GUARD_INTERVAL_MS = 1200;
const MAX_INTERACTIVE_WINDOW_SHAPE_REGIONS = 80;
const PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS = 720;
const MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS = 600;
const MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS = 80;
const MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS = 10_000;
const MAIN_INTERACTIVE_LAYER_WARMUP_REGION = {
  height: 1,
  width: 1,
  x: 0,
  y: 0,
};
const localTestDebugModelPath = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DEBUG_MODEL_PATH || '').trim()
  : '';
const localTestDesktopModelPath = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DESKTOP_MODEL_PATH || '').trim()
  : '';
const localTestDebugModelScale = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DEBUG_MODEL_SCALE || '').trim()
  : '';
const localTestDesktopModelScale = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DESKTOP_MODEL_SCALE || '').trim()
  : '';
const localTestDebugFocusX = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DEBUG_FOCUS_X || '').trim()
  : '';
const localTestDebugFocusY = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DEBUG_FOCUS_Y || '').trim()
  : '';
const localTestMenuPausePetId = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_PET_ID || '').trim()
  : '';
const localTestMenuPauseOpenDelayMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_OPEN_DELAY_MS || '').trim()
  : '';
const localTestMenuPauseWaitForMovementMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_WAIT_FOR_MOVEMENT_MS || '').trim()
  : '';
const localTestMenuPauseObserveMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_OBSERVE_MS || '').trim()
  : '';
const localTestMenuPauseThresholdPx = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_MENU_PAUSE_THRESHOLD_PX || '').trim()
  : '';
const localTestDragPrimaryPetId = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_PRIMARY_PET_ID || '').trim()
  : '';
const localTestPrimarySnapBackPetId = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_PRIMARY_SNAPBACK_PET_ID || '').trim()
  : '';
const localTestDragCompanionPetId = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_COMPANION_PET_ID || '').trim()
  : '';
const localTestDragStartDelayMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_START_DELAY_MS || '').trim()
  : '';
const localTestDragWaitForMovementMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_WAIT_FOR_MOVEMENT_MS || '').trim()
  : '';
const localTestDragObserveMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_OBSERVE_MS || '').trim()
  : '';
const localTestDragSampleIntervalMs = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_SAMPLE_INTERVAL_MS || '').trim()
  : '';
const localTestDragDeltaX = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_DELTA_X || '').trim()
  : '';
const localTestDragDeltaY = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_DELTA_Y || '').trim()
  : '';
const localTestDragStepThresholdPx = process.env.DESKTOP_PET_LOCAL_TEST === '1'
  ? (process.env.DESKTOP_PET_LOCAL_TEST_DRAG_STEP_THRESHOLD_PX || '').trim()
  : '';
const pointerDiagnosticsEnabled = process.env.DESKTOP_PET_POINTER_DIAGNOSTICS === '1';
const forceFullShapeOnDragEnabled = process.env.DESKTOP_PET_FORCE_FULL_SHAPE_ON_DRAG === '1';

function isCurrentWindowCompactMinimumSizeActive(win) {
  return Boolean(win && !win.isDestroyed() && win[CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY]);
}

function createWindowManager(options) {
  const {
    areaPickerService,
    captureService,
    isDev,
    log,
    sessionPartition,
  } = options;

  let mainWindow = null;
  let settingsWindow = null;
  let chatWindow = null;
  let tray = null;
  let isQuitting = false;
  let isShellSettingsOpen = false;
  let isPointerPassthrough = false;
  let requestedPointerPassthrough = false;
  let interactiveWindowShapeApplied = false;
  let interactiveWindowShapeRegions = [];
  let interactiveWindowShapeSignature = '';
  let pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
  let pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
  let pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
  let petDragFullWindowShapeHoldTimer = null;
  let petDragFullWindowShapeEndedAt = 0;
  let petDragFullWindowShapeHoldUntil = 0;
  let petDragNativeShapeActive = false;
  let latestSharedState = null;
  let mainTopmostGuard = null;
  let mainInteractiveLayerWarmupCompleted = false;
  let mainInteractiveLayerWarmupRestoreTimer = null;
  let mainInteractiveLayerWarmupTimer = null;
  let mainWindowCanShow = false;
  let mainWindowRendererReadyFallbackTimer = null;
  let mainWindowRendererReadyToShow = false;
  let settingsWindowDisplayRefreshTimer = null;
  let settingsWindowContentRefreshAt = 0;
  let settingsWindowReadyPromise = null;
  const topmostStateByWindow = new WeakMap();

  const getAreaPickerWindow = () => areaPickerService?.getAreaPickerWindow?.() ?? null;
  const getPersistentAreaBorderWindow = () => areaPickerService?.getPersistentAreaBorderWindow?.() ?? null;

function logWindowEvent(message) {
  if (typeof log === 'function') {
    log(message);
  }
}

function sanitizeInteractiveRegion(region) {
  if (!region || typeof region !== 'object') {
    return null;
  }

  const x = Math.max(0, Math.round(Number(region.x ?? 0)));
  const y = Math.max(0, Math.round(Number(region.y ?? 0)));
  const width = Math.max(0, Math.round(Number(region.width ?? 0)));
  const height = Math.max(0, Math.round(Number(region.height ?? 0)));
  if (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  return { height, width, x, y };
}

function normalizeInteractiveRegions(regions) {
  return (Array.isArray(regions) ? regions : [])
    .map(sanitizeInteractiveRegion)
    .filter(Boolean)
    .slice(0, MAX_INTERACTIVE_WINDOW_SHAPE_REGIONS);
}

function createInteractiveRegionsSignature(regions) {
  return regions
    .map((region) => `${region.x},${region.y},${region.width},${region.height}`)
    .join('|');
}

function summarizeInteractiveRegion(region) {
  return region
    ? `${region.x},${region.y},${region.width},${region.height}`
    : 'none';
}

function normalizeInteractiveRegionSource(options) {
  return typeof options?.source === 'string' ? options.source : '';
}

function getMainWindowInteractiveRegionSize() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const bounds = typeof mainWindow.getContentBounds === 'function'
    ? mainWindow.getContentBounds()
    : mainWindow.getBounds();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return {
    height: Math.round(bounds.height),
    width: Math.round(bounds.width),
  };
}

function isFullWindowInteractiveShape(regions) {
  if (!Array.isArray(regions) || regions.length !== 1) {
    return false;
  }

  const region = regions[0];
  const size = getMainWindowInteractiveRegionSize();
  if (!region || !size) {
    return false;
  }

  return region.x === 0
    && region.y === 0
    && region.width >= Math.max(1, size.width - 2)
    && region.height >= Math.max(1, size.height - 2);
}

function createFullWindowInteractiveRegion() {
  const size = getMainWindowInteractiveRegionSize();
  if (!size) {
    return null;
  }

  return {
    height: Math.max(1, size.height),
    width: Math.max(1, size.width),
    x: 0,
    y: 0,
  };
}

function isPetDragFullWindowShapeRetained() {
  return petDragNativeShapeActive || Date.now() < petDragFullWindowShapeHoldUntil;
}

function clearPetDragFullWindowShapeHoldTimer() {
  if (petDragFullWindowShapeHoldTimer) {
    clearTimeout(petDragFullWindowShapeHoldTimer);
    petDragFullWindowShapeHoldTimer = null;
  }
}

function ensurePetDragFullWindowInteractiveShape(reason) {
  const fullWindowRegion = createFullWindowInteractiveRegion();
  if (!fullWindowRegion) {
    return;
  }

  const fullWindowRegions = [fullWindowRegion];
  const fullWindowSignature = createInteractiveRegionsSignature(fullWindowRegions);
  const shouldApply = interactiveWindowShapeSignature !== fullWindowSignature
    || !interactiveWindowShapeApplied
    || !isFullWindowInteractiveShape(interactiveWindowShapeRegions);

  interactiveWindowShapeRegions = fullWindowRegions;
  interactiveWindowShapeSignature = fullWindowSignature;
  if (shouldApply) {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: retained pet drag full-window shape reason=${reason} `
        + `first=${summarizeInteractiveRegion(fullWindowRegion)}`,
      );
    }
    applyInteractiveWindowShape();
  }
  applyPointerPassthroughState();
}

function applyDeferredInteractiveShapeAfterPetDragHold() {
  petDragFullWindowShapeHoldTimer = null;

  if (petDragNativeShapeActive) {
    return;
  }

  const now = Date.now();
  if (now < petDragFullWindowShapeHoldUntil) {
    schedulePetDragFullWindowShapeHoldExpiry();
    return;
  }

  const deferredRegions = pendingInteractiveWindowShapeRegionsAfterPetDragHold;
  const deferredReceivedAt = pendingInteractiveWindowShapeReceivedAtAfterPetDragHold;
  pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
  pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
  pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
  if (!deferredRegions) {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: kept pet drag full-window shape after hold without deferred shape');
    }
    scheduleNativeShapeRefreshAfterPetDragHold('missing-deferred-shape');
    return;
  }

  if (
    deferredRegions.length === 0
    || (
      petDragFullWindowShapeEndedAt > 0
      && deferredReceivedAt <= petDragFullWindowShapeEndedAt
    )
  ) {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: ignored stale deferred interactive shape after pet drag hold `
        + `count=${deferredRegions.length} `
        + `receivedAt=${deferredReceivedAt} endedAt=${petDragFullWindowShapeEndedAt}`,
      );
    }
    scheduleNativeShapeRefreshAfterPetDragHold('stale-deferred-shape');
    return;
  }

  if (pointerDiagnosticsEnabled) {
    logWindowEvent(
      `main-window: discarded deferred interactive shape after pet drag hold; requesting fresh shape `
      + `count=${deferredRegions.length} `
      + `first=${summarizeInteractiveRegion(deferredRegions[0])}`,
    );
  }
  scheduleNativeShapeRefreshAfterPetDragHold('post-drag-hold-expired');
}

function schedulePetDragFullWindowShapeHoldExpiry() {
  clearPetDragFullWindowShapeHoldTimer();

  const delayMs = Math.max(0, petDragFullWindowShapeHoldUntil - Date.now());
  if (delayMs <= 0) {
    applyDeferredInteractiveShapeAfterPetDragHold();
    return;
  }

  petDragFullWindowShapeHoldTimer = setTimeout(
    applyDeferredInteractiveShapeAfterPetDragHold,
    delayMs,
  );
  if (typeof petDragFullWindowShapeHoldTimer.unref === 'function') {
    petDragFullWindowShapeHoldTimer.unref();
  }
}

function scheduleNativeShapeRefreshAfterPetDragHold(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('desktop-pet:refresh-native-interactive-regions', {
      reason,
    });
  }, 0);
}

function canApplyInteractiveWindowShape() {
  return process.platform === 'win32'
    && mainWindow
    && !mainWindow.isDestroyed()
    && typeof mainWindow.setShape === 'function';
}

function hasInteractiveWindowShape() {
  return canApplyInteractiveWindowShape() && interactiveWindowShapeRegions.length > 0;
}

function applyInteractiveWindowShape() {
  if (!mainWindow || mainWindow.isDestroyed() || typeof mainWindow.setShape !== 'function') {
    interactiveWindowShapeApplied = false;
    return;
  }

  try {
    if (process.platform === 'win32' && interactiveWindowShapeRegions.length > 0) {
      mainWindow.setShape(interactiveWindowShapeRegions);
      interactiveWindowShapeApplied = true;
      if (pointerDiagnosticsEnabled) {
        const bounds = mainWindow.getBounds();
        logWindowEvent(
          `main-window: applied interactive shape count=${interactiveWindowShapeRegions.length} `
          + `first=${summarizeInteractiveRegion(interactiveWindowShapeRegions[0])} `
          + `bounds=${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
        );
      }
      return;
    }

    if (interactiveWindowShapeApplied) {
      mainWindow.setShape([]);
      interactiveWindowShapeApplied = false;
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: cleared interactive shape');
      }
    }
  } catch (error) {
    interactiveWindowShapeApplied = false;
    logWindowEvent(`main-window: failed to apply interactive shape ${error?.stack || error}`);
  }
}

function applyPointerPassthroughState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    isPointerPassthrough = Boolean(requestedPointerPassthrough);
    return;
  }

  // Native shape clips Windows hit testing to the visible/input regions, so keep
  // the shaped window interactive instead of rapidly toggling ignore state on hover.
  const nextIgnore = Boolean(requestedPointerPassthrough) && !hasInteractiveWindowShape();
  if (isPointerPassthrough === nextIgnore) {
    return;
  }

  isPointerPassthrough = nextIgnore;
  mainWindow.setIgnoreMouseEvents(nextIgnore, { forward: false });
  if (pointerDiagnosticsEnabled) {
    logWindowEvent(
      `main-window: pointer passthrough ignore=${nextIgnore} `
      + `requested=${requestedPointerPassthrough} shapeActive=${hasInteractiveWindowShape()}`,
    );
  }
}

function clearMainInteractiveLayerWarmupTimers() {
  if (mainInteractiveLayerWarmupTimer) {
    clearTimeout(mainInteractiveLayerWarmupTimer);
    mainInteractiveLayerWarmupTimer = null;
  }
  if (mainInteractiveLayerWarmupRestoreTimer) {
    clearTimeout(mainInteractiveLayerWarmupRestoreTimer);
    mainInteractiveLayerWarmupRestoreTimer = null;
  }
}

function canWarmMainInteractiveLayer() {
  return process.platform === 'win32'
    && mainWindow
    && !mainWindow.isDestroyed()
    && mainWindow.isVisible()
    && typeof mainWindow.setShape === 'function'
    && typeof mainWindow.setIgnoreMouseEvents === 'function';
}

function restoreMainInteractiveLayerWarmup() {
  mainInteractiveLayerWarmupRestoreTimer = null;
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    if (interactiveWindowShapeRegions.length > 0) {
      applyInteractiveWindowShape();
    } else if (interactiveWindowShapeApplied && typeof mainWindow.setShape === 'function') {
      mainWindow.setShape([]);
      interactiveWindowShapeApplied = false;
    }
  } catch (error) {
    interactiveWindowShapeApplied = false;
    logWindowEvent(`main-window: failed to restore interactive layer warmup shape ${error?.stack || error}`);
  }

  applyPointerPassthroughState();
  if (pointerDiagnosticsEnabled) {
    logWindowEvent('main-window: restored interactive layer warmup');
  }
}

function warmMainInteractiveLayer() {
  mainInteractiveLayerWarmupTimer = null;
  if (mainInteractiveLayerWarmupCompleted) {
    return;
  }
  if (!canWarmMainInteractiveLayer()) {
    return;
  }
  if (!requestedPointerPassthrough || interactiveWindowShapeRegions.length > 0) {
    return;
  }

  mainInteractiveLayerWarmupCompleted = true;
  try {
    mainWindow.setShape([MAIN_INTERACTIVE_LAYER_WARMUP_REGION]);
    interactiveWindowShapeApplied = true;
    mainWindow.setIgnoreMouseEvents(false, { forward: false });
    isPointerPassthrough = false;
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: warmed interactive layer with tiny shape');
    }
  } catch (error) {
    logWindowEvent(`main-window: failed to warm interactive layer ${error?.stack || error}`);
    restoreMainInteractiveLayerWarmup();
    return;
  }

  mainInteractiveLayerWarmupRestoreTimer = setTimeout(
    restoreMainInteractiveLayerWarmup,
    MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS,
  );
  if (typeof mainInteractiveLayerWarmupRestoreTimer.unref === 'function') {
    mainInteractiveLayerWarmupRestoreTimer.unref();
  }
}

function scheduleMainInteractiveLayerWarmup() {
  if (
    process.platform !== 'win32'
    || mainInteractiveLayerWarmupCompleted
    || mainInteractiveLayerWarmupTimer
    || mainInteractiveLayerWarmupRestoreTimer
  ) {
    return;
  }

  mainInteractiveLayerWarmupTimer = setTimeout(
    warmMainInteractiveLayer,
    MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS,
  );
  if (typeof mainInteractiveLayerWarmupTimer.unref === 'function') {
    mainInteractiveLayerWarmupTimer.unref();
  }
}

function attachLoadLogging(win, label) {
  if (!win || win.isDestroyed()) {
    return;
  }

  win.webContents.on('did-start-loading', () => {
    logWindowEvent(`${label}: did-start-loading`);
  });
  win.webContents.on('did-stop-loading', () => {
    logWindowEvent(`${label}: did-stop-loading ${win.webContents.getURL()}`);
  });
  win.webContents.on('did-finish-load', () => {
    logWindowEvent(`${label}: did-finish-load ${win.webContents.getURL()}`);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logWindowEvent(`${label}: did-fail-load code=${errorCode} mainFrame=${isMainFrame} url=${validatedURL} error=${errorDescription}`);
  });
  win.webContents.on('dom-ready', () => {
    logWindowEvent(`${label}: dom-ready ${win.webContents.getURL()}`);
  });
  win.on('closed', () => {
    logWindowEvent(`${label}: closed`);
  });
}

function keepWindowOnTop(win, relativeLevel = MAIN_TOPMOST_RELATIVE_LEVEL, options = {}) {
  const {
    bringToFront = false,
    topmostLevel = TOPMOST_WINDOW_LEVEL,
  } = options;
  if (!win || win.isDestroyed()) {
    return;
  }

  const previousState = topmostStateByWindow.get(win);
  const isWindowAlreadyTopmost = typeof win.isAlwaysOnTop === 'function'
    ? win.isAlwaysOnTop()
    : false;
  const needsTopmostRefresh = !previousState
    || previousState.relativeLevel !== relativeLevel
    || previousState.topmostLevel !== topmostLevel
    || !isWindowAlreadyTopmost;

  if (needsTopmostRefresh) {
    win.setAlwaysOnTop(true, topmostLevel, relativeLevel);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    topmostStateByWindow.set(win, {
      relativeLevel,
      topmostLevel,
    });
  }

  if (bringToFront && win.isVisible() && typeof win.moveTop === 'function') {
    win.moveTop();
  }
}

function scheduleKeepWindowOnTop(win, relativeLevel = MAIN_TOPMOST_RELATIVE_LEVEL, options = {}) {
  keepWindowOnTop(win, relativeLevel, options);
  setTimeout(() => keepWindowOnTop(win, relativeLevel, options), 0);
  setTimeout(() => keepWindowOnTop(win, relativeLevel, options), 250);
}

function keepAuxWindowsOnTop() {
  keepWindowOnTop(settingsWindow, AUX_TOPMOST_RELATIVE_LEVEL);
  keepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL);
}

function keepAreaPickerOnTop() {
  keepWindowOnTop(getAreaPickerWindow(), AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
}

function keepPersistentAreaBorderOnTop() {
  keepWindowOnTop(getPersistentAreaBorderWindow(), PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
}

function scheduleAuxWindowsOnTop() {
  scheduleKeepWindowOnTop(settingsWindow, AUX_TOPMOST_RELATIVE_LEVEL);
  scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL);
}

function scheduleAreaPickerOnTop() {
  scheduleKeepWindowOnTop(getAreaPickerWindow(), AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
}

function schedulePersistentAreaBorderOnTop() {
  scheduleKeepWindowOnTop(getPersistentAreaBorderWindow(), PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
}

function keepWindowStackOnTop() {
  keepWindowOnTop(mainWindow, MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  keepAuxWindowsOnTop();
  keepPersistentAreaBorderOnTop();
  keepAreaPickerOnTop();
}

function scheduleWindowStackOnTop() {
  scheduleKeepWindowOnTop(mainWindow, MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  scheduleAuxWindowsOnTop();
  schedulePersistentAreaBorderOnTop();
  scheduleAreaPickerOnTop();
}

function hasVisibleAuxWindow() {
  return Boolean(
    (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible())
    || (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible())
    || (getAreaPickerWindow() && !getAreaPickerWindow().isDestroyed() && getAreaPickerWindow().isVisible())
  );
}

function startMainTopmostGuard() {
  if (mainTopmostGuard) {
    return;
  }

  mainTopmostGuard = setInterval(() => {
    if (hasVisibleAuxWindow()) {
      return;
    }

    keepWindowOnTop(mainWindow, MAIN_TOPMOST_RELATIVE_LEVEL);
  }, TOPMOST_GUARD_INTERVAL_MS);
  if (typeof mainTopmostGuard.unref === 'function') {
    mainTopmostGuard.unref();
  }
}

function stopMainTopmostGuard() {
  if (!mainTopmostGuard) {
    return;
  }

  clearInterval(mainTopmostGuard);
  mainTopmostGuard = null;
}

function resolveAppIconPath() {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ];

  for (const iconPath of candidates) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      return iconPath;
    }
  }

  return null;
}

function getBrowserWindowIconOptions() {
  const iconPath = resolveAppIconPath();
  return iconPath ? { icon: iconPath } : {};
}

function resolveTrayIcon() {
  const candidates = [
    resolveAppIconPath(),
    process.execPath,
  ].filter(Boolean);

  for (const iconPath of candidates) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16 });
    }
  }

  return nativeImage.createEmpty();
}

function getCompactWindowBounds() {
  const display = captureService.getTargetDisplay();
  const virtualBounds = captureService.getVirtualDisplayBounds();
  const fallbackBounds = captureService.getFullDisplayBounds(display);
  const bounds = virtualBounds && virtualBounds.width > 0 && virtualBounds.height > 0
    ? virtualBounds
    : fallbackBounds;

  return {
      display,
      x: bounds.x,
      y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function getSettingsWindowBounds() {
  return getCompactWindowBounds();
}

function getSettingsPanelWindowBounds() {
  const display = captureService.getTargetDisplay();
  const width = Math.min(SETTINGS_PANEL_WINDOW_BOUNDS.width, display.workArea.width);
  const height = Math.min(SETTINGS_PANEL_WINDOW_BOUNDS.height, display.workArea.height);
  const x = Math.round(Math.max(
    display.workArea.x,
    display.workArea.x + display.workArea.width - width - 24,
  ));
  const y = Math.round(Math.max(
    display.workArea.y,
    display.workArea.y + Math.max(24, (display.workArea.height - height) / 2),
  ));

  return {
    x,
    y,
    width,
    height,
  };
}

function getChatPanelWindowBounds() {
  return getResolvedChatPanelWindowBounds();
}

function resolveDisplayById(displayId) {
  if (displayId !== 'primary') {
    const matchedDisplay = screen.getAllDisplays().find(
      (display) => String(display.id) === String(displayId),
    );
    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  return screen.getPrimaryDisplay();
}

function getResolvedInteractiveDialogueDisplay() {
  const settings = latestSharedState?.config?.settings ?? {};
  const activityDisplayId = typeof settings.activityDisplayId === 'string'
    ? settings.activityDisplayId
    : 'primary';
  const interactiveDialogueDisplayId = typeof settings.interactiveDialogueDisplayId === 'string'
    ? settings.interactiveDialogueDisplayId
    : 'activity';
  const resolvedDisplayId = interactiveDialogueDisplayId === 'activity'
    ? activityDisplayId
    : interactiveDialogueDisplayId;

  return resolveDisplayById(resolvedDisplayId);
}

function isInteractiveDialogueChatActive() {
  return Boolean(
    latestSharedState?.interactiveDialogueActive
    && latestSharedState?.chatState?.chatMode === 'single',
  );
}

function getActiveChatPanelWindowBoundsPreset() {
  return isInteractiveDialogueChatActive()
    ? INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS
    : CHAT_PANEL_WINDOW_BOUNDS;
}

function getResolvedChatPanelWindowLimits() {
  const display = isInteractiveDialogueChatActive()
    ? getResolvedInteractiveDialogueDisplay()
    : captureService.getTargetDisplay();
  const workArea = display.workArea || display.bounds;
  const preset = getActiveChatPanelWindowBoundsPreset();
  const minWidth = Math.min(preset.minWidth, workArea.width);
  const minHeight = Math.min(preset.minHeight, workArea.height);

  return {
    display,
    maxHeight: Math.max(minHeight, Math.min(preset.maxHeight, workArea.height)),
    maxWidth: Math.max(minWidth, Math.min(preset.maxWidth, workArea.width)),
    minHeight,
    minWidth,
    workArea,
  };
}

function applyChatWindowSizeConstraints(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (isCurrentWindowCompactMinimumSizeActive(win)) {
    return;
  }

  const limits = getResolvedChatPanelWindowLimits();
  win.setMinimumSize(limits.minWidth, limits.minHeight);
  win.setMaximumSize(limits.maxWidth, limits.maxHeight);
}

function getResolvedChatPanelWindowBounds(currentBounds = null) {
  const limits = getResolvedChatPanelWindowLimits();
  const { workArea } = limits;
  const preset = getActiveChatPanelWindowBoundsPreset();
  const requestedWidth = currentBounds?.width ?? preset.width;
  const requestedHeight = currentBounds?.height ?? preset.height;
  const width = Math.min(
    limits.maxWidth,
    Math.max(limits.minWidth, Math.round(requestedWidth)),
  );
  const height = Math.min(
    limits.maxHeight,
    Math.max(limits.minHeight, Math.round(requestedHeight)),
  );

  if (isInteractiveDialogueChatActive()) {
    const centeredX = workArea.x + (workArea.width - width) / 2;
    const centeredY = workArea.y + workArea.height * INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO - height / 2;

    return {
      x: Math.round(Math.max(
        workArea.x,
        Math.min(workArea.x + workArea.width - width, centeredX),
      )),
      y: Math.round(Math.max(
        workArea.y,
        Math.min(workArea.y + workArea.height - height, centeredY),
      )),
      width,
      height,
    };
  }

  const x = Math.round(Math.max(
    workArea.x,
    workArea.x + workArea.width - width - 24,
  ));
  const y = Math.round(Math.max(
    workArea.y,
    workArea.y + 24,
  ));

  return {
    x,
    y,
    width,
    height,
  };
}

function syncInteractiveChatWindowBounds() {
  if (!chatWindow || chatWindow.isDestroyed()) {
    return;
  }

  if (isCurrentWindowCompactMinimumSizeActive(chatWindow)) {
    return;
  }

  applyChatWindowSizeConstraints(chatWindow);
  if (!isInteractiveDialogueChatActive()) {
    return;
  }

  const currentBounds = chatWindow.getBounds();
  const nextBounds = getResolvedChatPanelWindowBounds(currentBounds);
  if (
    currentBounds.x === nextBounds.x
    && currentBounds.y === nextBounds.y
    && currentBounds.width === nextBounds.width
    && currentBounds.height === nextBounds.height
  ) {
    return;
  }

  chatWindow.setBounds(nextBounds, false);
}

function scheduleSettingsWindowDisplayRefresh(delayMs = SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS) {
  if (!settingsWindow || settingsWindow.isDestroyed() || !settingsWindow.isVisible()) {
    return;
  }

  if (settingsWindowDisplayRefreshTimer) {
    clearTimeout(settingsWindowDisplayRefreshTimer);
  }

  const nextSettingsWindow = settingsWindow;
  settingsWindowDisplayRefreshTimer = setTimeout(() => {
    settingsWindowDisplayRefreshTimer = null;

    if (!nextSettingsWindow || nextSettingsWindow.isDestroyed() || !nextSettingsWindow.isVisible()) {
      return;
    }

    void captureService.broadcastDisplayEnvironment({
      includeCaptureSources: false,
      preferCachedCaptureSources: true,
      windows: [nextSettingsWindow],
    });
  }, delayMs);
}

function scheduleSettingsWindowContentRefresh(options = {}) {
  const {
    forceCaptureSourceRefresh = false,
    forceDisplayRefresh = false,
  } = options;
  const now = Date.now();

  if (
    !forceDisplayRefresh
    && (now - settingsWindowContentRefreshAt) <= SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS
  ) {
    return;
  }

  settingsWindowContentRefreshAt = now;

  scheduleSettingsWindowDisplayRefresh();
  captureService.scheduleDisplayEnvironmentBroadcast({
    includeCaptureSources: false,
    preferCachedCaptureSources: true,
    windows: getShellRendererWindows(),
    delayMs: DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS,
  });

  if (forceCaptureSourceRefresh) {
    captureService.scheduleCaptureSourceRefreshBroadcast(
      SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,
      { force: forceCaptureSourceRefresh },
    );
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    return settingsWindow;
  }

  const initialBounds = getSettingsPanelWindowBounds();
  const nextSettingsWindow = new BrowserWindow({
    ...initialBounds,
    ...getBrowserWindowIconOptions(),
    minWidth: SETTINGS_PANEL_WINDOW_BOUNDS.minWidth,
    minHeight: SETTINGS_PANEL_WINDOW_BOUNDS.minHeight,
    maxWidth: SETTINGS_PANEL_WINDOW_BOUNDS.maxWidth,
    maxHeight: SETTINGS_PANEL_WINDOW_BOUNDS.maxHeight,
    frame: false,
    transparent: false,
    hasShadow: true,
    thickFrame: false,
    resizable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    autoHideMenuBar: true,
    backgroundColor: '#f5faff',
    title: 'AI Desktop Pet Settings',
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(sessionPartition ? { partition: sessionPartition } : {}),
    },
  });

  settingsWindow = nextSettingsWindow;
  attachLoadLogging(nextSettingsWindow, 'settings-window');
  scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL);

  nextSettingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  nextSettingsWindow.webContents.once('did-finish-load', () => {
    if (settingsWindow !== nextSettingsWindow || nextSettingsWindow.isDestroyed()) {
      return;
    }

    broadcastSharedState();

    if (nextSettingsWindow.isVisible()) {
      scheduleSettingsWindowContentRefresh();
    }
  });

  nextSettingsWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    nextSettingsWindow.hide();
  });
  nextSettingsWindow.on('show', () => {
    notifySettingsWindowState();
    broadcastSharedState();
    scheduleWindowStackOnTop();
    scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL);
    if (!nextSettingsWindow.webContents.isLoadingMainFrame()) {
      scheduleSettingsWindowContentRefresh();
    }
  });
  nextSettingsWindow.on('hide', () => {
    notifySettingsWindowState();
    scheduleWindowStackOnTop();
  });
  nextSettingsWindow.on('focus', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  nextSettingsWindow.on('restore', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  nextSettingsWindow.on('move', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  nextSettingsWindow.on('resize', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  nextSettingsWindow.on('closed', () => {
    if (settingsWindow === nextSettingsWindow) {
      settingsWindow = null;
    }
    settingsWindowReadyPromise = null;
    notifySettingsWindowState();
  });

  loadRenderer(nextSettingsWindow, { desktop: '1', panel: 'settings' });
  return nextSettingsWindow;
}

function ensureSettingsWindowReady() {
  if (settingsWindow && !settingsWindow.isDestroyed() && !settingsWindowReadyPromise) {
    return Promise.resolve(settingsWindow);
  }

  if (settingsWindowReadyPromise) {
    return settingsWindowReadyPromise;
  }

  const nextSettingsWindow = createSettingsWindow();

  if (!nextSettingsWindow || nextSettingsWindow.isDestroyed()) {
    return Promise.resolve(null);
  }

  if (!nextSettingsWindow.webContents.isLoadingMainFrame()) {
    return Promise.resolve(nextSettingsWindow);
  }

  const readyPromise = new Promise((resolve) => {
    let resolved = false;
    const resolveOnce = (win) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(win);
    };

    nextSettingsWindow.webContents.once('did-finish-load', () => resolveOnce(nextSettingsWindow));
    nextSettingsWindow.webContents.once('did-fail-load', () => resolveOnce(nextSettingsWindow));
    nextSettingsWindow.once('closed', () => resolveOnce(null));
  }).finally(() => {
    if (settingsWindowReadyPromise === readyPromise) {
      settingsWindowReadyPromise = null;
    }
  });

  settingsWindowReadyPromise = readyPromise;
  return readyPromise;
}

function showSettingsWindow() {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    return;
  }

  const wasVisible = settingsWindow.isVisible();
  const nextBounds = getSettingsPanelWindowBounds();
  const currentBounds = settingsWindow.getBounds();
  if (
    currentBounds.x !== nextBounds.x
    || currentBounds.y !== nextBounds.y
    || currentBounds.width !== nextBounds.width
    || currentBounds.height !== nextBounds.height
  ) {
    settingsWindow.setBounds(nextBounds);
  }
  if (settingsWindow.isMinimized()) {
    settingsWindow.restore();
  }

  const reloadedSettingsContent = !settingsWindow.webContents.isLoadingMainFrame()
    && !isSettingsWindowAtSettingsPanelUrl(settingsWindow);
  if (reloadedSettingsContent) {
    logWindowEvent(`settings-window: reloading unexpected URL ${settingsWindow.webContents.getURL() || '<empty>'}`);
    loadRenderer(settingsWindow, { desktop: '1', panel: 'settings' });
  }

  settingsWindow.show();
  settingsWindow.focus();
  scheduleKeepWindowOnTop(settingsWindow, AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  scheduleWindowStackOnTop();
  notifySettingsWindowState();

  if (wasVisible && !reloadedSettingsContent) {
    scheduleSettingsWindowContentRefresh();
  }
}

function preloadSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    return;
  }

  void ensureSettingsWindowReady().catch(() => {});
}

function isSettingsWindowAtSettingsPanelUrl(win) {
  if (!win || win.isDestroyed()) {
    return false;
  }

  const currentUrl = win.webContents.getURL();
  if (!currentUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(currentUrl);
    if (parsedUrl.searchParams.get('panel') !== 'settings') {
      return false;
    }

    if (isDev) {
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    }

    return parsedUrl.protocol === 'file:' && /(?:^|\/)index\.html$/iu.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

function loadRenderer(win, query = { desktop: '1' }) {
  const encodedDebugModelPath = localTestDebugModelPath
    ? Buffer.from(localTestDebugModelPath, 'utf8').toString('base64')
    : '';
  const encodedDesktopModelPath = localTestDesktopModelPath
    ? Buffer.from(localTestDesktopModelPath, 'utf8').toString('base64')
    : '';
  const nextQuery = {
    ...query,
    ...(encodedDebugModelPath ? { debugModelPathBase64: encodedDebugModelPath } : {}),
    ...(encodedDesktopModelPath ? { desktopDebugModelPathBase64: encodedDesktopModelPath } : {}),
    ...(localTestDebugModelScale ? { debugModelScale: localTestDebugModelScale } : {}),
    ...(localTestDesktopModelScale ? { desktopDebugModelScale: localTestDesktopModelScale } : {}),
    ...(localTestDebugFocusX ? { debugFocusX: localTestDebugFocusX } : {}),
    ...(localTestDebugFocusY ? { debugFocusY: localTestDebugFocusY } : {}),
    ...(localTestMenuPausePetId ? { localTestMenuPausePetId } : {}),
    ...(localTestMenuPauseOpenDelayMs ? { localTestMenuPauseOpenDelayMs } : {}),
    ...(localTestMenuPauseWaitForMovementMs ? { localTestMenuPauseWaitForMovementMs } : {}),
    ...(localTestMenuPauseObserveMs ? { localTestMenuPauseObserveMs } : {}),
    ...(localTestMenuPauseThresholdPx ? { localTestMenuPauseThresholdPx } : {}),
    ...(localTestDragPrimaryPetId ? { localTestDragPrimaryPetId } : {}),
    ...(localTestPrimarySnapBackPetId ? { localTestPrimarySnapBackPetId } : {}),
    ...(localTestDragCompanionPetId ? { localTestDragCompanionPetId } : {}),
    ...(localTestDragStartDelayMs ? { localTestDragStartDelayMs } : {}),
    ...(localTestDragWaitForMovementMs ? { localTestDragWaitForMovementMs } : {}),
    ...(localTestDragObserveMs ? { localTestDragObserveMs } : {}),
    ...(localTestDragSampleIntervalMs ? { localTestDragSampleIntervalMs } : {}),
    ...(localTestDragDeltaX ? { localTestDragDeltaX } : {}),
    ...(localTestDragDeltaY ? { localTestDragDeltaY } : {}),
    ...(localTestDragStepThresholdPx ? { localTestDragStepThresholdPx } : {}),
    ...(pointerDiagnosticsEnabled ? { pointerDiagnostics: '1' } : {}),
    ...(forceFullShapeOnDragEnabled ? { forceFullShapeOnDrag: '1' } : {}),
  };
  const navigation = (() => {
  if (isDev) {
    const searchParams = new URLSearchParams(nextQuery);
      return win.loadURL(`http://127.0.0.1:3000/?${searchParams.toString()}`);
  }

    return win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: nextQuery,
    });
  })();

  if (navigation && typeof navigation.catch === 'function') {
    navigation.catch((error) => {
      const label = !win || win.isDestroyed()
        ? 'destroyed-window'
        : (win.getTitle() || 'untitled-window');
      logWindowEvent(`loadRenderer: failed for ${label} query=${JSON.stringify(nextQuery)} error=${error?.stack || error}`);
    });
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindowRendererReadyFallbackTimer) {
    clearTimeout(mainWindowRendererReadyFallbackTimer);
    mainWindowRendererReadyFallbackTimer = null;
  }

  if (typeof mainWindow.showInactive === 'function') {
    mainWindow.showInactive();
  } else {
    mainWindow.show();
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  scheduleKeepWindowOnTop(mainWindow, MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  scheduleWindowStackOnTop();
  scheduleMainInteractiveLayerWarmup();
}

function showMainWindowWhenReady(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!mainWindowCanShow || !mainWindowRendererReadyToShow) {
    logWindowEvent(
      `main-window: waiting to show reason=${reason} `
      + `electronReady=${mainWindowCanShow} rendererReady=${mainWindowRendererReadyToShow}`,
    );
    return;
  }

  showMainWindow();
}

function markMainWindowReadyToShow(reason = 'renderer') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!mainWindowRendererReadyToShow) {
    mainWindowRendererReadyToShow = true;
    logWindowEvent(`main-window: renderer ready to show reason=${reason}`);
  }

  if (mainWindowRendererReadyFallbackTimer) {
    clearTimeout(mainWindowRendererReadyFallbackTimer);
    mainWindowRendererReadyFallbackTimer = null;
  }

  showMainWindowWhenReady(reason);
}

function scheduleMainWindowRendererReadyFallback() {
  if (mainWindowRendererReadyFallbackTimer) {
    clearTimeout(mainWindowRendererReadyFallbackTimer);
    mainWindowRendererReadyFallbackTimer = null;
  }

  mainWindowRendererReadyFallbackTimer = setTimeout(() => {
    mainWindowRendererReadyFallbackTimer = null;
    markMainWindowReadyToShow('renderer-ready-timeout');
  }, MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS);

  if (typeof mainWindowRendererReadyFallbackTimer.unref === 'function') {
    mainWindowRendererReadyFallbackTimer.unref();
  }
}

function hideMainWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.hide();
}

function setWindowPointerPassthrough(ignore) {
  requestedPointerPassthrough = Boolean(ignore);
  applyPointerPassthroughState();
}

function setInteractiveRegions(regions, options = null) {
  const nextInteractiveWindowShapeRegions = normalizeInteractiveRegions(regions);
  const nextInteractiveWindowShapeSignature = createInteractiveRegionsSignature(nextInteractiveWindowShapeRegions);
  const interactiveRegionSource = normalizeInteractiveRegionSource(options);
  const nextIsFullWindowShape = isFullWindowInteractiveShape(nextInteractiveWindowShapeRegions);
  const nextIsPetDragFullWindowShape = interactiveRegionSource === 'pet-drag' && nextIsFullWindowShape;
  const shouldRetainPetDragFullWindowShape = !nextIsPetDragFullWindowShape
    && !nextIsFullWindowShape
    && isPetDragFullWindowShapeRetained();
  const shouldHoldCurrentPetDragFullWindowShape = !nextIsPetDragFullWindowShape
    && !nextIsFullWindowShape
    && Date.now() < petDragFullWindowShapeHoldUntil
    && isFullWindowInteractiveShape(interactiveWindowShapeRegions);

  if (nextIsPetDragFullWindowShape) {
    pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
    pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
    pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
    petDragFullWindowShapeHoldUntil = Date.now() + PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS;
    schedulePetDragFullWindowShapeHoldExpiry();
  } else if (shouldRetainPetDragFullWindowShape || shouldHoldCurrentPetDragFullWindowShape) {
    pendingInteractiveWindowShapeRegionsAfterPetDragHold = nextInteractiveWindowShapeRegions;
    pendingInteractiveWindowShapeSignatureAfterPetDragHold = nextInteractiveWindowShapeSignature;
    pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = Date.now();
    schedulePetDragFullWindowShapeHoldExpiry();
    ensurePetDragFullWindowInteractiveShape(petDragNativeShapeActive ? 'active-session' : 'post-drag-hold');
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: retained pet drag full-window shape while deferring `
        + `count=${nextInteractiveWindowShapeRegions.length} `
        + `first=${summarizeInteractiveRegion(nextInteractiveWindowShapeRegions[0])}`,
      );
    }
    applyPointerPassthroughState();
    return;
  }

  if (
    nextInteractiveWindowShapeRegions.length === 0
    && !requestedPointerPassthrough
    && interactiveWindowShapeRegions.length > 0
  ) {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: retained interactive shape during active pointer interaction `
        + `first=${summarizeInteractiveRegion(interactiveWindowShapeRegions[0])}`,
      );
    }
    return;
  }

  if (interactiveWindowShapeSignature === nextInteractiveWindowShapeSignature) {
    if (
      nextInteractiveWindowShapeRegions.length > 0
      && canApplyInteractiveWindowShape()
      && !interactiveWindowShapeApplied
    ) {
      interactiveWindowShapeRegions = nextInteractiveWindowShapeRegions;
      applyInteractiveWindowShape();
      applyPointerPassthroughState();
    }
    return;
  }

  pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
  pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
  pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
  interactiveWindowShapeRegions = nextInteractiveWindowShapeRegions;
  if (pointerDiagnosticsEnabled && interactiveWindowShapeSignature !== nextInteractiveWindowShapeSignature) {
    logWindowEvent(
      `main-window: received interactive shape count=${interactiveWindowShapeRegions.length} `
      + `first=${summarizeInteractiveRegion(interactiveWindowShapeRegions[0])}`,
    );
  }
  interactiveWindowShapeSignature = nextInteractiveWindowShapeSignature;
  applyInteractiveWindowShape();
  applyPointerPassthroughState();
}

function setPetDragNativeShapeActive(active) {
  const nextActive = Boolean(active);
  if (petDragNativeShapeActive === nextActive) {
    if (nextActive) {
      ensurePetDragFullWindowInteractiveShape('active-session-refresh');
    }
    return;
  }

  petDragNativeShapeActive = nextActive;
  if (nextActive) {
    pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
    pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
    pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
    petDragFullWindowShapeEndedAt = 0;
    petDragFullWindowShapeHoldUntil = 0;
    clearPetDragFullWindowShapeHoldTimer();
    ensurePetDragFullWindowInteractiveShape('active-session-start');
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: pet drag native shape session started');
    }
    return;
  }

  petDragFullWindowShapeEndedAt = Date.now();
  petDragFullWindowShapeHoldUntil = Date.now() + PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS;
  ensurePetDragFullWindowInteractiveShape('active-session-end-hold');
  schedulePetDragFullWindowShapeHoldExpiry();
  if (pointerDiagnosticsEnabled) {
    logWindowEvent('main-window: pet drag native shape session ended');
  }
}

function getIsSettingsWindowOpen() {
  return Boolean(settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible());
}

function getIsChatWindowOpen() {
  return Boolean(chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible());
}

function notifySettingsWindowState() {
  const isOpen = getIsSettingsWindowOpen();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-pet:settings-window-state', isOpen);
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('desktop-pet:settings-window-state', isOpen);
  }
}

function notifyChatWindowState() {
  const isOpen = getIsChatWindowOpen();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-pet:chat-window-state', isOpen);
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('desktop-pet:chat-window-state', isOpen);
  }

  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('desktop-pet:chat-window-state', isOpen);
  }
}

function broadcastSharedState() {
  if (!latestSharedState) {
    return;
  }

  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
    settingsWindow.webContents.send('desktop-pet:shared-state', latestSharedState);
  }

  if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
    chatWindow.webContents.send('desktop-pet:shared-state', latestSharedState);
  }
}

function resizeWindowForSettings(isOpen) {
  if (!mainWindow) {
    return;
  }

  const nextBounds = isOpen ? getSettingsWindowBounds() : getCompactWindowBounds();

  mainWindow.setMinimumSize(nextBounds.width, nextBounds.height);
  mainWindow.setMaximumSize(nextBounds.width, nextBounds.height);
  mainWindow.setBounds({
    x: nextBounds.x,
    y: nextBounds.y,
    width: nextBounds.width,
    height: nextBounds.height,
  });
  scheduleWindowStackOnTop();
}

function resizeWindowAroundCurrentCenter(isOpen) {
  if (!mainWindow) {
    return;
  }

  const nextBounds = isOpen ? getSettingsWindowBounds() : getCompactWindowBounds();
  const currentBounds = mainWindow.getBounds();
  const displayBounds = captureService.getVirtualDisplayBounds();
  const centerX = currentBounds.x + currentBounds.width / 2;
  const centerY = currentBounds.y + currentBounds.height / 2;
  const nextX = Math.round(Math.max(
    displayBounds.x,
    Math.min(displayBounds.x + displayBounds.width - nextBounds.width, centerX - nextBounds.width / 2),
  ));
  const nextY = Math.round(Math.max(
    displayBounds.y,
    Math.min(displayBounds.y + displayBounds.height - nextBounds.height, centerY - nextBounds.height / 2),
  ));

  mainWindow.setMinimumSize(nextBounds.width, nextBounds.height);
  mainWindow.setMaximumSize(nextBounds.width, nextBounds.height);
  mainWindow.setBounds({
    x: nextX,
    y: nextY,
    width: nextBounds.width,
    height: nextBounds.height,
  });
  scheduleWindowStackOnTop();
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
}

async function openSettingsWindow() {
  try {
    const nextSettingsWindow = await ensureSettingsWindowReady();
    if (!nextSettingsWindow || nextSettingsWindow.isDestroyed()) {
      return;
    }

    showSettingsWindow();
  } catch (error) {
    console.error('Failed to open settings window:', error);
  }
}

function closeChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.hide();
  }
}

function openChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    applyChatWindowSizeConstraints(chatWindow);
    chatWindow.setBounds(getResolvedChatPanelWindowBounds(chatWindow.getBounds()));
    chatWindow.show();
    if (chatWindow.isMinimized()) {
      chatWindow.restore();
    }
    chatWindow.focus();
    scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    scheduleWindowStackOnTop();
    notifyChatWindowState();
    broadcastSharedState();
    return;
  }

  const initialBounds = getChatPanelWindowBounds();
  const initialLimits = getResolvedChatPanelWindowLimits();
  chatWindow = new BrowserWindow({
    ...initialBounds,
    ...getBrowserWindowIconOptions(),
    minWidth: initialLimits.minWidth,
    minHeight: initialLimits.minHeight,
    maxWidth: initialLimits.maxWidth,
    maxHeight: initialLimits.maxHeight,
    frame: false,
    transparent: false,
    hasShadow: true,
    thickFrame: false,
    resizable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#f5faff',
    title: 'AI Desktop Pet Chat',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(sessionPartition ? { partition: sessionPartition } : {}),
    },
  });
  attachLoadLogging(chatWindow, 'chat-window');

  scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL);

  chatWindow.once('ready-to-show', () => {
    if (!chatWindow || chatWindow.isDestroyed()) {
      return;
    }

    applyChatWindowSizeConstraints(chatWindow);
    chatWindow.setBounds(getResolvedChatPanelWindowBounds(chatWindow.getBounds()));
    chatWindow.show();
    chatWindow.focus();
    scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    scheduleWindowStackOnTop();
  });

  chatWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  chatWindow.webContents.once('did-finish-load', () => {
    broadcastSharedState();
  });

  chatWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    chatWindow.hide();
  });
  chatWindow.on('show', () => {
    notifyChatWindowState();
    broadcastSharedState();
    syncInteractiveChatWindowBounds();
    scheduleWindowStackOnTop();
    scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL);
  });
  chatWindow.on('hide', () => {
    notifyChatWindowState();
    scheduleWindowStackOnTop();
  });
  chatWindow.on('focus', () => scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  chatWindow.on('restore', () => scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  chatWindow.on('move', () => scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  chatWindow.on('resize', () => {
    syncInteractiveChatWindowBounds();
    scheduleKeepWindowOnTop(chatWindow, AUX_TOPMOST_RELATIVE_LEVEL);
  });
  chatWindow.on('closed', () => {
    chatWindow = null;
    notifyChatWindowState();
  });

  loadRenderer(chatWindow, { desktop: '1', panel: 'chat' });
}

function createTray() {
  tray = new Tray(resolveTrayIcon());
  tray.setToolTip('AI Desktop Pet');

  const trayMenuTemplate = [
    {
      label: '\u663e\u793a\u5ba0\u7269',
      click: () => showMainWindow(),
    },
    {
      label: '\u6253\u5f00\u8bbe\u7f6e',
      click: () => openSettingsWindow(),
    },
    {
      label: '\u9690\u85cf\u5230\u540e\u53f0',
      click: () => hideMainWindow(),
    },
    { type: 'separator' },
    {
      label: '\u9000\u51fa',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate));

  tray.on('double-click', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isVisible()) {
      hideMainWindow();
      return;
    }

    showMainWindow();
  });
}

function createWindow() {
  mainWindowCanShow = false;
  mainWindowRendererReadyToShow = false;

  mainWindow = new BrowserWindow({
    width: COMPACT_WINDOW_BOUNDS.width,
    height: COMPACT_WINDOW_BOUNDS.height,
    ...getBrowserWindowIconOptions(),
    minWidth: COMPACT_WINDOW_BOUNDS.minWidth,
    minHeight: COMPACT_WINDOW_BOUNDS.minHeight,
    maxWidth: COMPACT_WINDOW_BOUNDS.maxWidth,
    maxHeight: COMPACT_WINDOW_BOUNDS.maxHeight,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    title: 'AI Desktop Pet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(sessionPartition ? { partition: sessionPartition } : {}),
    },
  });
  attachLoadLogging(mainWindow, 'main-window');

  scheduleWindowStackOnTop();
  resizeWindowForSettings(false);
  scheduleWindowStackOnTop();
  startMainTopmostGuard();
  setWindowPointerPassthrough(true);
  scheduleMainWindowRendererReadyFallback();

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindowCanShow = true;
    showMainWindowWhenReady('ready-to-show');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindowCanShow = true;
      showMainWindowWhenReady('did-finish-load');
    }

    notifySettingsWindowState();
    notifyChatWindowState();
    broadcastSharedState();
    scheduleWindowStackOnTop();
    captureService.scheduleDisplayEnvironmentBroadcast({
      includeCaptureSources: false,
      windows: getShellRendererWindows(),
    });
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    hideMainWindow();
  });
  mainWindow.on('show', () => scheduleWindowStackOnTop());
  mainWindow.on('restore', () => scheduleWindowStackOnTop());
  mainWindow.on('blur', () => scheduleWindowStackOnTop());
  mainWindow.on('move', () => scheduleWindowStackOnTop());
  mainWindow.on('resize', () => scheduleWindowStackOnTop());

  if (isDev && process.env.DESKTOP_PET_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  loadRenderer(mainWindow);
}

  function getMainWindow() {
    return mainWindow;
  }

  function getSettingsWindow() {
    return settingsWindow;
  }

  function getChatWindow() {
    return chatWindow;
  }

  function getShellRendererWindows() {
    return [mainWindow, settingsWindow, chatWindow].filter((win) => win && !win.isDestroyed());
  }

  function setQuitting(nextValue) {
    isQuitting = Boolean(nextValue);
  }

  function setSharedState(nextState) {
    latestSharedState = nextState ?? null;
    syncInteractiveChatWindowBounds();
    broadcastSharedState();
  }

  function getSharedState() {
    return latestSharedState;
  }

  function dispose() {
    stopMainTopmostGuard();
    clearMainInteractiveLayerWarmupTimers();
    if (mainWindowRendererReadyFallbackTimer) {
      clearTimeout(mainWindowRendererReadyFallbackTimer);
      mainWindowRendererReadyFallbackTimer = null;
    }
    if (settingsWindowDisplayRefreshTimer) {
      clearTimeout(settingsWindowDisplayRefreshTimer);
      settingsWindowDisplayRefreshTimer = null;
    }
  }

  return {
    broadcastSharedState,
    closeChatWindow,
    closeSettingsWindow,
    createMainWindow: createWindow,
    createTray,
    dispose,
    getChatWindow,
    getIsChatWindowOpen,
    getIsSettingsWindowOpen,
    getMainWindow,
    getSettingsWindow,
    getSharedState,
    getShellRendererWindows,
    getShellSettingsOpen: () => isShellSettingsOpen,
    hideMainWindow,
    keepWindowOnTop,
    markMainWindowReadyToShow,
    notifyChatWindowState,
    notifySettingsWindowState,
    openChatWindow,
    openSettingsWindow,
    preloadSettingsWindow,
    resizeWindowForSettings,
    scheduleKeepWindowOnTop,
    scheduleSettingsWindowContentRefresh,
    scheduleWindowStackOnTop,
    setInteractiveRegions,
    setPetDragNativeShapeActive,
    setPointerPassthrough: setWindowPointerPassthrough,
    setQuitting,
    setSettingsOpen: (isOpen) => {
      isShellSettingsOpen = Boolean(isOpen);
      resizeWindowForSettings(Boolean(isOpen));
    },
    setSharedState,
    showMainWindow,
    showSettingsWindow,
    startMainTopmostGuard,
    stopMainTopmostGuard,
  };
}

module.exports = {
  AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
  AUX_TOPMOST_RELATIVE_LEVEL,
  MAIN_TOPMOST_RELATIVE_LEVEL,
  PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL,
  TOPMOST_WINDOW_LEVEL,
  createWindowManager,
};
