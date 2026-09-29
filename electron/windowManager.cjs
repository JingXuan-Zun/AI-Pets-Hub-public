const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell } = require('electron');
const path = require('path');
const { disableDwmSystemBorderForWindow } = require('./windowsDwmBorderService.cjs');

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
  width: 1440,
  height: 820,
  minWidth: 1180,
  minHeight: 600,
};

const CHAT_PANEL_WINDOW_BOUNDS = {
  width: 1280,
  height: 820,
  minWidth: 760,
  minHeight: 560,
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
const POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL = 2;
const POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS = 5_000;
const USE_SEPARATE_RENDER_AND_INPUT_WINDOWS = process.platform === 'win32';
const AUX_TOPMOST_RELATIVE_LEVEL = 3;
const PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL = 4;
const AREA_PICKER_TOPMOST_RELATIVE_LEVEL = 5;
const SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS = 80;
const SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS = 1600;
const SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS = 5000;
const DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS = 120;
const TOPMOST_GUARD_INTERVAL_MS = 1200;
const MAX_INTERACTIVE_WINDOW_SHAPE_REGIONS = 320;
const PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS = 720;
const PREWARM_MAIN_INTERACTIVE_LAYER = process.env.DESKTOP_PET_PREWARM_INTERACTIVE_LAYER !== '0';
const HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS = (
  process.env.DESKTOP_PET_HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS === '1'
);
const DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS = (
  process.env.DESKTOP_PET_DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS === '1'
);
const MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS = 600;
const MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS = 80;
const MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS = 10_000;
const MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS = 1_500;
const MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT = 1;
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
const dragDiagnosticsEnabled = process.env.DESKTOP_PET_DRAG_DIAGNOSTICS === '1';
const pointerDiagnosticsEnabled = process.env.DESKTOP_PET_POINTER_DIAGNOSTICS === '1'
  || dragDiagnosticsEnabled;
const forceFullShapeOnDragEnabled = process.env.DESKTOP_PET_FORCE_FULL_SHAPE_ON_DRAG === '1';
const live2DDragProbeEnabled = process.env.DESKTOP_PET_LIVE2D_DRAG_PROBE === '1'
  || process.argv.includes('--live2d-drag-probe');

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
  let postDragInputProxyWindow = null;
  let postDragInputProxyReady = false;
  let postDragInputProxyPointerActive = false;
  let postDragInputProxyRegions = [];
  let postDragInputProxyPendingRegions = null;
  let postDragInputProxyShapeSignature = '';
  let postDragInputProxyIdleDestroyTimer = null;
  let settingsWindow = null;
  let chatWindow = null;
  let tray = null;
  let isQuitting = false;
  let isShellSettingsOpen = false;
let isPointerPassthrough = false;
let isPointerPassthroughForwarding = false;
let isAgentDesktopExecutionActive = false;
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
  let wasInteractiveDialogueChatActive = false;
  let mainTopmostGuard = null;
  let mainInteractiveLayerWarmupCompleted = false;
  let mainInteractiveLayerWarmupRestoreTimer = null;
  let mainInteractiveLayerWarmupTimer = null;
  let mainWindowCanShow = false;
  let mainWindowRendererRecoveryInProgress = false;
  let mainWindowRendererStartupRecoveryCount = 0;
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

function clearPostDragInputProxyIdleDestroyTimer() {
  if (!postDragInputProxyIdleDestroyTimer) {
    return;
  }

  clearTimeout(postDragInputProxyIdleDestroyTimer);
  postDragInputProxyIdleDestroyTimer = null;
}

function schedulePostDragInputProxyIdleDestroy(reason) {
  clearPostDragInputProxyIdleDestroyTimer();
  if (
    !postDragInputProxyWindow
    || postDragInputProxyWindow.isDestroyed()
    || postDragInputProxyPointerActive
  ) {
    return;
  }

  postDragInputProxyIdleDestroyTimer = setTimeout(() => {
    postDragInputProxyIdleDestroyTimer = null;
    if (
      !postDragInputProxyWindow
      || postDragInputProxyWindow.isDestroyed()
      || postDragInputProxyPointerActive
      || postDragInputProxyWindow.isVisible()
    ) {
      return;
    }

    if (pointerDiagnosticsEnabled) {
      logWindowEvent(`main-window: post-drag input proxy destroyed reason=${reason}`);
    }
    postDragInputProxyWindow.destroy();
  }, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS);
  if (typeof postDragInputProxyIdleDestroyTimer.unref === 'function') {
    postDragInputProxyIdleDestroyTimer.unref();
  }
}

function hidePostDragInputProxy(reason, force = false) {
  if (postDragInputProxyPointerActive && !force) {
    return;
  }

  postDragInputProxyRegions = [];
  postDragInputProxyPendingRegions = null;
  postDragInputProxyShapeSignature = '';
  if (!postDragInputProxyWindow || postDragInputProxyWindow.isDestroyed()) {
    return;
  }

  postDragInputProxyWindow.hide();
  schedulePostDragInputProxyIdleDestroy(reason);
  if (pointerDiagnosticsEnabled) {
    logWindowEvent(`main-window: post-drag input proxy hidden reason=${reason}`);
  }
}

function applyPostDragInputProxyRegions() {
  if (
    !postDragInputProxyWindow
    || postDragInputProxyWindow.isDestroyed()
    || !postDragInputProxyReady
    || postDragInputProxyRegions.length === 0
    || !mainWindow
    || mainWindow.isDestroyed()
    || !mainWindow.isVisible()
  ) {
    return;
  }

  try {
    clearPostDragInputProxyIdleDestroyTimer();
    const mainBounds = mainWindow.getBounds();
    const proxyBounds = postDragInputProxyWindow.getBounds();
    if (
      proxyBounds.x !== mainBounds.x
      || proxyBounds.y !== mainBounds.y
      || proxyBounds.width !== mainBounds.width
      || proxyBounds.height !== mainBounds.height
    ) {
      postDragInputProxyWindow.setBounds(mainBounds);
    }

    const nextShapeSignature = createInteractiveRegionsSignature(postDragInputProxyRegions);
    if (postDragInputProxyShapeSignature !== nextShapeSignature) {
      postDragInputProxyWindow.setShape(postDragInputProxyRegions);
      postDragInputProxyShapeSignature = nextShapeSignature;
    }

    if (!postDragInputProxyWindow.isVisible()) {
      if (typeof postDragInputProxyWindow.showInactive === 'function') {
        postDragInputProxyWindow.showInactive();
      } else {
        postDragInputProxyWindow.show();
      }
      keepWindowOnTop(
        postDragInputProxyWindow,
        POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
        { bringToFront: true },
      );
    }
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: post-drag input proxy shown count=${postDragInputProxyRegions.length} `
        + `first=${summarizeInteractiveRegion(postDragInputProxyRegions[0])}`,
      );
    }
  } catch (error) {
    logWindowEvent(`main-window: failed to apply post-drag input proxy ${error?.stack || error}`);
    hidePostDragInputProxy('apply-failed', true);
  }
}

function ensurePostDragInputProxyWindow() {
  if (postDragInputProxyWindow && !postDragInputProxyWindow.isDestroyed()) {
    clearPostDragInputProxyIdleDestroyTimer();
    return postDragInputProxyWindow;
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  postDragInputProxyReady = false;
  postDragInputProxyPointerActive = false;
  postDragInputProxyWindow = new BrowserWindow({
    ...mainWindow.getBounds(),
    frame: false,
    transparent: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    opacity: 0.01,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    title: 'AI Desktop Pet Input Proxy',
    webPreferences: {
      preload: path.join(__dirname, 'postDragInputProxyPreload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(sessionPartition ? { partition: sessionPartition } : {}),
    },
  });
  const inputProxyWindow = postDragInputProxyWindow;
  inputProxyWindow.setOpacity(0.01);
  void disableDwmSystemBorderForWindow(inputProxyWindow).then((result) => {
    if (pointerDiagnosticsEnabled && !result.applied) {
      logWindowEvent(
        `main-window: input proxy DWM border disable skipped reason=${result.reason}`,
      );
    }
  });
  postDragInputProxyWindow.setAlwaysOnTop(
    true,
    TOPMOST_WINDOW_LEVEL,
    POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
  );
  postDragInputProxyWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  inputProxyWindow.webContents.once('did-finish-load', () => {
    if (postDragInputProxyWindow !== inputProxyWindow || inputProxyWindow.isDestroyed()) {
      return;
    }
    postDragInputProxyReady = true;
    applyPostDragInputProxyRegions();
  });
  inputProxyWindow.on('closed', () => {
    if (postDragInputProxyWindow !== inputProxyWindow) {
      return;
    }
    clearPostDragInputProxyIdleDestroyTimer();
    postDragInputProxyWindow = null;
    postDragInputProxyReady = false;
    postDragInputProxyPointerActive = false;
    postDragInputProxyRegions = [];
    postDragInputProxyPendingRegions = null;
    postDragInputProxyShapeSignature = '';
  });
  inputProxyWindow.loadURL(
    'data:text/html;charset=utf-8,<html><head><meta charset="utf-8"></head><body></body></html>',
  ).catch((error) => {
    logWindowEvent(`main-window: failed to load post-drag input proxy ${error?.stack || error}`);
    if (postDragInputProxyWindow === inputProxyWindow) {
      hidePostDragInputProxy('load-failed', true);
    }
  });
  return inputProxyWindow;
}

function setPostDragInputProxyRegions(regions) {
  const nextRegions = normalizeInteractiveRegions(regions);
  if (isFullWindowInteractiveShape(nextRegions)) {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: ignored full-window input proxy region; pointer capture owns active drag');
    }
    return;
  }

  if (postDragInputProxyPointerActive || petDragNativeShapeActive) {
    postDragInputProxyPendingRegions = nextRegions;
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: deferred input proxy shape during captured pointer count=${nextRegions.length}`,
      );
    }
    return;
  }

  postDragInputProxyPendingRegions = null;
  postDragInputProxyRegions = nextRegions;
  if (postDragInputProxyRegions.length === 0) {
    hidePostDragInputProxy('empty-regions');
    return;
  }

  ensurePostDragInputProxyWindow();
  applyPostDragInputProxyRegions();
}

