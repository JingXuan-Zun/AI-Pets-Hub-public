function createWindowLoadLogging({ log }) {
function logWindowEvent(message) {
  if (typeof log === 'function') {
    log(message);
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

  return { logWindowEvent, attachLoadLogging };
}

module.exports = { createWindowLoadLogging };
