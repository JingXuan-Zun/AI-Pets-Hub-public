import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/agent/agentRuntimeDesktopObservationTools.ts');
const appLauncherSource = readProjectFile('electron/appLauncherService.cjs');

assert.match(
  source,
  /export function resolveObserveWindowsAndAppsScopes/u,
  'observe_windows_and_apps should centralize scope defaults',
);
assert.match(
  source,
  /includeInstalledApps: requestedScopes\.includeInstalledApps \?\? false/u,
  'observe_windows_and_apps should default to the fast path without full installed-app indexing',
);
assert.match(
  source,
  /includeTaskbarPinned: hasExplicitScope \? requestedScopes\.includeTaskbarPinned \?\? false : true/u,
  'an explicit running-app scope should not implicitly trigger taskbar shortcut resolution',
);
assert.match(
  source,
  /const scopes = resolveObserveWindowsAndAppsScopes\(toolCall\)[\s\S]*\.\.\.scopes/u,
  'the observation tool should forward the resolved scope set',
);

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
