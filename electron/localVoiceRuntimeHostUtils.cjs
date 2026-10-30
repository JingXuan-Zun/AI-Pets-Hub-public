const fs = require('fs');
const path = require('path');
const {
  isPathInside,
  normalizeComparablePath,
  pathExists,
} = require('./localVoiceRuntimePathUtils.cjs');

// pip's download cache and temp folder default to C: (several GB of torch wheels), so with a
// runtime root they live inside it instead, on the same drive as the environment.
function createPythonEnv(runtimeRoot) {
  const env = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    PIP_NO_INPUT: '1',
  };
  if (!runtimeRoot) return env;
  const tempDir = path.join(runtimeRoot, 'tmp');
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch {
    return env;
  }
  return { ...env, PIP_CACHE_DIR: path.join(runtimeRoot, 'pip-cache'), TMP: tempDir, TEMP: tempDir };
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
