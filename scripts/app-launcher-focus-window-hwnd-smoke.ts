import assert from 'node:assert/strict';
import { readModuleProjectSources as readProjectSources } from './projectModuleSource.mjs';

const {
  appLauncherSource,
  windowToolsSource,
} = readProjectSources({
  appLauncherSource: 'electron/appLauncherService.cjs',
  windowToolsSource: 'src/agent/agentRuntimeWindowTools.ts',
});

assert.match(
  windowToolsSource,
  /desktopPetShellRuntime\.focusWindow\(\{ hwnd, pid, query \}\)/u,
  'the runtime focus tool must forward hwnd and pid to the desktop shell bridge',
);
assert.match(
  appLauncherSource,
  /async function focusWindow\(request = \{\}\) \{[\s\S]*const requestedPid = Number\(request\?\.pid\)[\s\S]*const requestedHwnd = Number\(request\?\.hwnd \|\| request\?\.windowHandle\)/u,
  'the Electron focus service must read PID and HWND selectors from the runtime request',
);
assert.match(
  appLauncherSource,
  /if \(!query && !hasPid && !hasHwnd\)/u,
  'focus should reject only when query, PID, and HWND are all absent',
);
assert.match(
  appLauncherSource,
  /focusExistingAppWindow\(query, null, \{[\s\S]*hwnd: hasHwnd \? Math\.round\(requestedHwnd\) : 0,[\s\S]*pid: hasPid \? Math\.round\(requestedPid\) : 0,[\s\S]*\}\)/u,
  'focus should pass exact window selectors to the native focus resolver',
);
assert.match(
  appLauncherSource,
  /\$handleMatch = \(\$requestedHwnd -gt 0 -and \[int64\]\$window\.hwnd -eq \$requestedHwnd\)/u,
  'the native focus resolver must match an observed top-level HWND exactly before title/process fallback',
);
assert.match(
  appLauncherSource,
  /\$pidMatch = \(\$requestedPid -gt 0 -and \[int64\]\$window\.pid -eq \$requestedPid\)/u,
  'the native focus resolver must support PID matching when the handle is unavailable',
);
assert.match(
  appLauncherSource,
  /ok = \[bool\]\$foregroundMatchesTarget/u,
  'confirmed foreground ownership must be authoritative even when SetForegroundWindow reports false',
);
assert.match(
  appLauncherSource,
  /AttachThreadInput\(\$currentThreadId, \$foregroundThreadId, \$true\)/u,
  'focus should temporarily attach the foreground input thread when available',
);
assert.match(
  appLauncherSource,
  /focusStatus = 'unverified'/u,
  'a zero foreground handle must remain a transient or unverified state',
);
assert.match(
  appLauncherSource,
  /const retryDelays = \[0, 300, 1000, 3000\]/u,
  'focus should re-resolve a transiently missing window with bounded backoff',
);
assert.match(
  appLauncherSource,
  /focusResolutionRetried: focusResolutionAttempts > 1/u,
  'focus should expose whether target resolution was retried',
);
assert.match(
  appLauncherSource,
  /EnumerateTopLevelWindowsWithDiagnostics/u,
  'window enumeration should retain filtered-window diagnostics separately from actionable windows',
);
assert.match(
  appLauncherSource,
  /filteredOut = \$filtered/u,
  'window enumeration diagnostics should expose bounded filter reasons',
);

console.log('app launcher focus window hwnd smoke ok');
