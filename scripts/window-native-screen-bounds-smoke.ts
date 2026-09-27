import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  appLauncher: appLauncherSource,
  desktopLaunchTools: desktopLaunchToolsSource,
  windowTools: windowToolsSource,
} = readProjectSources({
  appLauncher: 'electron/appLauncherService.cjs',
  desktopLaunchTools: 'src/agent/agentRuntimeDesktopLaunchTools.ts',
  windowTools: 'src/agent/agentRuntimeWindowTools.ts',
});

assert.match(
  appLauncherSource,
  /function nativeScreenRectToDipRect\(rect\)[\s\S]*return \{[\s\S]*coordinateSpace: 'dip'/u,
  'native Win32 rectangles should be converted to self-labeled DIP rectangles before leaving appLauncherService',
);

assert.match(
  appLauncherSource,
  /const nativeFromBounds = normalizeWindowMoveBounds\(parsed\?\.fromBounds\);[\s\S]*const nativeToBounds = normalizeWindowMoveBounds\(parsed\?\.toBounds\);[\s\S]*const fromBounds = nativeScreenRectToDipRect\(nativeFromBounds\);[\s\S]*const toBounds = nativeScreenRectToDipRect\(nativeToBounds\);[\s\S]*const fromDisplay = findDisplayForBounds\(fromBounds\);[\s\S]*const toDisplay = findDisplayForBounds\(toBounds\);/u,
  'move_window_to_display should match Electron displays using DIP bounds, not native-screen bounds',
);

assert.match(
  appLauncherSource,
  /const resolvedTarget = resolveMoveWindowTargetDisplay\(request\);[\s\S]*resolvedTarget\.display\.primary[\s\S]*targetRole = 'secondary'[\s\S]*targetIndex = resolvedTarget\.display\.index \+ 1/u,
  'friendly Electron display labels should resolve to a native primary/secondary/index hint before Win32 movement',
);

assert.match(
  appLauncherSource,
  /\$wasMaximized = \[DesktopPetWindowMove\]::IsZoomed\(\$handle\)[\s\S]*ShowWindow\(\$handle, 3\)[\s\S]*maximizedRestored/u,
  'moving a maximized window should restore its maximized state on the target display',
);

assert.match(
  appLauncherSource,
  /nativeCoordinateSpace: nativeToBounds \? 'native-screen' : null,[\s\S]*nativeFromBounds,[\s\S]*nativeToBounds,[\s\S]*toBounds,/u,
  'move_window_to_display should keep native Win32 bounds only under explicit native* fields',
);

assert.match(
  appLauncherSource,
  /const nativeTargetBounds = normalizeWindowMoveBounds\(parsed\?\.targetBounds\);[\s\S]*const targetBounds = nativeScreenRectToDipRect\(nativeTargetBounds\);[\s\S]*nativeCoordinateSpace: nativeToBounds \|\| nativeTargetBounds \? 'native-screen' : null,[\s\S]*nativeTargetBounds,[\s\S]*targetBounds,/u,
  'control_window should expose target bounds as DIP and preserve native-screen target bounds separately',
);

assert.doesNotMatch(
  appLauncherSource,
  /findDisplayForBounds\(native(?:From|To|Target)Bounds\)/u,
  'Electron display matching should not consume native-screen bounds directly',
);

assert.match(
  desktopLaunchToolsSource,
  /bounds\?: \{ coordinateSpace\?: string \| null; height\?: number \| null; width\?: number \| null; x\?: number \| null; y\?: number \| null \}/u,
  'structured window evidence types should carry the coordinate-space label',
);

assert.match(
  desktopLaunchToolsSource,
  /coordinateSpace: typeof windowInfo\.bounds\.coordinateSpace === 'string'[\s\S]*\? windowInfo\.bounds\.coordinateSpace/u,
  'structured window evidence should preserve the window bounds coordinate-space label',
);

assert.match(
  windowToolsSource,
  /const controlFinalBounds = result\?\.toBounds \?\? result\?\.targetBounds \?\? null;[\s\S]*coordinateSpace: controlFinalBounds\.coordinateSpace \?\? 'dip'/u,
  'control_window structured evidence should label final bounds as DIP when the shell omits the label',
);

console.log('window native-screen bounds smoke ok');
