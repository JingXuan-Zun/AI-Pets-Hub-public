import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { serviceSource, bridgeSource, viteEnvSource, runtimeSource } = readProjectSources({
  serviceSource: 'electron/appLauncherService.cjs',
  bridgeSource: 'src/desktopShellBridge.ts',
  viteEnvSource: 'src/vite-env.d.ts',
  runtimeSource: 'src/agent/agentRuntimeDesktopLaunchTools.ts',
});
const focusScriptEndIndex = serviceSource.search(/`;\r?\n\r?\n    try/u);
const createLaunchResultIndex = serviceSource.indexOf('function createLaunchResult(');
const launchLocalAppIndex = serviceSource.indexOf('async function launchLocalApp(');

assert.match(
  serviceSource,
  /async function createLaunchVerification\(/u,
  'app launcher should verify focus/window state after launching',
);

assert.match(
  serviceSource,
  /function createLaunchResult\(/u,
  'app launcher should return one structured launch result shape',
);

assert.ok(focusScriptEndIndex >= 0, 'app launcher focus PowerShell script boundary should be detectable');
assert.ok(createLaunchResultIndex > focusScriptEndIndex, 'createLaunchResult should be defined outside the PowerShell focus script');
assert.ok(
  createLaunchResultIndex > 0 && createLaunchResultIndex < launchLocalAppIndex,
  'createLaunchResult should be in JavaScript scope before launchLocalApp uses it',
);

assert.match(
  serviceSource,
  /status: ok[\s\S]*focused-existing-window[\s\S]*launched-new-process[\s\S]*launched-unverified[\s\S]*multiple-candidates[\s\S]*launch-failed[\s\S]*not-found/u,
  'app launcher should classify launch outcomes',
);

assert.match(
  serviceSource,
  /const verification = await createLaunchVerification\('launched', query, selectedApp, \{ delay: true \}\);/u,
  'local app launch should perform post-launch window verification',
);

assert.match(
  serviceSource,
  /verification: \{[\s\S]*reason: 'existing-window-focused'/u,
  'focused existing windows should include verification evidence',
);

assert.match(
  viteEnvSource,
  /status\?:[\s\S]*'focused-existing-window'[\s\S]*'launched-unverified'[\s\S]*'not-found'/u,
  'renderer launch result type should include structured launch statuses',
);

assert.match(
  bridgeSource,
  /status: 'not-found'[\s\S]*verification: null/u,
  'non-desktop fallback should keep the same launch result shape',
);

assert.match(
  serviceSource,
  /rememberedMatches[\s\S]*searchRememberedApps\(query/u,
  'local app launch should try remembered app aliases before broad app index search.',
);

assert.match(
  serviceSource,
  /focusExistingAppWindow\(query, null\)[\s\S]*local app focused by process fallback/u,
  'local app launch should try an already-running process fallback before bounded disk search.',
);

assert.match(
  serviceSource,
  /const diskFallbackMatches = await searchDiskFallbackApps\(query, \{ limit: 6 \}\)/u,
  'local app launch should use bounded disk fallback only after remembered/running/index candidates fail.',
);

assert.match(
  serviceSource,
  /No matching app entry found after checking remembered apps, running windows, taskbar\/start shortcuts, installed programs, and bounded local disk candidates\. Please provide the app path once or remember it as an app alias\./u,
  'not-found app launch results should stop repeated blind scanning and ask for a path or remembered alias.',
);

assert.match(
  runtimeSource,
  /const verification = result\?\.verification/u,
  'agent runtime should read app launch verification',
);

assert.match(
  runtimeSource,
  /result\?\.status === 'launched-unverified'/u,
  'agent runtime should handle launched-but-unverified app windows',
);

assert.match(
  runtimeSource,
  /Launch status: \$\{result\?\.status/u,
  'agent runtime observations should include launch status',
);

console.log('app launch verification smoke ok');
