const fs = require('fs');
const path = require('path');

// Where the big files live: voice environment and packs, imported 2D models, the sticker
// library (several GB, so not in userData's copy-on-backup world and not in the temp folder).
//   - development: the project folder;
//   - portable exe: the folder the user keeps the exe in (it runs from a temp copy);
//   - installed (2026-11-19, installer next to the portable exe): NOT the install folder, which
//     every upgrade and the uninstaller wipe, but "AI Pets Hub Data" beside it — on whatever
//     drive the user installed to;
//   - an unpacked folder build (testing): its own folder.

const INSTALLED_HOME_NAME = 'AI Pets Hub Data';
const UNINSTALLER = /^Uninstall .+\.exe$/iu;

/** An installer-made folder: electron-builder puts its uninstaller next to the exe. */
function isInstalledFolder(exeDir, readdir = fs.readdirSync) {
  try {
    return readdir(exeDir).some((name) => UNINSTALLER.test(name));
  } catch {
    return false;
  }
}

const isInside = (child, parent) => Boolean(parent) && (`${path.resolve(child).toLowerCase()}${path.sep}`).startsWith(`${path.resolve(parent).toLowerCase()}${path.sep}`);

function installedHomeFor(exeDir, env = process.env) {
  const installDir = path.resolve(exeDir);
  // "For all users" installs to Program Files, where the app cannot write: the user's own
  // AppData\Local then.
  const programFiles = [env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432].filter(Boolean);
  if (programFiles.some((root) => isInside(installDir, root)) && env.LOCALAPPDATA) return path.join(env.LOCALAPPDATA, INSTALLED_HOME_NAME);
  const parent = path.dirname(installDir);
  return path.join(parent === installDir ? installDir : parent, INSTALLED_HOME_NAME);
}

/** { dir, kind } — kind is dev | portable | installed | folder. */
function resolveAppHome({ env = process.env, execPath = process.execPath, isPackaged, projectRoot, readdir } = {}) {
  if (!isPackaged) return { dir: path.resolve(projectRoot), kind: 'dev' };
  const portableDir = String(env.PORTABLE_EXECUTABLE_DIR || '').trim();
  if (portableDir) return { dir: path.resolve(portableDir), kind: 'portable' };
  const portableFile = String(env.PORTABLE_EXECUTABLE_FILE || '').trim();
  if (portableFile) return { dir: path.dirname(path.resolve(portableFile)), kind: 'portable' };
  const exeDir = path.dirname(path.resolve(execPath));
  if (isInstalledFolder(exeDir, readdir)) return { dir: installedHomeFor(exeDir, process.env), kind: 'installed' };
  return { dir: exeDir, kind: 'folder' };
}

/** The installed app's big-files folder, or null (dev, portable): an installer-made folder only. */
function installedHomeDir(execPath = process.execPath) {
  const home = resolveAppHome({ env: {}, execPath, isPackaged: true, projectRoot: process.cwd() });
  return home.kind === 'installed' ? home.dir : null;
}

/** The same for the running app (Electron's app object). */
function appHomeFor(app, projectRoot = path.join(__dirname, '..')) {
  return resolveAppHome({ isPackaged: Boolean(app?.isPackaged), projectRoot });
}

module.exports = { INSTALLED_HOME_NAME, appHomeFor, installedHomeDir, installedHomeFor, isInstalledFolder, resolveAppHome };
