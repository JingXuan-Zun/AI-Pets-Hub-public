const fs = require('fs');
const {
  isPathInside,
  normalizeComparablePath,
  pathExists,
} = require('./localVoiceRuntimePathUtils.cjs');

function createPythonEnv() {
  return {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    PIP_NO_INPUT: '1',
  };
}

function removeDirectorySafe(targetPath, allowedBasePath) {
  if (!pathExists(targetPath)) {
    return;
  }

  if (!isPathInside(targetPath, allowedBasePath) || normalizeComparablePath(targetPath) === normalizeComparablePath(allowedBasePath)) {
    throw new Error(`Refused to remove runtime path outside allowed directory: ${targetPath}`);
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
}

module.exports = {
  createPythonEnv,
  removeDirectorySafe,
};
