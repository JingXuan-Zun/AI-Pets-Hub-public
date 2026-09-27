import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const shellEffectsSource = readProjectFile(
  'src/components/pet/usePetContainerShellEffects.ts',
);
const windowManagerSource = readProjectFile('electron/windowManager.cjs');

assert.match(
  shellEffectsSource,
  /const isPetHitArea = isPetHitAreaElement\(target\);[\s\S]*if \(!isPetHitArea\) \{[\s\S]*setHoveredNativeInteractiveState\(true, false\);[\s\S]*applyPointerPassthrough\(false\);/u,
  'pet pointerdown should keep native-shape activation deferred until real drag movement',
);
assert.doesNotMatch(
  shellEffectsSource,
  /setHoveredNativeInteractiveState\(true, isPetHitAreaElement\(target\)\)/u,
  'pet pointerdown should not resample the native shape during the click prepare phase',
);
assert.match(
  windowManagerSource,
  /ensurePetDragFullWindowInteractiveShape\('active-session-(?:start|refresh)'\)/u,
  'the fixed full-window shape should begin only after the real-drag lifecycle reaches the main process',
);
assert.match(
  windowManagerSource,
  /mainWindow = new BrowserWindow\(\{[\s\S]*?transparent: true,[\s\S]*?focusable: false,[\s\S]*?title: 'AI Desktop Pet'/u,
  'the transparent pet overlay should not take Windows focus on the first click',
);

console.log('pet click shape stability smoke passed');
