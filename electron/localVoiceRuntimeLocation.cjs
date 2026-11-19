const fs = require('fs');
const path = require('path');

// The portable exe is often first run from Downloads on C: and moved later, which left the
// installed environment behind and the voice check reported it missing. A folder that holds an
// installed environment is remembered in userData (same place wherever the exe lives) and used
// when nothing is installed near the exe. Since 11-19 the voice packs folder is remembered the
// same way, so switching from the portable exe to the installed app keeps both.
const RUNTIME_LOCATION_FILE = 'voice-runtime-location.json';

function comparable(targetPath) {
  return path.resolve(targetPath).toLowerCase();
}

function readLocations(app) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), RUNTIME_LOCATION_FILE), 'utf8'));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function readRemembered(app, key) {
  const value = readLocations(app)[key];
  return typeof value === 'string' ? value : '';
}

function remember(app, key, folder) {
  try {
    const saved = readLocations(app);
    if (typeof saved[key] === 'string' && comparable(saved[key]) === comparable(folder)) return folder;
    const userData = app.getPath('userData');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, RUNTIME_LOCATION_FILE), JSON.stringify({ ...saved, [key]: folder }, null, 2), 'utf8');
  } catch {
    // Remembering is a convenience; the folder next to the exe still works without it.
  }
  return folder;
}

const readRememberedRuntimeRoot = (app) => readRemembered(app, 'runtimeRoot');
const rememberRuntimeRoot = (app, runtimeRoot) => remember(app, 'runtimeRoot', runtimeRoot);
const readRememberedVoiceRoot = (app) => readRemembered(app, 'voiceRoot');
const rememberVoiceRoot = (app, voiceRoot) => remember(app, 'voiceRoot', voiceRoot);

module.exports = { readRememberedRuntimeRoot, readRememberedVoiceRoot, rememberRuntimeRoot, rememberVoiceRoot };
