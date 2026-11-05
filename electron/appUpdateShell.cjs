const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Shared by the boot loader (which never updates itself) and the update service: where hot
// updates live, what state they are in, and whether one fits this install. A hot update is the
// app's own code (dist/, electron/, resources/, package.json) at a newer version; Electron and
// the npm dependencies — "the shell" — stay those of the installed exe, so an update made for
// another shell is never used.

const STATE_FILE = 'state.json';
/** Two launches without the window coming up → that version is set aside. */
const MAX_ATTEMPTS = 2;
const REQUIRED_FILES = [path.join('electron', 'main.cjs'), path.join('electron', 'preload.cjs'), path.join('dist', 'index.html'), 'package.json'];

function updatesRoot(userDataPath) {
  return path.join(userDataPath, 'app-updates');
}

function versionFolder(root, version) {
  return path.join(root, `v${version}`);
}

/** Electron version + the npm dependencies: an update only runs on the shell it was built for. */
function shellFingerprint(packageJson, electronVersion) {
  const dependencies = Object.entries(packageJson?.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const hash = crypto.createHash('sha256').update(JSON.stringify(dependencies)).digest('hex').slice(0, 16);
  return `${electronVersion}:${hash}`;
}

/** 0.4.10 > 0.4.9; anything after "-" ignored. */
function compareVersions(a, b) {
  const parts = (value) => String(value ?? '').split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

function readState(root) {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8'));
    return state && typeof state === 'object' ? state : {};
  } catch {
    return {};
  }
}

function writeState(root, state) {
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, STATE_FILE);
  fs.writeFileSync(`${target}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(`${target}.tmp`, target);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Whether a downloaded version can run here: complete, newer than the exe, same shell. */
function checkVersionFolder(folder, { builtInPackage, electronVersion, version }) {
  if (!REQUIRED_FILES.every((file) => fs.existsSync(path.join(folder, file)))) return 'incomplete';
  const updatePackage = readJson(path.join(folder, 'package.json'));
  if (!updatePackage || updatePackage.version !== version) return 'version-mismatch';
  if (compareVersions(version, builtInPackage.version) <= 0) return 'not-newer';
  if (shellFingerprint(updatePackage, electronVersion) !== shellFingerprint(builtInPackage, electronVersion)) return 'other-shell';
  return null;
}

module.exports = {
  MAX_ATTEMPTS,
  REQUIRED_FILES,
  checkVersionFolder,
  compareVersions,
  readState,
  shellFingerprint,
  updatesRoot,
  versionFolder,
  writeState,
};
