import assert from 'node:assert/strict';
import { readModuleProjectFile as readProjectFile } from './projectModuleSource.mjs';

const appLauncherSource = readProjectFile('electron/appLauncherService.cjs');
const launchRuntimeSource = readProjectFile('src/agent/agentRuntimeDesktopLaunchTools.ts');
const runtimeExecutorSource = readProjectFile('src/agent/agentRuntimeExecutor.ts');
const toolInputSchemaSource = readProjectFile('src/agent/agentToolInputSchema.ts');

assert.match(
  appLauncherSource,
  /const APP_INDEX_CACHE_TTL_MS = 60000;/u,
  'local app index cache should survive a normal multi-turn agent run',
);

assert.match(
  launchRuntimeSource,
  /executeAppLaunch\(\s*appName: string,\s*forceNew\?: boolean,\s*forceRefresh\?: boolean/u,
  'agent launch runtime should accept explicit forceRefresh without forcing app-index refresh by default',
);

assert.match(
  launchRuntimeSource,
  /forceRefresh,\s*\r?\n\s*query: appName/u,
  'agent launch runtime should pass through forceRefresh instead of always refreshing the app index',
);

assert.doesNotMatch(
  launchRuntimeSource,
  /forceRefresh: true/u,
  'agent launch runtime should not bypass the app-index cache on every launch',
);

assert.match(
  runtimeExecutorSource,
  /getToolBooleanInput\(toolCall, 'forceRefresh'\)/u,
  'launch_local_app executor should accept an explicit forceRefresh input',
);

assert.match(
  toolInputSchemaSource,
  /launch_local_app:[\s\S]*key: 'forceRefresh'/u,
  'launch_local_app schema should expose forceRefresh for explicit fresh app-index scans',
);

assert.match(
  appLauncherSource,
  /const POST_LAUNCH_VERIFY_POLL_INTERVAL_MS = 120;/u,
  'post-launch verification should poll in short intervals instead of waiting the full window every time',
);

assert.match(
  appLauncherSource,
  /const deadline = Date\.now\(\) \+ POST_LAUNCH_VERIFY_DELAY_MS[\s\S]*if \(focusResult\.ok\)[\s\S]*return \{[\s\S]*launched-window-detected[\s\S]*await waitForMs\(POST_LAUNCH_VERIFY_POLL_INTERVAL_MS\)/u,
  'post-launch verification should return early when the launched window appears',
);

assert.match(
  appLauncherSource,
  /const shortcutTargetPathCache = new Map\(\);/u,
  'shortcut target lookup should have an in-memory cache',
);

assert.match(
  appLauncherSource,
  /shortcutTargetPathCache\.get\(cacheKey\)[\s\S]*cached\.mtimeMs === stat\.mtimeMs[\s\S]*return cached\.targetPath;/u,
  'shortcut target cache should reuse entries while the shortcut file is unchanged',
);

assert.match(
  appLauncherSource,
  /\$foregroundHandle = \[DesktopPetTopLevelWindowEnumerator\]::GetForegroundWindow\(\)[\s\S]*active = \(\$windowHwnd -eq \$foregroundHwnd\)/u,
  'listRunningApps should mark the foreground window during the same PowerShell enumeration',
);

assert.match(
  appLauncherSource,
  /const activeWindow = windows\.find\(\(item\) => item\.active\) \?\? null;/u,
  'listRunningApps should expose the active window from its existing window list',
);

assert.match(
  appLauncherSource,
  /running\.activeWindow[\s\S]*source: 'running-window-list'[\s\S]*await getActiveWindowInfo\(\)/u,
  'observeWindowsAndApps should reuse listRunningApps activeWindow and only fallback to a separate active-window call',
);

assert.match(
  appLauncherSource,
  /function listObservedInstalledAndTaskbarPinnedApps\(request = \{\}\)/u,
  'observeWindowsAndApps should have a combined installed/taskbar observation path',
);

assert.match(
  appLauncherSource,
  /const observedAppLists = includeInstalledApps \|\| includeTaskbarPinned[\s\S]*listObservedInstalledAndTaskbarPinnedApps/u,
  'observeWindowsAndApps should collect installed and taskbar pinned apps through one app-index pass',
);

console.log('agent tool call speed v1 smoke ok');
