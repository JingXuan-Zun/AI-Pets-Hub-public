const { incidentFromLogEntry } = require('./incidentRecord.cjs');
const { createIncidentStore } = require('./incidentStore.cjs');
const { createIncidentUploader, uploadShape } = require('./incidentUpload.cjs');

// Incidents in the main process: every runtime-log entry passes through onLogEntry (errors in
// the main process and in the windows both end up in the runtime log), errors become
// incidents, Settings → 健康 lists them, and with the user's consent they are sent to the
// developer an hour at a time (and a minute after a new one).

const FIRST_UPLOAD_MS = 2 * 60_000;
const UPLOAD_EVERY_MS = 60 * 60_000;
const AFTER_NEW_MS = 60_000;
/** A new problem while the user has not decided about reporting: tell the pet window at most this often. */
const ASK_EVERY_MS = 30 * 60_000;

function createIncidentHub({ app, getRecentLogs, log, fetchImpl, apiUrl }) {
  const getAppVersion = () => global.__appUpdateBoot?.version ?? app.getVersion();
  const store = createIncidentStore({ getAppVersion, getRecentLogs, getUserDataPath: () => app.getPath('userData') });
  const uploader = createIncidentUploader({ apiUrl, fetchImpl, getAppVersion, log, store });
  let soonTimer = null;
  let started = false;
  let recording = false;
  let getMainWindow = () => null;
  let lastAskedAt = 0;

  // Her character brings it up in chat ("刚才软件出了点问题，要不要发给开发者？"): the pet
  // window turns this into something on her mind (src/incidents/useIncidentConcern.ts).
  const askAboutReporting = (item) => {
    if (store.consent() !== 'unasked' || item.count !== 1 || Date.now() - lastAskedAt < ASK_EVERY_MS) return;
    const window = getMainWindow();
    if (!window || window.isDestroyed?.()) return;
    lastAskedAt = Date.now();
    window.webContents.send('desktop-pet:incident-new', { fingerprint: item.fingerprint, source: item.source, title: item.title });
  };

  const uploadSoon = () => {
    if (!started || store.consent() !== 'yes' || soonTimer) return;
    soonTimer = setTimeout(() => { soonTimer = null; void uploader.run(); }, AFTER_NEW_MS);
  };

  /** Called for every runtime-log entry; must never throw or log (that would loop). */
  function onLogEntry(entry) {
    if (recording) return;
    recording = true;
    try {
      const raw = incidentFromLogEntry(entry);
      if (raw) {
        askAboutReporting(store.record(raw));
        uploadSoon();
      }
    } catch {
      // Recording a problem must not become one.
    } finally {
      recording = false;
    }
  }

  function snapshot() {
    return { consent: store.consent(), items: store.list() };
  }

  function registerIpc(ipcMain, options = {}) {
    if (typeof options.getMainWindow === 'function') getMainWindow = options.getMainWindow;
    ipcMain.handle('desktop-pet:incidents-list', () => snapshot());
    ipcMain.handle('desktop-pet:incidents-get', (_event, fingerprint) => store.get(String(fingerprint ?? '')));
    ipcMain.handle('desktop-pet:incidents-preview', () => store.pendingUpload().map((item) => uploadShape(item, item.count - item.uploadedCount)));
    ipcMain.handle('desktop-pet:incidents-set-consent', async (_event, value) => {
      store.setConsent(value);
      if (value === 'yes') await uploader.run();
      return snapshot();
    });
    ipcMain.handle('desktop-pet:incidents-remove', (_event, fingerprint) => { store.remove(String(fingerprint ?? '')); return snapshot(); });
    ipcMain.handle('desktop-pet:incidents-upload-now', async () => ({ ...(await uploader.run()), ...snapshot() }));
  }

  /** Uploads on a timer (only ever with consent); not in development runs unless asked. */
  function startUploads() {
    started = true;
    setTimeout(() => { void uploader.run(); }, FIRST_UPLOAD_MS);
    setInterval(() => { void uploader.run(); }, UPLOAD_EVERY_MS);
  }

  app.on?.('before-quit', () => store.flush());
  return { onLogEntry, registerIpc, startUploads, store, uploader };
}

module.exports = { createIncidentHub };
