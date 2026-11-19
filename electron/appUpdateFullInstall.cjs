const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { isInstalledFolder } = require('./appHome.cjs');
const { compareVersions } = require('./appUpdateShell.cjs');

// Full versions from inside the app (2026-11-18). A version with another Electron or other
// dependencies cannot be a hot update; it used to open the release page so the user downloaded
// the exe by hand. Now the signed list carries the new exe (name, size, sha256, addresses): the
// app downloads it next to the exe the user keeps, checks it, and on restart starts the new exe
// and quits. The new exe removes the old one on its first start.
// The installed app (installer added 11-19) gets the new installer instead (`setup` in the list):
// it is downloaded to the update folder, run silently once the app has quit (same install
// folder, data kept), starts the new version, and is deleted on that version's first start.
// The dev app and an unpacked folder have nothing of their own to replace: release page.

const DOWNLOAD_TIMEOUT_MS = 30 * 60_000;
const MAX_EXE_BYTES = 600 * 1024 * 1024;
const SAFE_EXE_NAME = /^[\w.\- ]+\.exe$/iu;
const REMOVE_RETRIES = 30;
const REMOVE_RETRY_MS = 2000;

const samePath = (a, b) => Boolean(a && b) && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** The exe the user keeps (portable build), or null (dev app, unpacked folder). */
function portableExePath(env = process.env) {
  const file = String(env.PORTABLE_EXECUTABLE_FILE || '').trim();
  return file ? path.resolve(file) : null;
}

/** How this copy runs: { kind: 'portable' | 'installed', exe } or null (dev app, unpacked folder). */
function currentInstallTarget({ env = process.env, execPath = process.execPath, isPackaged = true } = {}) {
  const portable = portableExePath(env);
  if (portable) return { exe: portable, kind: 'portable' };
  if (isPackaged && execPath && isInstalledFolder(path.dirname(execPath))) return { exe: path.resolve(execPath), kind: 'installed' };
  return null;
}

/** A portable exe path (older callers) or a target. */
const asTarget = (target) => (typeof target === 'string' ? { exe: path.resolve(target), kind: 'portable' } : target || null);

/** What this install downloads for a full version: the new exe (portable) or the installer. */
function fullDownloadFor(entry, target) {
  const kind = asTarget(target)?.kind;
  return kind === 'installed' ? entry?.setup : kind === 'portable' ? entry?.exe : null;
}

/** Whether this full version carries a file this install can switch to by itself. */
function canInstallFull(entry, target) {
  const exe = fullDownloadFor(entry, target);
  return Boolean(exe
    && /^[0-9a-f]{64}$/u.test(String(exe.sha256 ?? ''))
    && Number.isFinite(exe.size) && exe.size > 0 && exe.size <= MAX_EXE_BYTES
    && SAFE_EXE_NAME.test(String(exe.name ?? ''))
    && Array.isArray(exe.urls) && exe.urls.length > 0);
}

/** Next to the current exe; the app's own folder when that one cannot be written to. */
function chooseFolder(portableExe, fallbackFolder) {
  const folder = path.dirname(portableExe);
  try {
    fs.accessSync(folder, fs.constants.W_OK);
    return folder;
  } catch {
    fs.mkdirSync(fallbackFolder, { recursive: true });
    return fallbackFolder;
  }
}

/** Downloads one address to `partial`, hashing on the way; throws with a short reason. */
async function fetchTo(url, partial, exe, { fetchImpl, onProgress }) {
  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) throw new Error(`${response.status}`);
  const hash = crypto.createHash('sha256');
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      received += chunk.length;
      if (received > exe.size) return done(new Error('文件比版本列表里说的大'));
      hash.update(chunk);
      onProgress?.(received, exe.size);
      return done(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(partial));
  if (received !== exe.size || hash.digest('hex') !== exe.sha256) throw new Error('下载的文件和版本列表对不上');
}

/**
 * Downloads the version's exe and checks it against the signed list. Returns where it is; the
 * current exe is never touched (when the names clash, the new one gets the version in its name).
 */
async function downloadFullExe(entry, { fallbackFolder, fetchImpl, onProgress, portableExe, target: given }) {
  const target = asTarget(given ?? portableExe);
  const exe = fullDownloadFor(entry, target);
  // The installer goes to the update folder; a portable exe next to the one the user keeps.
  let folder = fallbackFolder;
  if (target.kind === 'installed') fs.mkdirSync(fallbackFolder, { recursive: true });
  else folder = chooseFolder(target.exe, fallbackFolder);
  const plain = path.join(folder, exe.name);
  const file = samePath(plain, target.exe) ? path.join(folder, exe.name.replace(/\.exe$/iu, ` (v${entry.version}).exe`)) : plain;
  const partial = `${file}.download`;
  let problem = '';
  for (const url of exe.urls) {
    try {
      await fetchTo(url, partial, exe, { fetchImpl, onProgress });
      fs.rmSync(file, { force: true });
      fs.renameSync(partial, file);
      return file;
    } catch (error) {
      problem = error?.message || String(error);
      fs.rmSync(partial, { force: true });
    }
  }
  throw new Error(`下载失败（${problem}）`);
}

/**
 * On the first start of the new version: remove the exe it replaced (portable) or the
 * downloaded installer (installed), retrying while that one is still closing. Only the path the
 * old app itself wrote down is removed.
 */
function finishFullInstall({ log, portableExe, readState, root, runningVersion, writeState, retries = REMOVE_RETRIES, retryMs = REMOVE_RETRY_MS }) {
  const install = readState(root).fullInstall;
  if (!install) return;
  // The installer: once its version runs, it is not needed any more (it may still be closing).
  const setupDone = install.kind === 'setup' && runningVersion && compareVersions(runningVersion, install.version) >= 0;
  if (!setupDone && (install.kind === 'setup' || !portableExe || !samePath(install.newExe, portableExe))) return;
  const done = (removed) => {
    writeState(root, { ...readState(root), fullInstall: null });
    log?.('app update: full install finished', { oldExeRemoved: removed });
  };
  const attempt = (left) => {
    const old = setupDone ? install.newExe : install.oldExe;
    if (!old || samePath(old, portableExe) || !/\.exe$/iu.test(old) || !fs.existsSync(old)) return done(false);
    try {
      fs.rmSync(old, { force: true });
      return done(true);
    } catch {
      if (left <= 0) return done(false);
      return setTimeout(() => attempt(left - 1), retryMs);
    }
  };
  attempt(retries);
}

/** Arguments for running the installer silently over the current install, then the new version. */
function setupArgs(target, env = process.env) {
  const programFiles = [env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432].filter(Boolean);
  const exe = path.resolve(target.exe).toLowerCase();
  const forAllUsers = programFiles.some((root) => exe.startsWith(`${path.resolve(root).toLowerCase()}${path.sep}`));
  return ['--updated', '/S', forAllUsers ? '/allusers' : '/currentuser', '--force-run'];
}

module.exports = { canInstallFull, currentInstallTarget, downloadFullExe, finishFullInstall, fullDownloadFor, portableExePath, samePath, setupArgs };
