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
  toolInputSchema: toolInputSchemaSource,
} = readProjectSources({
  desktopInputService: 'electron/desktopInputService.cjs',
  mousePreflightSource: 'electron/desktopInputMousePreflight.cjs',
  mousePositionSource: 'electron/desktopInputMousePosition.cjs',
  mouseClickSource: 'electron/desktopInputMouseClick.cjs',
  mouseTouchSource: 'electron/desktopInputMouseTouch.cjs',
  mouseResultSource: 'electron/desktopInputMouseResult.cjs',
  nativeInterop: 'electron/desktopInputNativeInterop.cjs',
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

console.log('agent desktop input bridge evidence smoke ok');
