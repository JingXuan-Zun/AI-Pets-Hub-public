const { resolveAppHome } = require('./appHome.cjs');

const MODEL_ASSET_DIRECTORY_NAME = '2d模型';
const LEGACY_MODEL_ASSET_DIRECTORY_NAME = 'd1';

// Imported models go to the app's big-files folder (appHome.cjs): beside the portable exe the
// user keeps (never its temp copy), or "AI Pets Hub Data" for the installed app.
function resolveModelAssetRoot({ isPackaged, execPath, projectRoot, env = process.env, readdir }) {
  return resolveAppHome({ env, execPath, isPackaged, projectRoot, readdir }).dir;
}

module.exports = { resolveModelAssetRoot, MODEL_ASSET_DIRECTORY_NAME, LEGACY_MODEL_ASSET_DIRECTORY_NAME };
