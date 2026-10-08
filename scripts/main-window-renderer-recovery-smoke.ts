import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');

const projectRoot = process.cwd();
const mainSource = fs.readFileSync(path.join(projectRoot, 'electron', 'main.cjs'), 'utf8');
const windowManagerSource = readModuleProjectFile('electron/windowManager.cjs');

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

const recoverySource = readModuleProjectFunction('electron/windowManager/mainWindowRecovery.cjs', 'createMainWindowRendererRecovery');
const recreateSource = readModuleProjectFunction('electron/windowManager/mainWindowRecovery.cjs', 'createMainWindowRecreator');
assert.match(windowManagerSource, /const recoverMainWindowRenderer = createMainWindowRendererRecovery\(/);
assert.match(windowManagerSource, /const recreateMainWindow = createMainWindowRecreator\(/);
assert.match(
  recoverySource,
  /function recoverMainWindowRenderer\([\s\S]*hidePostDragInputProxy\('main-renderer-recovery',[\s\S]*reloadIgnoringCache\(\)/,
  'renderer recovery should hide the stale input proxy before reloading the main renderer',
);

assert.match(
  recreateSource,
  /function recreateMainWindow\([\s\S]*getMainWindow\(\)\.destroy\(\)[\s\S]*clearMainWindow\(\)[\s\S]*createWindow\(\)/,
  'a destroyed main webContents should recreate the BrowserWindow instead of remaining in the background',
);

const healthSource = readModuleProjectFunction('electron/windowManager/mainWindowHealth.cjs', 'createMainWindowHealthPresenter');
assert.match(windowManagerSource, /const showOrRecoverMainWindow = createMainWindowHealthPresenter\(/);
assert.match(windowManagerSource, /MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS = 1_500/);
assert.match(
  healthSource,
  /function showOrRecoverMainWindow\([\s\S]*executeJavaScript\([\s\S]*recoverMainWindowRenderer\(activeWebContents/,
  'second-instance recovery should probe renderer responsiveness before deciding to reload',
);

const fallbackSource = readModuleProjectFunction('electron/windowManager/mainWindowReadyFallback.cjs', 'createMainWindowReadyFallbackScheduler');
assert.match(windowManagerSource, /MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT = 1/);
assert.match((windowManagerSource + lifecycleStateSource), /getStartupRecoveryCount: \(\) => managerState\.mainWindowRendererStartupRecoveryCount/);
assert.match((windowManagerSource + lifecycleStateSource), /incrementStartupRecoveryCount: \(\) => \{ managerState\.mainWindowRendererStartupRecoveryCount \+= 1; \}/);
assert.match(fallbackSource, /getStartupRecoveryCount\(\) < MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT/);
assert.match(
  fallbackSource,
  /incrementStartupRecoveryCount\(\);[\s\S]*renderer ready timeout recovery=[\s\S]*recoverMainWindowRenderer\(getMainWindow\(\)\.webContents/,
  'a missing renderer-ready signal during first launch should trigger one bounded recovery attempt',
);

const loadSource = readModuleProjectFunction('electron/windowManager/mainWindowLoadEvents.cjs', 'createMainWindowLoadEventRegistrar');
assert.match((windowManagerSource + lifecycleStateSource), /getRendererRecoveryInProgress: \(\) => managerState\.mainWindowRendererRecoveryInProgress/);
assert.match(loadSource, /!isMainFrame \|\| errorCode === -3 \|\| getRendererRecoveryInProgress\(\)/);
assert.match(
  loadSource,
  /getMainWindow\(\)\.webContents\.on\([\s\S]*'did-fail-load'[\s\S]*initial-load-failed-/,
  'a failed main-frame load should enter renderer recovery instead of leaving a background-only process',
);

assert.match(
  windowManagerSource,
  /recoverMainWindowRenderer,[\s\S]*showOrRecoverMainWindow,/,
  'window manager should export both recovery entry points',
);

console.log('main window renderer recovery smoke ok');
