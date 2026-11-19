const os = require('os');

// Sending incidents to the developer (2026-11-18, user's idea): only after the user said yes,
// only the cleaned fields (no log lines, no paths, no chat), new occurrences since the last send,
// a few at a time. The service keeps them private (admin key to read) and answers which ones
// were fixed in which version, so Settings → 健康 can say "更新到 vX 就好了".

const API_URL = process.env.DESKTOP_PET_INCIDENT_API_URL || 'https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev';
const BATCH = 20;
const TIMEOUT_MS = 15_000;

/** What leaves the computer for one incident: no context lines, frames without the user's paths. */
function uploadShape(item, delta) {
  return {
    count: delta,
    fingerprint: item.fingerprint,
    firstAt: item.firstAt,
    frames: item.frames.map(({ file, fn, line }) => ({ file, fn, line })),
    kind: item.kind,
    lastAt: item.lastAt,
    source: item.source,
    title: item.title,
    versions: item.versions.slice(-5),
  };
}

function createIncidentUploader({ store, getAppVersion, fetchImpl = globalThis.fetch, apiUrl = API_URL, log }) {
  let running = null;

  async function post(pathname, body) {
    const response = await fetchImpl(`${apiUrl}${pathname}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function sendPending() {
    const pending = store.pendingUpload().slice(0, BATCH);
    if (!pending.length) return 0;
    const items = pending.map((item) => uploadShape(item, item.count - item.uploadedCount));
    await post('/incidents', { appVersion: getAppVersion(), installId: store.installId(), items, os: `${process.platform} ${os.release()}` });
    store.markUploaded(Object.fromEntries(pending.map((item) => [item.fingerprint, item.count])));
    return pending.length;
  }

  async function refreshFixed() {
    const fingerprints = store.list().map((item) => item.fingerprint);
    if (!fingerprints.length) return;
    const result = await post('/incidents/status', { fingerprints });
    if (result && typeof result.fixed === 'object') store.setFixed(result.fixed);
  }

  /** One round: send what is new, then ask which are fixed. Does nothing without consent. */
  function run() {
    if (store.consent() !== 'yes') return Promise.resolve({ ok: false, reason: 'no-consent' });
    if (running) return running;
    running = (async () => {
      try {
        const sent = await sendPending();
        await refreshFixed();
        return { ok: true, sent };
      } catch (error) {
        log?.('incident upload failed', { error: error?.message });
        return { error: error?.message || String(error), ok: false };
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return { run };
}

module.exports = { createIncidentUploader, uploadShape };
