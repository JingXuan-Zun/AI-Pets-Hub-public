const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

// Full versions from inside the app (2026-11-18). A version with another Electron or other
// dependencies cannot be a hot update; it used to open the release page so the user downloaded
// the exe by hand. Now the signed list carries the new exe (name, size, sha256, addresses): the
// app downloads it next to the exe the user keeps, checks it, and on restart starts the new exe
// and quits. The new exe removes the old one on its first start. Only the portable build can do
// this (the dev app and an unpacked folder have no exe of their own to replace).

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

/** Whether this full version carries an exe that can be installed from inside the app. */
function canInstallFull(entry, portableExe) {
  const exe = entry?.exe;
  return Boolean(portableExe && exe
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
async function downloadFullExe(entry, { fallbackFolder, fetchImpl, onProgress, portableExe }) {
  const { exe } = entry;
  const folder = chooseFolder(portableExe, fallbackFolder);
  const plain = path.join(folder, exe.name);
  const target = samePath(plain, portableExe) ? path.join(folder, exe.name.replace(/\.exe$/iu, ` (v${entry.version}).exe`)) : plain;
  const partial = `${target}.download`;
  let problem = '';
  for (const url of exe.urls) {
    try {
      await fetchTo(url, partial, exe, { fetchImpl, onProgress });
      fs.rmSync(target, { force: true });
      fs.renameSync(partial, target);
      return target;
    } catch (error) {
      problem = error?.message || String(error);
      fs.rmSync(partial, { force: true });
    }
  }
  throw new Error(`下载失败（${problem}）`);
}

/**
 * On the first start of the new exe: remove the exe it replaced, retrying while that one is
 * still closing. Only the path the old app itself wrote down is removed.
 */
function finishFullInstall({ log, portableExe, readState, root, writeState, retries = REMOVE_RETRIES, retryMs = REMOVE_RETRY_MS }) {
  const install = readState(root).fullInstall;
  if (!install || !portableExe || !samePath(install.newExe, portableExe)) return;
  const done = (removed) => {
    writeState(root, { ...readState(root), fullInstall: null });
    log?.('app update: full install finished', { oldExeRemoved: removed });
  };
  const attempt = (left) => {
    const old = install.oldExe;
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

module.exports = { canInstallFull, downloadFullExe, finishFullInstall, portableExePath, samePath };
