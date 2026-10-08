const fs = require('fs');
const path = require('path');

const WINDOWS_BROWSER_ROOT_NAMES = ['Program Files', 'Program Files (x86)'];

function isExecutableFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function getWindowsDriveRoots() {
  if (process.platform !== 'win32') {
    return [];
  }

  const roots = [];
  for (let code = 65; code <= 90; code += 1) {
    const driveRoot = `${String.fromCharCode(code)}:\\`;
    try {
      if (fs.existsSync(driveRoot)) {
        roots.push(driveRoot);
      }
    } catch {
      // Ignore inaccessible drive roots.
    }
  }

  return roots;
}

function getBrowserSearchCandidateRoots() {
  if (process.platform !== 'win32') {
    return [];
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const windowsDriveRoots = getWindowsDriveRoots();

  return uniqueStrings([
    programFiles,
    programFilesX86,
    localAppData,
    ...windowsDriveRoots.flatMap((driveRoot) => WINDOWS_BROWSER_ROOT_NAMES.map((rootName) => path.join(driveRoot, rootName))),
  ]);
}

function buildBrowserCandidateDescriptors() {
  return getBrowserSearchCandidateRoots()
    .flatMap((rootPath) => ([
      {
        browserLabel: 'Edge',
        exists: false,
        path: path.join(rootPath, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        source: rootPath,
      },
      {
        browserLabel: 'Chrome',
        exists: false,
        path: path.join(rootPath, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        source: rootPath,
      },
    ]))
    .map((candidate) => ({
      ...candidate,
      exists: isExecutableFile(candidate.path),
    }));
}

function getDetectedBrowserCandidates() {
  return buildBrowserCandidateDescriptors()
    .filter((candidate) => candidate.exists)
    .sort((left, right) => {
      if (left.browserLabel !== right.browserLabel) {
        return left.browserLabel.localeCompare(right.browserLabel, 'en-US');
      }

      return left.path.localeCompare(right.path, 'zh-CN');
    });
}

function getDefaultBrowserCandidates() {
  return getDetectedBrowserCandidates().map((candidate) => candidate.path);
}

function resolveBrowserPath(configuredPath) {
  const trimmedPath = typeof configuredPath === 'string' ? configuredPath.trim() : '';
  if (isExecutableFile(trimmedPath)) {
    return trimmedPath;
  }

  return getDefaultBrowserCandidates()[0] || '';
}

function resolveBrowserLabel(browserPath) {
  const basename = path.basename(browserPath || '').toLowerCase();
  if (basename.includes('msedge')) {
    return 'Edge';
  }

  if (basename.includes('chrome')) {
    return 'Chrome';
  }

  return browserPath ? path.basename(browserPath) : 'Browser';
}

module.exports = {
  isExecutableFile,
  uniqueStrings,
  getWindowsDriveRoots,
  getBrowserSearchCandidateRoots,
  buildBrowserCandidateDescriptors,
  getDetectedBrowserCandidates,
  getDefaultBrowserCandidates,
  resolveBrowserPath,
  resolveBrowserLabel
};
