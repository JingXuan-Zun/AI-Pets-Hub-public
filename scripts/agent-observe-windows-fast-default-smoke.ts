import assert from 'node:assert/strict';
import { readModuleProjectFile as readProjectFile } from './projectModuleSource.mjs';
const appLauncherSource = readProjectFile('electron/appLauncherService.cjs');

assert.match(
  appLauncherSource,
  /const APP_INDEX_CACHE_TTL_MS = 60000/u,
  'app index should be cached so repeated app observations do not rescan synchronously.',
);

assert.match(
  appLauncherSource,
  /APP_INDEX_MAX_SHORTCUT_DIRECTORIES/u,
  'shortcut indexing should stay bounded.',
);

assert.match(
  appLauncherSource,
  /APP_DISK_FALLBACK_MAX_DIRECTORIES/u,
  'disk fallback app search should stay bounded.',
);

assert.match(
  appLauncherSource,
  /const observedAppLists = includeInstalledApps \|\| includeTaskbarPinned[\s\S]*\? await listObservedInstalledAndTaskbarPinnedApps/u,
  'main-process installed/taskbar indexing should only run when the caller explicitly needs those lists.',
);

assert.match(
  appLauncherSource,
  /entries = await fs\.promises\.readdir\(directory, \{ withFileTypes: true \}\)/u,
  'bounded executable fallback should use async directory reads instead of blocking the main process.',
);

assert.match(
  appLauncherSource,
  /async function walkShortcutRoot/u,
  'shortcut root walking should be async so app indexing does not block the Electron main process.',
);

assert.match(
  appLauncherSource,
  /entries = await fs\.promises\.readdir\(current\.root, \{ withFileTypes: true \}\)/u,
  'shortcut root walking should use async directory reads instead of readdirSync.',
);

assert.doesNotMatch(
  appLauncherSource,
  /fs\.readdirSync\(root, \{ withFileTypes: true \}\)/u,
  'shortcut root walking should not synchronously enumerate shortcut directories.',
);

console.log('agent observe windows fast default smoke ok');
