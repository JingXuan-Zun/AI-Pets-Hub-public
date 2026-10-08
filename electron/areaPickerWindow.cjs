const path = require('path');

function getAreaPickerWindowOptions(virtualBounds) {
  return {
    x: virtualBounds.x,
    y: virtualBounds.y,
    width: virtualBounds.width,
    height: virtualBounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    roundedCorners: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    enableLargerThanScreen: true,
    show: false,
    title: 'AI Desktop Pet Area Picker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  };
}

function registerAreaPickerReadyEvents(nextAreaPickerWindow, { state, broadcastAreaPickerContext, showAreaPickerWindow }) {
  nextAreaPickerWindow.webContents.once('did-finish-load', () => {
    if (state.window !== nextAreaPickerWindow || nextAreaPickerWindow.isDestroyed()) {
      return;
    }

    state.rendererSignature = '';
    broadcastAreaPickerContext();
    if (state.resolver) {
      showAreaPickerWindow();
    }
  });

nextAreaPickerWindow.once('ready-to-show', () => {
    if (state.window !== nextAreaPickerWindow || nextAreaPickerWindow.isDestroyed()) {
      return;
    }

    if (state.resolver) {
      showAreaPickerWindow();
    }
  });
}

function registerAreaPickerLifecycleEvents(nextAreaPickerWindow, { state, isQuitting, resolveAreaPickerSelection, unregisterAreaPickerEscapeShortcut, windowManager, topmostRelativeLevel, topmostLevel }) {
  nextAreaPickerWindow.on('close', (event) => {
    if (isQuitting()) {
      return;
    }

    event.preventDefault();
    resolveAreaPickerSelection(null);
  });
nextAreaPickerWindow.on('show', () => windowManager.keepWindowOnTop(nextAreaPickerWindow, topmostRelativeLevel, {
    bringToFront: true,
    topmostLevel: topmostLevel,
  }));
nextAreaPickerWindow.on('closed', () => {
    if (state.window === nextAreaPickerWindow) {
      state.window = null;
    }
    state.rendererSignature = '';
    unregisterAreaPickerEscapeShortcut();

    if (state.resolver) {
      resolveAreaPickerSelection(null);
    }
  });
}

function ensureAreaPickerWindow(dependencies) {
  const { state, BrowserWindow, windowManager, syncAreaPickerWindowBounds, loadRenderer, topmostRelativeLevel, topmostLevel } = dependencies;
  if (state.window && !state.window.isDestroyed()) {
    syncAreaPickerWindowBounds();
    return state.window;
  }
  if (!state.context?.virtualBounds) return null;
  const { virtualBounds } = state.context;
  const nextAreaPickerWindow = new BrowserWindow(getAreaPickerWindowOptions(virtualBounds));
  state.window = nextAreaPickerWindow;
  windowManager.scheduleKeepWindowOnTop(nextAreaPickerWindow, topmostRelativeLevel, { topmostLevel });
  registerAreaPickerReadyEvents(nextAreaPickerWindow, dependencies);
  registerAreaPickerLifecycleEvents(nextAreaPickerWindow, dependencies);
  loadRenderer(nextAreaPickerWindow, { desktop: '1', panel: 'area-picker' });
  return nextAreaPickerWindow;
}

function createAreaPickerWindowController(dependencies) {
  return () => ensureAreaPickerWindow(dependencies);
}

module.exports = { createAreaPickerWindowController };
