const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { unzipSync } = require('fflate');
const { APP_UPDATE_PUBLIC_KEY, APP_UPDATE_SOURCES } = require('./appUpdateKey.cjs');
const {
  checkVersionFolder,
  compareVersions,
  readState,
  shellFingerprint,
  updatesRoot,
  versionFolder,
  writeState,
} = require('./appUpdateShell.cjs');

// Hot updates: the list of versions (signed, so nobody on the way can slip other code in), and
// for a version made for this exe, its changed files — the rest is copied from the exe itself,
// every file checked against the signed list. The new version runs from the next launch on
// (electron/bootstrap.cjs), and comes back out by itself if it does not start.

const FETCH_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const MAX_ZIP_BYTES = 120 * 1024 * 1024;

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** The signed list: { payload: "<json>", signature: "<base64 ed25519>" } → its payload, or null. */
function verifyCatalog(raw, publicKey = APP_UPDATE_PUBLIC_KEY) {
  if (!raw || typeof raw.payload !== 'string' || typeof raw.signature !== 'string') return null;
  try {
    if (!crypto.verify(null, Buffer.from(raw.payload, 'utf8'), publicKey, Buffer.from(raw.signature, 'base64'))) return null;
    const payload = JSON.parse(raw.payload);
    return payload && Array.isArray(payload.versions) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Every version, newest first, with what can be done with it on this install — forward or back:
 * someone who finds a new version worse can go back to an earlier one.
 */
function describeVersions(versions, { bad = [], builtInVersion, current, next, shell }) {
  const listed = versions.filter((entry) => entry && typeof entry.version === 'string');
  // The exe's own version is always there to go back to, listed or not.
  const all = listed.some((entry) => entry.version === builtInVersion) ? listed : [...listed, { kind: 'full', version: builtInVersion }];
  return all
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((entry) => {
      const base = { kind: entry.kind === 'full' ? 'full' : 'hot', notes: String(entry.notes ?? ''), page: entry.page ?? '', publishedAt: entry.publishedAt ?? '', size: entry.zip?.size ?? 0, version: entry.version };
      if (entry.version === current) return { ...base, action: 'current' };
      if (entry.version === next) return { ...base, action: 'pending' };
      if (entry.version === builtInVersion) return { ...base, action: 'builtin' };
      if (base.kind === 'full') return { ...base, action: 'full' };
      if (bad.includes(entry.version)) return { ...base, action: 'failed' };
      // Made for another exe (or another Electron / dependencies): only that full installer fits.
      if (entry.base !== builtInVersion || entry.shell !== shell || !entry.zip) return { ...base, action: 'needs-full' };
      return { ...base, action: 'download' };
    });
}

function createAppUpdateService({ app, log, fetchImpl = globalThis.fetch, sources = APP_UPDATE_SOURCES, publicKey = APP_UPDATE_PUBLIC_KEY, electronVersion = process.versions.electron }) {
  const boot = global.__appUpdateBoot ?? { builtIn: true, version: app.getVersion() };
  const appPath = app.getAppPath();
  const builtInPackage = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'));
  const shell = shellFingerprint(builtInPackage, electronVersion);
  const root = updatesRoot(app.getPath('userData'));
  let catalog = null;
  let checkedAt = 0;
  let downloading = null;
  let lastError = '';

  /** The version the next launch runs. */
  const nextLaunch = (state) => state.pending ?? state.active ?? builtInPackage.version;
  const context = () => {
    const state = readState(root);
    return { bad: state.bad ?? [], builtInVersion: builtInPackage.version, current: boot.version, next: nextLaunch(state), shell };
  };

  function status() {
    const state = readState(root);
    return {
      autoDownload: state.autoDownload !== false,
      builtIn: boot.builtIn !== false,
      builtInVersion: builtInPackage.version,
      checkedAt,
      current: boot.version,
      downloading,
      error: lastError,
      notice: boot.notice ?? null,
      ok: true,
      /** Set when a restart switches to another version. */
      pending: nextLaunch(state) !== boot.version ? nextLaunch(state) : null,
      versions: catalog ? describeVersions(catalog.versions, context()) : [],
    };
  }

  async function fetchCatalog() {
    let problem = '';
    let missing = 0;
    for (const source of sources) {
      try {
        const response = await fetchImpl(source, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (response.status === 404) missing += 1;
        if (!response.ok) { problem = `${response.status}`; continue; }
        const verified = verifyCatalog(await response.json(), publicKey);
        if (verified) return verified;
        problem = '版本列表的签名不对';
        log?.('app update catalog signature rejected', { source });
      } catch (error) {
        problem = error?.message || String(error);
      }
    }
    throw new Error(missing === sources.length ? '还没有发布可以在软件里更新的版本。' : `读不到版本列表（${problem}），检查一下网络。`);
  }

  async function check() {
    try {
      catalog = await fetchCatalog();
      checkedAt = Date.now();
      lastError = '';
    } catch (error) {
      lastError = error.message;
    }
    return status();
  }

  async function downloadZip(zip) {
    let problem = '';
    for (const url of zip.urls ?? []) {
      try {
        const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) { problem = `${response.status}`; continue; }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > MAX_ZIP_BYTES) { problem = '文件太大'; continue; }
        if (sha256(bytes) !== zip.sha256) { problem = '下载的文件和版本列表对不上'; continue; }
        return bytes;
      } catch (error) {
        problem = error?.message || String(error);
      }
    }
    throw new Error(`下载失败（${problem}）`);
  }

  /** Changed files from the zip, the rest from the exe; every file checked against the signed list. */
  function assemble(entry, changed, target) {
    for (const [relative, expected] of Object.entries(entry.files ?? {})) {
      const normalized = path.normalize(relative);
      if (path.isAbsolute(normalized) || normalized.split(/[\\/]/u).includes('..')) throw new Error(`更新里有不合规的路径：${relative}`);
      const bytes = changed[relative] ?? fs.readFileSync(path.join(appPath, normalized));
      if (sha256(bytes) !== expected) throw new Error(`文件对不上：${relative}（这个版本可能不是给你这个安装包做的）`);
      const destination = path.join(target, normalized);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes);
    }
  }

  async function download(version) {
    if (downloading) return { error: `正在下载 v${downloading}。`, ok: false };
    if (!catalog) await check();
    const entry = catalog?.versions.find((item) => item.version === version);
    const described = catalog ? describeVersions([entry].filter(Boolean), context())[0] : null;
    if (!entry || !described) return { error: '版本列表里没有这个版本。', ok: false };
    if (described.action !== 'download') return { error: described.action === 'needs-full' || described.action === 'full' ? '这个版本要下载完整安装包。' : '这个版本不用下载。', ok: false };
    // Already here from before (going back to a version used earlier): no download.
    const existing = versionFolder(root, version);
    if (!checkVersionFolder(existing, { builtInPackage, electronVersion, version })) {
      writeState(root, { ...readState(root), pending: version });
      return { ok: true, version };
    }
    downloading = version;
    const staging = path.join(root, `.staging-${version}-${Date.now().toString(36)}`);
    try {
      const changed = unzipSync(await downloadZip(entry.zip));
      fs.mkdirSync(staging, { recursive: true });
      assemble(entry, changed, staging);
      const target = versionFolder(root, version);
      fs.rmSync(target, { force: true, recursive: true });
      fs.renameSync(staging, target);
      const state = readState(root);
      writeState(root, { ...state, bad: (state.bad ?? []).filter((item) => item !== version), pending: version });
      removeOldVersions();
      log?.('app update ready', { version });
      return { ok: true, version };
    } catch (error) {
      lastError = error.message;
      log?.('app update download failed', { error: error.message, version });
      return { error: error.message, ok: false };
    } finally {
      fs.rmSync(staging, { force: true, recursive: true });
      downloading = null;
    }
  }

  /** Keeps the running version and the one waiting for the next launch. */
  function removeOldVersions() {
    const state = readState(root);
    // The running one, the one waiting for a restart, and the last that worked (to fall back to).
    const keep = new Set([state.active, state.pending, state.good].filter(Boolean).map((version) => `v${version}`));
    for (const entry of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
      if (entry.isDirectory() && entry.name.startsWith('v') && !keep.has(entry.name)) fs.rmSync(path.join(root, entry.name), { force: true, recursive: true });
    }
  }

  /** Back to the exe's own code from the next launch on. */
  function revert() {
    const state = readState(root);
    writeState(root, { ...state, active: null, pending: null });
    return { ok: true };
  }

  /** Cancel a switch that has not happened yet (stay on the running version). */
  function stay() {
    const state = readState(root);
    writeState(root, { ...state, active: boot.builtIn === false ? boot.version : null, pending: null });
    return status();
  }

  function setAutoDownload(enabled) {
    writeState(root, { ...readState(root), autoDownload: Boolean(enabled) });
    return status();
  }

  /** The newest version this install can take as a hot update, when downloading by itself is on. */
  async function autoUpdate() {
    if (readState(root).autoDownload === false) return null;
    await check();
    // Only forward, and not over a switch the user chose (going back to an earlier version).
    const current = status();
    if (current.pending) return null;
    const next = current.versions.find((item) => item.action === 'download' && compareVersions(item.version, current.current) > 0);
    if (!next) return null;
    const result = await download(next.version);
    return result.ok ? next : null;
  }

  return { autoUpdate, check, download, revert, setAutoDownload, status, stay };
}

module.exports = { createAppUpdateService, describeVersions, verifyCatalog };