function flushPostDragInputProxyPendingRegions(reason) {
  if (
    postDragInputProxyPointerActive
    || petDragNativeShapeActive
    || !postDragInputProxyPendingRegions
  ) {
    return;
  }

  const nextRegions = postDragInputProxyPendingRegions;
  postDragInputProxyPendingRegions = null;
  postDragInputProxyRegions = nextRegions;
  if (nextRegions.length === 0) {
    hidePostDragInputProxy(`${reason}-empty`);
    return;
  }

  applyPostDragInputProxyRegions();
  if (pointerDiagnosticsEnabled) {
    logWindowEvent(
      `main-window: flushed input proxy shape reason=${reason} count=${nextRegions.length}`,
    );
  }
}

function requestPostDragInputProxyRegions(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('desktop-pet:refresh-native-interactive-regions', {
    inputProxy: true,
    reason,
  });
}

function forwardPostDragInputProxyEvent(sender, inputEvent) {
  if (
    !postDragInputProxyWindow
    || postDragInputProxyWindow.isDestroyed()
    || sender !== postDragInputProxyWindow.webContents
    || !mainWindow
    || mainWindow.isDestroyed()
    || !inputEvent
    || typeof inputEvent !== 'object'
  ) {
    return;
  }

  const type = String(inputEvent.type || '');
  const supportedTypes = new Set(['mouseDown', 'mouseMove', 'mouseUp', 'mouseWheel']);
  if (!supportedTypes.has(type)) {
    return;
  }

  const bounds = mainWindow.getContentBounds();
  const x = Math.max(0, Math.min(bounds.width - 1, Math.round(Number(inputEvent.x || 0))));
  const y = Math.max(0, Math.min(bounds.height - 1, Math.round(Number(inputEvent.y || 0))));
  const forwardedEvent = {
    type,
    x,
    y,
  };
  if (type === 'mouseWheel') {
    forwardedEvent.deltaX = Number(inputEvent.deltaX || 0);
    // Chromium's DOM wheel event and Electron's synthetic mouseWheel input
    // use opposite vertical sign conventions. Normalize back to DOM semantics
    // before the main renderer's shared scale controller handles the event.
    forwardedEvent.deltaY = -Number(inputEvent.deltaY || 0);
  } else {
    forwardedEvent.button = ['left', 'middle', 'right'].includes(inputEvent.button)
      ? inputEvent.button
      : 'left';
    forwardedEvent.clickCount = Math.max(1, Math.min(3, Math.round(Number(inputEvent.clickCount || 1))));
    forwardedEvent.movementX = Number(inputEvent.movementX || 0);
    forwardedEvent.movementY = Number(inputEvent.movementY || 0);
  }

  if (type === 'mouseDown') {
    postDragInputProxyPointerActive = true;
  }
  mainWindow.webContents.sendInputEvent(forwardedEvent);
  if (type === 'mouseUp') {
    postDragInputProxyPointerActive = false;
    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      flushPostDragInputProxyPendingRegions('pointer-finished');
      requestPostDragInputProxyRegions('input-proxy-pointer-finished');
      return;
    }
    if (!isPetDragFullWindowShapeRetained()) {
      hidePostDragInputProxy('pointer-finished-after-lease');
    }
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

  return isFullWindowInteractiveRegion(regions[0]);
}

