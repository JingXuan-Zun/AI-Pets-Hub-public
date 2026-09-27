const path = require('node:path');
const MODEL_ASSET_DIRECTORY_NAME = '2d模型';
const LEGACY_MODEL_ASSET_DIRECTORY_NAME = 'd1';

// electron-builder portable executables run from a temporary extraction path.
// Store imports beside the original portable executable, never beside that copy.
function resolveModelAssetRoot({ isPackaged, execPath, projectRoot, env = process.env }) {
  if (!isPackaged) return path.resolve(projectRoot);
  const portableDirectory = String(env.PORTABLE_EXECUTABLE_DIR || '').trim();
  if (portableDirectory) return path.resolve(portableDirectory);
  const portableFile = String(env.PORTABLE_EXECUTABLE_FILE || '').trim();
  if (portableFile) return path.dirname(path.resolve(portableFile));
  return path.dirname(execPath);
}

module.exports = { resolveModelAssetRoot, MODEL_ASSET_DIRECTORY_NAME, LEGACY_MODEL_ASSET_DIRECTORY_NAME };
