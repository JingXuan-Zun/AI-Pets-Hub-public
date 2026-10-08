const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  createTrustedIpcMain,
  installNavigationGuards,
  isSafeExternalUrl,
  isTrustedAppUrl,
} = require('../electron/ipcSenderGuard.cjs');

const appIndexUrl = pathToFileURL(path.resolve(__dirname, '..', 'dist', 'index.html'));
appIndexUrl.search = 'window=chat';
const packagedApp = { isPackaged: true };
const devApp = { isPackaged: false };

assert.equal(isTrustedAppUrl(appIndexUrl.toString(), packagedApp), true);
assert.equal(isTrustedAppUrl('http://127.0.0.1:3000/?window=chat', devApp), true);
assert.equal(isTrustedAppUrl('http://127.0.0.1:3000/?window=chat', packagedApp), false, 'dev server is untrusted when packaged');
assert.equal(isTrustedAppUrl('https://example.com/', devApp), false);
assert.equal(isTrustedAppUrl(pathToFileURL(path.resolve(__dirname, 'evil.html')).toString(), packagedApp), false);
assert.equal(isTrustedAppUrl('data:text/html,<p>x</p>', packagedApp), false);
assert.equal(isTrustedAppUrl('not a url', packagedApp), false);

function createFakeIpcMain() {
  const handlers = new Map();
  const listeners = new Map();
  return {
    handlers,
    listeners,
    handle: (channel, handler) => handlers.set(channel, handler),
    handleOnce: (channel, handler) => handlers.set(channel, handler),
    on: (channel, listener) => listeners.set(channel, listener),
    removeHandler: (channel) => handlers.delete(channel),
  };
}

function createEvent(url, { subframe = false } = {}) {
  const mainFrame = { url };
  return {
    returnValue: undefined,
    sender: { mainFrame },
    senderFrame: subframe ? { url } : mainFrame,
  };
}

const rejected = [];
const raw = createFakeIpcMain();
const trusted = createTrustedIpcMain({
  app: packagedApp,
  ipcMain: raw,
  log: (message, details) => rejected.push(details.channel),
});

let calls = 0;
trusted.handle('desktop-pet:run-controlled-command', () => {
  calls += 1;
  return 'ran';
});
const handler = raw.handlers.get('desktop-pet:run-controlled-command');
assert.equal(handler(createEvent(appIndexUrl.toString())), 'ran');
assert.throws(() => handler(createEvent('https://attacker.example/')), /not trusted/);
assert.throws(() => handler(createEvent(appIndexUrl.toString(), { subframe: true })), /not trusted/);
assert.throws(() => handler(createEvent(pathToFileURL('C:/Users/example/Downloads/drop.html').toString())), /not trusted/);
assert.equal(calls, 1, 'untrusted senders must not reach the handler');

let syncCalls = 0;
trusted.on('desktop-pet:load-persisted-config-sync', (event) => {
  syncCalls += 1;
  event.returnValue = { ok: true };
});
const syncListener = raw.listeners.get('desktop-pet:load-persisted-config-sync');
const untrustedSyncEvent = createEvent('data:text/html,x');
syncListener(untrustedSyncEvent);
assert.equal(untrustedSyncEvent.returnValue, null, 'rejected sendSync must still return so the sender does not hang');
assert.equal(syncCalls, 0);

let proxyCalls = 0;
trusted.on('desktop-pet:post-drag-input-proxy-event', () => {
  proxyCalls += 1;
});
raw.listeners.get('desktop-pet:post-drag-input-proxy-event')(createEvent('data:text/html,proxy'));
assert.equal(proxyCalls, 1, 'the self-verified proxy channel keeps working from its data: page');

assert.deepEqual(rejected, [
  'desktop-pet:run-controlled-command',
  'desktop-pet:run-controlled-command',
  'desktop-pet:run-controlled-command',
  'desktop-pet:load-persisted-config-sync',
]);

for (const url of ['https://example.com', 'http://example.com/a', 'mailto:a@example.com']) {
  assert.equal(isSafeExternalUrl(url), true, url);
}
for (const url of ['file:///C:/Windows/System32/calc.exe', 'ms-msdt:/id', 'search-ms://query=x', 'javascript:alert(1)', 'vbscript:x', '']) {
  assert.equal(isSafeExternalUrl(url), false, url);
}

const appListeners = new Map();
installNavigationGuards({
  app: { isPackaged: true, on: (name, listener) => appListeners.set(name, listener) },
  shell: { openExternal: async () => {} },
});
const contentsListeners = new Map();
let windowOpenHandler = null;
appListeners.get('web-contents-created')(null, {
  on: (name, listener) => contentsListeners.set(name, listener),
  setWindowOpenHandler: (value) => {
    windowOpenHandler = value;
  },
});
const navigate = (url) => {
  let prevented = false;
  contentsListeners.get('will-navigate')({ preventDefault: () => { prevented = true; } }, url);
  return prevented;
};
assert.equal(navigate(appIndexUrl.toString()), false, 'reloading the app page is allowed');
assert.equal(navigate(pathToFileURL('C:/Users/example/Downloads/drop.html').toString()), true, 'dropped files cannot replace the app page');
assert.equal(navigate('https://attacker.example/'), true);
assert.deepEqual(windowOpenHandler({ url: 'file:///C:/x.bat' }), { action: 'deny' });

console.log('ipc sender guard smoke passed');