function isFullWindowInteractiveRegion(region) {
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

  hidePostDragInputProxy('post-drag-shape-hold-expired');

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
    && !USE_SEPARATE_RENDER_AND_INPUT_WINDOWS
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

  if (isAgentDesktopExecutionActive) {
    return;
  }

  if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
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
    isPointerPassthroughForwarding = false;
    return;
  }

  if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
    const nextIgnore = true;
    const nextForward = false;
    if (
      isPointerPassthrough === nextIgnore
      && isPointerPassthroughForwarding === nextForward
    ) {
      return;
    }

    isPointerPassthrough = nextIgnore;
    isPointerPassthroughForwarding = nextForward;
    mainWindow.setIgnoreMouseEvents(nextIgnore, { forward: nextForward });
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: permanent render passthrough ignore=${nextIgnore} `
        + `forward=${nextForward} inputProxy=${postDragInputProxyRegions.length}`,
      );
    }
    return;
  }

  // Legacy path for non-Windows platforms: the main BrowserWindow owns both
  // the rendered pixels and the native interactive shape.
  const hasFullWindowShape = isFullWindowInteractiveShape(interactiveWindowShapeRegions);
  // Keep the transparent full-window drag layer click-through for the whole
  // post-drag shape lease. Switching it back to interactive on pointerup while
  // the full-window shape is still active can briefly blank composed video.
  const hasPetDragPassthrough = isPetDragFullWindowShapeRetained();
  const nextIgnore = isAgentDesktopExecutionActive
    ? !hasInteractiveWindowShape()
    : hasPetDragPassthrough
      ? true
      : Boolean(requestedPointerPassthrough) && !hasFullWindowShape;
  const nextForward = hasPetDragPassthrough;
  if (
    isPointerPassthrough === nextIgnore
    && isPointerPassthroughForwarding === nextForward
  ) {
    return;
  }

  isPointerPassthrough = nextIgnore;
  isPointerPassthroughForwarding = nextForward;
  mainWindow.setIgnoreMouseEvents(nextIgnore, { forward: nextForward });
  if (pointerDiagnosticsEnabled) {
    logWindowEvent(
      `main-window: pointer passthrough ignore=${nextIgnore} `
      + `forward=${nextForward} requested=${requestedPointerPassthrough} `
      + `shapeActive=${hasInteractiveWindowShape()} petDragPassthrough=${hasPetDragPassthrough}`,
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
    && !USE_SEPARATE_RENDER_AND_INPUT_WINDOWS
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
    || !PREWARM_MAIN_INTERACTIVE_LAYER
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

  // Chat/settings are normal user windows: other applications must be able to
  // cover them and receive input. Their initial focus is handled by show/focus.
  if (win === chatWindow || win === settingsWindow) {
    if (win.isAlwaysOnTop()) win.setAlwaysOnTop(false);
    topmostStateByWindow.delete(win);
    return;
  }

  if (DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS && win === settingsWindow) {
    if (win.isAlwaysOnTop()) {
      win.setAlwaysOnTop(false);
    }
    topmostStateByWindow.delete(win);
    return;
  }

  if (
    isAgentDesktopExecutionActive
    && (win === chatWindow || win === settingsWindow)
  ) {
    if (win.isAlwaysOnTop()) {
      win.setAlwaysOnTop(false);
    }
    topmostStateByWindow.delete(win);
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

function setAgentDesktopExecutionActive(active) {
  const nextActive = Boolean(active);
  if (isAgentDesktopExecutionActive === nextActive) {
    return;
  }

  isAgentDesktopExecutionActive = nextActive;
  const shellWindows = [mainWindow, chatWindow, settingsWindow]
    .filter((win) => win && !win.isDestroyed());

  shellWindows.forEach((win) => {
    if (nextActive && win !== mainWindow) {
      win.setAlwaysOnTop(false);
      topmostStateByWindow.delete(win);
    }
  });

  if (!nextActive) {
    applyInteractiveWindowShape();
  }

  applyPointerPassthroughState();

  if (!nextActive) {
    keepWindowOnTop(mainWindow, MAIN_TOPMOST_RELATIVE_LEVEL);
    keepAuxWindowsOnTop();
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
  keepWindowOnTop(postDragInputProxyWindow, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, {
    bringToFront: true,
  });
  keepAuxWindowsOnTop();
  keepPersistentAreaBorderOnTop();
  keepAreaPickerOnTop();
}

function scheduleWindowStackOnTop() {
  scheduleKeepWindowOnTop(mainWindow, MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  scheduleKeepWindowOnTop(
    postDragInputProxyWindow,
    POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
    { bringToFront: true },
  );
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
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2);
  const y = Math.round(display.workArea.y + (display.workArea.height - height) / 2);

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

  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);

  return {
    x,
    y,
    width,
    height,
  };
}

function syncInteractiveChatWindowBounds() {
  const isInteractive = isInteractiveDialogueChatActive();
  if (!chatWindow || chatWindow.isDestroyed()) {
    wasInteractiveDialogueChatActive = isInteractive;
    return;
  }

  if (isCurrentWindowCompactMinimumSizeActive(chatWindow)) {
    wasInteractiveDialogueChatActive = isInteractive;
    return;
  }

  applyChatWindowSizeConstraints(chatWindow);
  const currentBounds = chatWindow.getBounds();
  const limits = getResolvedChatPanelWindowLimits();
  const isBelowNormalMinimum = !isInteractive && (
    currentBounds.width < limits.minWidth || currentBounds.height < limits.minHeight
  );
  if ((wasInteractiveDialogueChatActive && !isInteractive) || isBelowNormalMinimum) {
    chatWindow.setBounds(getResolvedChatPanelWindowBounds(), false);
  }
  wasInteractiveDialogueChatActive = isInteractive;
  if (!isInteractive) {
    return;
  }

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
    frame: false,
    transparent: true,
    hasShadow: false,
    thickFrame: false,
    // Resizing is implemented by StandaloneWindowResizeHandles + setBounds.
    // Leaving native resize enabled makes Windows repaint a competing edge
    // during drag, which causes the right border to flicker.
    resizable: false,
    show: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    focusable: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
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
  // Windows may draw a separate DWM border around frameless windows, which
  // makes the right and bottom edges darker than the CSS border on the other
  // two sides. Let the panel's own border be the single visible frame.
  void disableDwmSystemBorderForWindow(nextSettingsWindow).then((result) => {
    if (!result.applied) {
      logWindowEvent(
        `settings-window: DWM border disable skipped reason=${result.reason}`,
      );
    }
  });
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
    // Reapply after the native window is visible. Windows can create or
    // repaint the DWM edge during the show transition.
    void disableDwmSystemBorderForWindow(nextSettingsWindow);
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
    if (HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS && !isQuitting) {
      showMainWindowWhenReady('graph-diagnostics-settings-hidden');
    }
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
  if (HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
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
    ...(live2DDragProbeEnabled ? { live2dDragProbe: '1' } : {}),
  };
  if (live2DDragProbeEnabled) {
    const label = !win || win.isDestroyed()
      ? 'destroyed-window'
      : (win.getTitle() || 'untitled-window');
    logWindowEvent(`loadRenderer: live2d drag probe enabled for ${label} query=${JSON.stringify(nextQuery)}`);
  }
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

function recreateMainWindow(reason) {
  if (isQuitting) {
    return false;
  }

  logWindowEvent(`main-window: recreate reason=${reason}`);
  hidePostDragInputProxy('main-renderer-recovery', true);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  mainWindow = null;
  createWindow();
  return true;
}

function recoverMainWindowRenderer(webContents, details = {}) {
  if (
    isQuitting
    || !mainWindow
    || mainWindow.isDestroyed()
    || mainWindow.webContents !== webContents
    || mainWindowRendererRecoveryInProgress
  ) {
    return false;
  }

  const reason = String(details?.reason || 'unknown');
  if (reason === 'clean-exit') {
    return false;
  }

  if (webContents.isDestroyed?.()) {
    return recreateMainWindow(`${reason}-web-contents-destroyed`);
  }

  mainWindowRendererRecoveryInProgress = true;
  logWindowEvent(`main-window: renderer recovery begin reason=${reason}`);
  hidePostDragInputProxy('main-renderer-recovery', true);
  mainWindow.hide();
  mainWindowRendererReadyToShow = false;
  mainWindowCanShow = true;
  scheduleMainWindowRendererReadyFallback();

  let recoveryFinished = false;
  const finishRecovery = (result) => {
    if (recoveryFinished) {
      return;
    }
    recoveryFinished = true;
    mainWindowRendererRecoveryInProgress = false;
    logWindowEvent(`main-window: renderer recovery ${result} reason=${reason}`);
  };
  mainWindow.webContents.once('did-finish-load', () => finishRecovery('loaded'));
  mainWindow.webContents.once('did-fail-load', () => finishRecovery('load-failed'));

  try {
    mainWindow.webContents.reloadIgnoringCache();
    return true;
  } catch (error) {
    finishRecovery('reload-failed');
    logWindowEvent(`main-window: renderer recovery error=${error?.stack || error}`);
    return recreateMainWindow(`${reason}-reload-failed`);
  }
}

async function showOrRecoverMainWindow(reason = 'manual') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return 'created';
  }

  const activeWebContents = mainWindow.webContents;
  if (!activeWebContents || activeWebContents.isDestroyed()) {
    recreateMainWindow(`${reason}-web-contents-unavailable`);
    return 'recreated';
  }

  if (mainWindowRendererRecoveryInProgress || activeWebContents.isLoadingMainFrame?.()) {
    showMainWindowWhenReady(`${reason}-loading`);
    return 'loading';
  }

  let healthTimeout = null;
  try {
    await Promise.race([
      activeWebContents.executeJavaScript('document.readyState', true),
      new Promise((_, reject) => {
        healthTimeout = setTimeout(
          () => reject(new Error('main renderer health check timed out')),
          MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
        );
      }),
    ]);
    showMainWindow();
    return 'shown';
  } catch (error) {
    logWindowEvent(`main-window: renderer health check failed reason=${reason} error=${error?.message || error}`);
    recoverMainWindowRenderer(activeWebContents, { reason: `${reason}-unresponsive` });
    return 'recovering';
  } finally {
    if (healthTimeout) {
      clearTimeout(healthTimeout);
    }
  }
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
    mainWindowRendererStartupRecoveryCount = 0;
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
    if (
      !mainWindowRendererReadyToShow
      && !mainWindowRendererRecoveryInProgress
      && mainWindow
      && !mainWindow.isDestroyed()
      && mainWindowRendererStartupRecoveryCount < MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT
    ) {
      mainWindowRendererStartupRecoveryCount += 1;
      logWindowEvent(
        `main-window: renderer ready timeout recovery=${mainWindowRendererStartupRecoveryCount}`,
      );
      recoverMainWindowRenderer(mainWindow.webContents, { reason: 'renderer-ready-timeout' });
      return;
    }

    markMainWindowReadyToShow('renderer-ready-timeout-exhausted');
  }, MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS);

  if (typeof mainWindowRendererReadyFallbackTimer.unref === 'function') {
    mainWindowRendererReadyFallbackTimer.unref();
  }
}

function hideMainWindow() {
  if (!mainWindow) {
    return;
  }

  hidePostDragInputProxy('main-window-hidden', true);
  mainWindow.hide();
}

function setWindowPointerPassthrough(ignore) {
  requestedPointerPassthrough = Boolean(ignore);
  if (pointerDiagnosticsEnabled && mainWindow && !mainWindow.isDestroyed()) {
    logWindowEvent(
      `DRAG-TRACE-V2 pointer-request requested=${requestedPointerPassthrough} `
      + `applied=${isPointerPassthrough} shapeApplied=${interactiveWindowShapeApplied} `
      + `shapeRegions=${interactiveWindowShapeRegions.length} `
      + `session=${petDragNativeShapeActive} retained=${isPetDragFullWindowShapeRetained()}`,
    );
  }
  applyPointerPassthroughState();
}

function setInteractiveRegions(regions, options = null) {
  const nextInteractiveWindowShapeRegions = normalizeInteractiveRegions(regions);
  const nextInteractiveWindowShapeSignature = createInteractiveRegionsSignature(nextInteractiveWindowShapeRegions);
  const interactiveRegionSource = normalizeInteractiveRegionSource(options);

  if (interactiveRegionSource === 'render-input-proxy') {
    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      setPostDragInputProxyRegions(nextInteractiveWindowShapeRegions);
    }
    return;
  }

  if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
    if (
      interactiveRegionSource === 'pet-drag'
      && isFullWindowInteractiveShape(nextInteractiveWindowShapeRegions)
    ) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: kept local input proxy regions during active drag');
      }
      return;
    }

    pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
    pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
    pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
    interactiveWindowShapeRegions = nextInteractiveWindowShapeRegions;
    interactiveWindowShapeSignature = nextInteractiveWindowShapeSignature;
    if (interactiveRegionSource === 'pet-drag') {
      setPostDragInputProxyRegions(nextInteractiveWindowShapeRegions);
    }
    applyPointerPassthroughState();
    return;
  }

  if (interactiveRegionSource === 'post-drag-input-proxy') {
    setPostDragInputProxyRegions(nextInteractiveWindowShapeRegions);
    return;
  }
  const nextIsFullWindowShape = isFullWindowInteractiveShape(nextInteractiveWindowShapeRegions);
  const nextIsPetDragFullWindowShape = interactiveRegionSource === 'pet-drag' && nextIsFullWindowShape;
  const shouldRetainPetDragFullWindowShape = !nextIsPetDragFullWindowShape
    && !nextIsFullWindowShape
    && isFullWindowInteractiveShape(interactiveWindowShapeRegions)
    && isPetDragFullWindowShapeRetained();
  const shouldHoldCurrentPetDragFullWindowShape = !nextIsPetDragFullWindowShape
    && !nextIsFullWindowShape
    && Date.now() < petDragFullWindowShapeHoldUntil
    && isFullWindowInteractiveShape(interactiveWindowShapeRegions);

  if (pointerDiagnosticsEnabled) {
    logWindowEvent(
      `DRAG-TRACE-V2 regions-request source=${interactiveRegionSource || 'unknown'} `
      + `nextCount=${nextInteractiveWindowShapeRegions.length} nextFull=${nextIsFullWindowShape} `
      + `currentCount=${interactiveWindowShapeRegions.length} `
      + `currentApplied=${interactiveWindowShapeApplied} `
      + `session=${petDragNativeShapeActive} retained=${isPetDragFullWindowShapeRetained()} `
      + `defer=${shouldRetainPetDragFullWindowShape || shouldHoldCurrentPetDragFullWindowShape}`,
    );
  }

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
  if (!isPetDragFullWindowShapeRetained()) {
    hidePostDragInputProxy('main-shape-restored');
  }
}

function setPetDragNativeShapeActive(active) {
  const nextActive = Boolean(active);

  if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
    if (petDragNativeShapeActive === nextActive) {
      return;
    }

    petDragNativeShapeActive = nextActive;
    if (nextActive) {
      ensurePostDragInputProxyWindow();
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: input proxy drag capture started');
      }
    } else {
      flushPostDragInputProxyPendingRegions('drag-session-ended');
      requestPostDragInputProxyRegions('input-proxy-drag-ended');
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: input proxy drag capture ended');
      }
    }
    applyPointerPassthroughState();
    return;
  }

  if (pointerDiagnosticsEnabled) {
    logWindowEvent(
      `DRAG-TRACE-V2 session-request next=${nextActive} current=${petDragNativeShapeActive} `
      + `shapeApplied=${interactiveWindowShapeApplied} `
      + `shapeCount=${interactiveWindowShapeRegions.length} `
      + `retained=${isPetDragFullWindowShapeRetained()}`,
    );
  }
  if (petDragNativeShapeActive === nextActive) {
    if (nextActive) {
      ensurePetDragFullWindowInteractiveShape('active-session-refresh');
    }
    return;
  }

  petDragNativeShapeActive = nextActive;
  if (nextActive) {
    ensurePostDragInputProxyWindow();
    pendingInteractiveWindowShapeRegionsAfterPetDragHold = null;
    pendingInteractiveWindowShapeSignatureAfterPetDragHold = '';
    pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = 0;
    petDragFullWindowShapeEndedAt = 0;
    petDragFullWindowShapeHoldUntil = 0;
    clearPetDragFullWindowShapeHoldTimer();
    ensurePetDragFullWindowInteractiveShape('active-session-start');
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: pet drag native shape session started with stable full-window shape');
    }
    return;
  }

  petDragFullWindowShapeEndedAt = Date.now();
  if (!isFullWindowInteractiveShape(interactiveWindowShapeRegions)) {
    petDragFullWindowShapeHoldUntil = 0;
    clearPetDragFullWindowShapeHoldTimer();
    applyPointerPassthroughState();
    scheduleNativeShapeRefreshAfterPetDragHold('bounded-pet-drag-session-ended');
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: bounded pet drag native shape session ended');
    }
    return;
  }

  petDragFullWindowShapeHoldUntil = Date.now() + PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS;
  ensurePetDragFullWindowInteractiveShape('active-session-end-hold');
  schedulePetDragFullWindowShapeHoldExpiry();
  requestPostDragInputProxyRegions('pet-drag-session-ended');
  setTimeout(() => {
    if (!petDragNativeShapeActive && isPetDragFullWindowShapeRetained()) {
      requestPostDragInputProxyRegions('pet-drag-session-ended-post-commit');
    }
  }, 32);
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

function broadcastRuntimeWorldPresentationIntent(intent, excludedWebContentsId = null) {
  if (!intent || typeof intent !== 'object') {
    return;
  }

  [mainWindow, settingsWindow, chatWindow]
    .filter((win) => win && !win.isDestroyed())
    .forEach((win) => {
      if (win.webContents.id === excludedWebContentsId) {
        return;
      }

      win.webContents.send('desktop-pet:runtime-world-presentation-intent', intent);
    });
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
    skipTaskbar: false,
    alwaysOnTop: false,
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    void showOrRecoverMainWindow('create-existing-window');
    return;
  }

  mainWindowCanShow = false;
  mainWindowRendererRecoveryInProgress = false;
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
    // The desktop pet uses pointer hit regions only; chat/settings inputs live
    // in their own focusable windows. Prevent the first pet click from
    // activating the full transparent overlay and rebuilding its DWM surface.
    focusable: false,
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
  if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
    ensurePostDragInputProxyWindow();
    mainWindow.on('move', () => applyPostDragInputProxyRegions());
    mainWindow.on('resize', () => applyPostDragInputProxyRegions());
  }
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

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || mainWindowRendererRecoveryInProgress) {
        return;
      }

      logWindowEvent(
        `main-window: initial load failed code=${errorCode} url=${validatedURL} error=${errorDescription}`,
      );
      recoverMainWindowRenderer(mainWindow.webContents, { reason: `initial-load-failed-${errorCode}` });
    },
  );

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    hideMainWindow();
  });
  mainWindow.on('show', () => {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(`main-window: show focused=${mainWindow?.isFocused?.() ?? false}`);
    }
    applyPostDragInputProxyRegions();
    scheduleWindowStackOnTop();
  });
  mainWindow.on('restore', () => scheduleWindowStackOnTop());
  mainWindow.on('focus', () => {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: focus');
    }
  });
  mainWindow.on('blur', () => {
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: blur');
    }
    scheduleWindowStackOnTop();
  });
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
    clearPostDragInputProxyIdleDestroyTimer();
    hidePostDragInputProxy('window-manager-dispose', true);
    if (postDragInputProxyWindow && !postDragInputProxyWindow.isDestroyed()) {
      postDragInputProxyWindow.destroy();
    }
    if (mainWindowRendererReadyFallbackTimer) {
      clearTimeout(mainWindowRendererReadyFallbackTimer);
      mainWindowRendererReadyFallbackTimer = null;
    }
    if (settingsWindowDisplayRefreshTimer) {
      clearTimeout(settingsWindowDisplayRefreshTimer);
      settingsWindowDisplayRefreshTimer = null;
    }
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
    }
    tray = null;
  }

  return {
    broadcastSharedState,
    broadcastRuntimeWorldPresentationIntent,
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
    recoverMainWindowRenderer,
    resizeWindowForSettings,
    scheduleKeepWindowOnTop,
    setAgentDesktopExecutionActive,
    scheduleSettingsWindowContentRefresh,
    scheduleWindowStackOnTop,
    setInteractiveRegions,
    setPetDragNativeShapeActive,
    forwardPostDragInputProxyEvent,
    setPointerPassthrough: setWindowPointerPassthrough,
    setQuitting,
    setSettingsOpen: (isOpen) => {
      isShellSettingsOpen = Boolean(isOpen);
      resizeWindowForSettings(Boolean(isOpen));
    },
    setSharedState,
    showOrRecoverMainWindow,
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
