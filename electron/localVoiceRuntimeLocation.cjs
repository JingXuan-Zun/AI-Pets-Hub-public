const fs = require('fs');
const path = require('path');

// The portable exe is often first run from Downloads on C: and moved later, which left the
// installed environment behind and the voice check reported it missing. A folder that holds an
// installed environment is remembered in userData (same place wherever the exe lives) and used
// when nothing is installed near the exe.
const RUNTIME_LOCATION_FILE = 'voice-runtime-location.json';

function comparable(targetPath) {
  return path.resolve(targetPath).toLowerCase();
}

function readRememberedRuntimeRoot(app) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), RUNTIME_LOCATION_FILE), 'utf8'));
    return typeof saved?.runtimeRoot === 'string' ? saved.runtimeRoot : '';
  } catch {
    return '';
  }
}

function rememberRuntimeRoot(app, runtimeRoot) {
  try {
    const remembered = readRememberedRuntimeRoot(app);
    if (remembered && comparable(remembered) === comparable(runtimeRoot)) return runtimeRoot;
    const userData = app.getPath('userData');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, RUNTIME_LOCATION_FILE), JSON.stringify({ runtimeRoot }, null, 2), 'utf8');
  } catch {
    // Remembering is a convenience; the folder next to the exe still works without it.
  }
  return runtimeRoot;
}

module.exports = { readRememberedRuntimeRoot, rememberRuntimeRoot };
