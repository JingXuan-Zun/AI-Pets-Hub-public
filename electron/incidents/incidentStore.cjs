const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { redactLogLine } = require('../diagnosticsExport.cjs');
const { shapeIncident } = require('./incidentRecord.cjs');

// The incidents this computer has seen, in userData/incidents.json. Repeats of a problem only
// raise its count; the newest few log lines from just before it are kept (cleaned) to help
// understand it. Whether incidents may be sent to the developer is the user's choice, asked
// once ("consent": unasked / yes / no) and changeable in Settings → 健康.

const FILE = 'incidents.json';
const MAX_ITEMS = 100;
const MAX_CONTEXT_LINES = 20;
const WRITE_DELAY_MS = 500;

function emptyState() {
  return { consent: 'unasked', installId: crypto.randomUUID(), items: [] };
}

function createIncidentStore({ getUserDataPath, getAppVersion, getRecentLogs = () => [], now = () => Date.now(), redactOptions, onChange }) {
  let state = null;
  let writeTimer = null;
  const file = () => path.join(getUserDataPath(), FILE);

  function load() {
    if (state) return state;
    try {
      const saved = JSON.parse(fs.readFileSync(file(), 'utf8'));
      state = { ...emptyState(), ...saved, items: Array.isArray(saved?.items) ? saved.items : [] };
    } catch {
      state = emptyState();
    }
    return state;
  }

  function writeNow() {
    writeTimer = null;
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true });
      fs.writeFileSync(`${file()}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      fs.renameSync(`${file()}.tmp`, file());
    } catch {
      // A failed save must not raise another incident.
    }
  }

  function save() {
    if (!writeTimer) writeTimer = setTimeout(writeNow, WRITE_DELAY_MS);
    onChange?.();
  }

  /** A raw error from incidentFromLogEntry → counted under its fingerprint. Returns the item. */
  function record(raw) {
    const current = load();
    const shaped = shapeIncident(raw, redactOptions);
    const version = getAppVersion();
    const at = now();
    const context = getRecentLogs().slice(0, MAX_CONTEXT_LINES).map(redactLogLine).reverse();
    let item = current.items.find((entry) => entry.fingerprint === shaped.fingerprint);
    if (item) {
      item.count += 1;
      item.lastAt = at;
      item.frames = shaped.frames;
      item.context = context;
      if (!item.versions.includes(version)) item.versions.push(version);
    } else {
      item = { ...shaped, context, count: 1, firstAt: at, fixedIn: null, lastAt: at, uploadedCount: 0, versions: [version] };
      current.items.push(item);
      if (current.items.length > MAX_ITEMS) current.items = current.items.sort((a, b) => b.lastAt - a.lastAt).slice(0, MAX_ITEMS);
    }
    save();
    return item;
  }

  /** Newest first. */
  function list() {
    return [...load().items].sort((a, b) => b.lastAt - a.lastAt);
  }

  function get(fingerprint) {
    return load().items.find((item) => item.fingerprint === fingerprint || item.fingerprint.startsWith(String(fingerprint))) ?? null;
  }

  function setConsent(value) {
    load().consent = value === 'yes' ? 'yes' : 'no';
    save();
  }

  /** What the next upload would send: new occurrences since the last one. */
  function pendingUpload() {
    return load().items.filter((item) => item.count > item.uploadedCount);
  }

  function markUploaded(counts) {
    for (const item of load().items) if (counts[item.fingerprint] !== undefined) item.uploadedCount = counts[item.fingerprint];
    save();
  }

  function setFixed(fixed) {
    let changed = false;
    for (const item of load().items) {
      const version = fixed[item.fingerprint] ?? null;
      if (version !== item.fixedIn) { item.fixedIn = version; changed = true; }
    }
    if (changed) save();
  }

  function remove(fingerprint) {
    const current = load();
    current.items = current.items.filter((item) => item.fingerprint !== fingerprint);
    save();
  }

  return {
    consent: () => load().consent,
    flush: () => { if (writeTimer) { clearTimeout(writeTimer); writeNow(); } },
    get,
    installId: () => load().installId,
    list,
    markUploaded,
    pendingUpload,
    record,
    remove,
    setConsent,
    setFixed,
  };
}

module.exports = { createIncidentStore };
