import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  desktopInputService: desktopInputRootSource,
  mousePreflightSource,
  mousePositionSource,
  mouseClickSource,
  mouseTouchSource,
  mouseResultSource,
  nativeInterop: nativeInteropSource,
  desktopTools: desktopToolsSource,
  toolInputSchema: toolInputSchemaSource,
} = readProjectSources({
  desktopInputService: 'electron/desktopInputService.cjs',
  mousePreflightSource: 'electron/desktopInputMousePreflight.cjs',
  mousePositionSource: 'electron/desktopInputMousePosition.cjs',
  mouseClickSource: 'electron/desktopInputMouseClick.cjs',
  mouseTouchSource: 'electron/desktopInputMouseTouch.cjs',
  mouseResultSource: 'electron/desktopInputMouseResult.cjs',
  nativeInterop: 'electron/desktopInputNativeInterop.cjs',
  desktopTools: 'src/agent/agentRuntimeDesktopTools.ts',
  toolInputSchema: 'src/agent/agentToolInputSchema.ts',
});
const desktopInputServiceSource = [desktopInputRootSource, mousePreflightSource, mousePositionSource, mouseClickSource, mouseTouchSource, mouseResultSource].join('\n');

assert.match(
  nativeInteropSource,
  /CreateAbsoluteMouseMove\(int x, int y\)/u,
  'desktop input should have a virtual absolute-coordinate movement primitive',
);

assert.match(
  desktopInputServiceSource,
  /stage = 'VirtualAbsoluteMove'/u,
  'desktop input should record the virtual movement stage',
);

assert.match(
  desktopInputServiceSource,
  /failureClassification = 'cursor_target_not_reached'/u,
  'desktop input should stop before clicking when the target coordinate was not reached',
);

assert.match(
  desktopInputServiceSource,
  /GetAncestor\(\$pointWindow, 2\)/u,
  'desktop input should normalize point-hit child windows to their root window before comparison',
);

assert.match(
  desktopInputServiceSource,
  /failureClassification = 'target_hit_test_mismatch'/u,
  'desktop input should block a click when the target coordinate is covered by another window',
);

assert.match(
  desktopInputServiceSource,
  /permissionStatus = 'target_requires_elevation'/u,
  'desktop input should report an elevation mismatch before attempting injection',
);

assert.match(
  toolInputSchemaSource,
  /key: 'forceMouseEventFallback',[\s\S]*?type: 'boolean'/u,
  'desktop input schema should preserve the forced mouse-event fallback option',
);

assert.match(
  desktopToolsSource,
  /cursorSet\?: boolean \| null/u,
  'desktop input result type should include cursorSet evidence from the native bridge',
);

assert.match(
  desktopToolsSource,
  /Cursor verified: \$\{result\.cursorVerified\}/u,
  'desktop input observations should expose cursor verification evidence',
);

assert.match(
  desktopToolsSource,
  /SendInput used: \$\{result\.sendInput\}/u,
  'desktop input observations should expose whether SendInput handled the click',
);

assert.match(
  desktopToolsSource,
  /summaryLines:[\s\S]*Cursor verified:[\s\S]*SendInput used:/u,
  'desktop input receipts should include bridge-level click evidence in summary lines',
);

assert.match(
  desktopToolsSource,
  /Foreground before: \$\{result\.foregroundBefore\.processName/u,
  'desktop input observations should expose foreground window diagnostics before input',
);

assert.match(
  desktopToolsSource,
  /Input process elevated: \$\{result\.processElevated\}/u,
  'desktop input observations should expose current process elevation diagnostics',
);

assert.match(
  desktopToolsSource,
  /target application requires matching elevation/u,
  'desktop input recovery evidence should explain an elevation mismatch',
);

assert.match(
  desktopToolsSource,
  /target_hit_test_mismatch/u,
  'desktop input recovery evidence should explain when the target coordinate belongs to another window',
);

assert.match(
  desktopToolsSource,
  /Input may be blocked by Windows UIPI\/integrity boundary/u,
  'desktop input recovery evidence should flag elevated foreground targets as a UIPI boundary instead of a generic retry',
);

console.log('agent desktop input bridge evidence smoke ok');
