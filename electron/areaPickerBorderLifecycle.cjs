const { createPersistentAreaBorderRules } = require('./areaPickerBorderRules.cjs');
const { createPersistentAreaBorderWindow } = require('./areaPickerBorderWindow.cjs');

function destroyPersistentAreaBorder(session) {
  const win = session.window;
  session.window = null;
  session.captureOptions = null;

  if (win && !win.isDestroyed()) {
    win.destroy();
  }
}

function hidePersistentAreaBorder(session) {
  session.captureOptions = null;
  if (session.window && !session.window.isDestroyed()) {
    session.window.hide();
  }
}

function ensurePersistentAreaBorderWindow(session) {
  if (session.window && !session.window.isDestroyed()) {
    return session.window;
  }

  destroyPersistentAreaBorder(session);
  session.window = session.createWindow();
  return session.window;
}

function updatePersistentAreaBorderThickness(win, thickness) {
  if (!win || win.isDestroyed() || win.webContents.isLoadingMainFrame()) {
    return;
  }

  const safeThickness = Math.max(1, Math.round(thickness));
  win.webContents.executeJavaScript(
    `document.documentElement.style.setProperty('--border-width', '${safeThickness}px');`,
    true,
  ).catch(() => {});
}

function showPersistentAreaBorder(session, captureOptions) {
  const rect = session.resolvePersistentAreaBorderRect(captureOptions);
  if (!rect) {
    hidePersistentAreaBorder(session);
    return;
  }

  const win = ensurePersistentAreaBorderWindow(session);
  session.captureOptions = captureOptions;
  const thickness = session.resolvePersistentAreaBorderThickness(rect);
  win.setBounds({
    x: rect.x,
    y: rect.y,
    width: Math.max(8, rect.width),
    height: Math.max(8, rect.height),
  }, false);
  updatePersistentAreaBorderThickness(win, thickness);
  if (!win.isVisible()) {
    win.showInactive();
  }
  session.windowManager.scheduleKeepWindowOnTop(win, session.topmostRelativeLevel, {
    topmostLevel: session.topmostLevel,
  });
}

function refreshPersistentAreaBorder(session) {
  if (session.captureOptions) {
    showPersistentAreaBorder(session, session.captureOptions);
  }
}

function syncPersistentAreaBorderFromSettingsAction(session, action) {
  if (!action || typeof action !== 'object') {
    return;
  }

  if (action.type === 'preview-capture-options' || action.type === 'start-screen-capture') {
    showPersistentAreaBorder(session, action.options);
    return;
  }

  if (action.type === 'stop-screen-capture') {
    hidePersistentAreaBorder(session);
  }
}

function createPersistentAreaBorderLifecycle({ captureService, screen, BrowserWindow, windowManager, topmostRelativeLevel, topmostLevel }) {
  const session = {
    window: null,
    captureOptions: null,
    windowManager,
    topmostRelativeLevel,
    topmostLevel,
    ...createPersistentAreaBorderRules({ captureService, screen }),
  };
  session.createWindow = () => createPersistentAreaBorderWindow({
    BrowserWindow,
    windowManager,
    refreshPersistentAreaBorder: () => refreshPersistentAreaBorder(session),
    topmostRelativeLevel,
    topmostLevel,
  });
  return {
    destroyPersistentAreaBorder: () => destroyPersistentAreaBorder(session),
    refreshPersistentAreaBorder: () => refreshPersistentAreaBorder(session),
    syncPersistentAreaBorderFromSettingsAction: (action) => syncPersistentAreaBorderFromSettingsAction(session, action),
    getPersistentAreaBorderWindow: () => session.window,
  };
}

module.exports = { createPersistentAreaBorderLifecycle };
