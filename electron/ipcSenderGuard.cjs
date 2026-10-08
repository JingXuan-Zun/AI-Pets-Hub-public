const path = require('node:path');
const { fileURLToPath } = require('node:url');

const APP_INDEX_PATH = path.resolve(__dirname, '..', 'dist', 'index.html');
const DEV_ORIGIN = 'http://127.0.0.1:3000';

// Channels whose handlers verify the exact sender themselves (the post-drag input
// proxy is a preload-only data: page owned by windowManager).
const SELF_VERIFIED_CHANNELS = new Set(['desktop-pet:post-drag-input-proxy-event']);

function samePath(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function isTrustedAppUrl(rawUrl, app) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === 'file:') {
    try {
      return samePath(path.resolve(fileURLToPath(url)), APP_INDEX_PATH);
    } catch {
      return false;
    }
  }
  return !app.isPackaged && url.origin === DEV_ORIGIN && url.pathname === '/';
}

function isTrustedAppSender(event, app) {
  // Subframes and pages navigated away from the app bundle may not use the bridge.
  const frame = event.senderFrame;
  return Boolean(frame && frame === event.sender.mainFrame && isTrustedAppUrl(frame.url, app));
}

function createTrustedIpcMain({ ipcMain, app, log }) {
  function reject(channel, event) {
    log?.('rejected IPC from untrusted sender', { channel, url: event.senderFrame?.url ?? null });
  }
  function guard(channel, event) {
    if (SELF_VERIFIED_CHANNELS.has(channel) || isTrustedAppSender(event, app)) return true;
    reject(channel, event);
    return false;
  }

  return {
    handle(channel, handler) {
      return ipcMain.handle(channel, (event, ...args) => {
        if (!guard(channel, event)) throw new Error('IPC sender is not trusted.');
        return handler(event, ...args);
      });
    },
    handleOnce(channel, handler) {
      return ipcMain.handleOnce(channel, (event, ...args) => {
        if (!guard(channel, event)) throw new Error('IPC sender is not trusted.');
        return handler(event, ...args);
      });
    },
    on(channel, listener) {
      ipcMain.on(channel, (event, ...args) => {
        if (!guard(channel, event)) {
          event.returnValue = null;
          return;
        }
        listener(event, ...args);
      });
      return this;
    },
    removeHandler: (channel) => ipcMain.removeHandler(channel),
  };
}

// Keeps app windows on the bundled page: blocks navigation (including files or
// links dropped onto a window), webview attachment, and opens only web/mail links
// externally.
function installNavigationGuards({ app, shell, log }) {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (isTrustedAppUrl(url, app)) return;
      event.preventDefault();
      log?.('blocked navigation', { url });
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(shell, url, log);
      return { action: 'deny' };
    });
  });
}

const EXTERNAL_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeExternalUrl(rawUrl) {
  try {
    return EXTERNAL_URL_PROTOCOLS.has(new URL(rawUrl).protocol);
  } catch {
    return false;
  }
}

function openExternalSafely(shell, url, log) {
  if (!isSafeExternalUrl(url)) {
    log?.('blocked external URL with unsupported protocol', { url });
    return Promise.resolve(false);
  }
  return shell.openExternal(url).then(() => true);
}

module.exports = {
  createTrustedIpcMain,
  installNavigationGuards,
  isSafeExternalUrl,
  isTrustedAppSender,
  isTrustedAppUrl,
  openExternalSafely,
};
