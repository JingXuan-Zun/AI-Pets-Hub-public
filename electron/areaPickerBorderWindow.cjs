function getPersistentAreaBorderHtml() {
  return encodeURIComponent(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --border-width: 2px;
        --border-color: rgba(52, 211, 153, 0.98);
      }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
      body {
        box-sizing: border-box;
        border: var(--border-width) solid var(--border-color);
        background: transparent;
      }
    </style>
  </head>
  <body></body>
</html>`);
}

function getPersistentAreaBorderWindowOptions() {
  return {
    x: -32000,
    y: -32000,
    width: 16,
    height: 16,
    frame: false,
    thickFrame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    roundedCorners: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    title: 'AI Desktop Pet Area Border',
    webPreferences: {
      backgroundThrottling: false,
      devTools: false,
    },
  };
}

function createPersistentAreaBorderWindow({ BrowserWindow, windowManager, refreshPersistentAreaBorder, topmostRelativeLevel, topmostLevel }) {
  const borderHtml = getPersistentAreaBorderHtml();
  const win = new BrowserWindow(getPersistentAreaBorderWindowOptions());
  win.setIgnoreMouseEvents(true, { forward: true });
  windowManager.keepWindowOnTop(win, topmostRelativeLevel, { topmostLevel });
  win.webContents.once('did-finish-load', () => {
    refreshPersistentAreaBorder();
  });
  win.loadURL(`data:text/html;charset=utf-8,${borderHtml}`).catch(() => {});
  return win;
}

module.exports = { createPersistentAreaBorderWindow };
