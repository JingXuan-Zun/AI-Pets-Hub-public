import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const mainSource = fs.readFileSync(path.join(projectRoot, 'electron', 'main.cjs'), 'utf8');
const windowManagerSource = fs.readFileSync(path.join(projectRoot, 'electron', 'windowManager.cjs'), 'utf8');

assert.match(
  mainSource,
  /app\.on\('second-instance',[\s\S]*windowManager\.showOrRecoverMainWindow\('second-instance'\)/,
  'a second launch should verify the existing renderer instead of only showing a possibly dead window',
);

assert.match(
  mainSource,
  /app\.on\('render-process-gone',[\s\S]*windowManager\.recoverMainWindowRenderer\(webContents, details\)/,
  'a crashed main renderer should enter the recovery path',
);

assert.match(
  windowManagerSource,
  /function recoverMainWindowRenderer\([\s\S]*hidePostDragInputProxy\('main-renderer-recovery',[\s\S]*reloadIgnoringCache\(\)/,
  'renderer recovery should hide the stale input proxy before reloading the main renderer',
);

assert.match(
  windowManagerSource,
  /function recreateMainWindow\([\s\S]*mainWindow\.destroy\(\)[\s\S]*createWindow\(\)/,
  'a destroyed main webContents should recreate the BrowserWindow instead of remaining in the background',
);

assert.match(
  windowManagerSource,
  /function showOrRecoverMainWindow\([\s\S]*executeJavaScript\([\s\S]*recoverMainWindowRenderer/,
  'second-instance recovery should probe renderer responsiveness before deciding to reload',
);

assert.match(
  windowManagerSource,
  /MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT[\s\S]*renderer ready timeout recovery=[\s\S]*recoverMainWindowRenderer\(mainWindow\.webContents/,
  'a missing renderer-ready signal during first launch should trigger one bounded recovery attempt',
);

assert.match(
  windowManagerSource,
  /mainWindow\.webContents\.on\([\s\S]*'did-fail-load'[\s\S]*initial-load-failed-/,
  'a failed main-frame load should enter renderer recovery instead of leaving a background-only process',
);

assert.match(
  windowManagerSource,
  /recoverMainWindowRenderer,[\s\S]*showOrRecoverMainWindow,/,
  'window manager should export both recovery entry points',
);

console.log('main window renderer recovery smoke ok');
