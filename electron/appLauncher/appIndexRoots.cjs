const fs = require('fs');
const path = require('path');
const os = require('os');
const { uniquePaths } = require('./appSearchMatching.cjs');
const { APP_DISK_FALLBACK_MAX_ROOTS } = require('./appLauncherConstants.cjs');

function getShortcutRoots(app) {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const roots = [
    path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned'),
  ];

  try {
    roots.push(app.getPath('desktop'));
  } catch {
    roots.push(path.join(os.homedir(), 'Desktop'));
  }

  try {
    roots.push(path.join(os.homedir(), 'Desktop'));
  } catch {
    // Ignore missing home directories.
  }

  return uniquePaths(roots);
}

function getTaskbarPinnedRoot() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar');
}

function getDiskFallbackRoots() {
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
    process.env.APPDATA,
    process.env.PROGRAMDATA,
    process.env.HOMEDRIVE ? `${process.env.HOMEDRIVE}\\` : '',
    path.parse(process.cwd()).root,
  ];

  if (process.platform === 'win32') {
    for (let code = 67; code <= 90 && roots.length < APP_DISK_FALLBACK_MAX_ROOTS + 12; code += 1) {
      roots.push(`${String.fromCharCode(code)}:\\`);
    }
  }

  return uniquePaths(roots)
    .filter(Boolean)
    .filter((root) => {
      try {
        return fs.statSync(root).isDirectory();
      } catch {
        return false;
      }
    })
    .slice(0, APP_DISK_FALLBACK_MAX_ROOTS);
}

module.exports = { getShortcutRoots, getTaskbarPinnedRoot, getDiskFallbackRoots };
