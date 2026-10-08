import assert from 'node:assert/strict';
import { resolve3DStableLayoutVisualBounds, type PetVisualBounds } from '../src/components/pet/petVisualBounds';
import {
  areMeasuredPetVisualBoundsEqual,
  resolveMeasuredPetVisualBounds,
} from '../src/components/pet/usePetVisualBoundsMeasurement';
import { reduceAvatarRuntimeEventSummaryByPetId } from '../src/pet-runtime/avatar-runtime/avatarRuntimeEventState';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const measuredBounds: PetVisualBounds = {
  bottom: 80,
  left: 160,
  right: 144,
  top: 260,
};

assert.deepEqual(
  resolveMeasuredPetVisualBounds({
    avatar3dRuntimeBackend: 'three',
    bounds: measuredBounds,
    isDragging: false,
    modelType: '2d',
    scale: 1,
    visualRendererIsMoving: false,
  }),
  {
    interactiveVisualBounds: measuredBounds,
    latestVisualBounds: measuredBounds,
    windowShapeVisualBounds: measuredBounds,
  },
  '2D measured visual bounds should feed interaction, latest, and native window shape unchanged',
);

const expectedStable3DLayoutBounds = resolve3DStableLayoutVisualBounds(measuredBounds, 1.2, true);
assert.deepEqual(
  resolveMeasuredPetVisualBounds({
    avatar3dRuntimeBackend: 'three',
    bounds: measuredBounds,
    isDragging: false,
    modelType: '3d',
    scale: 1.2,
    visualRendererIsMoving: true,
  }),
  {
    interactiveVisualBounds: expectedStable3DLayoutBounds,
    latestVisualBounds: expectedStable3DLayoutBounds,
    windowShapeVisualBounds: measuredBounds,
  },
  'Three 3D should use stable layout bounds for interaction while keeping raw measured bounds for native window shape',
);

assert.deepEqual(
  resolveMeasuredPetVisualBounds({
    avatar3dRuntimeBackend: 'unity',
    bounds: measuredBounds,
    isDragging: true,
    modelType: '3d',
    scale: 1,
    visualRendererIsMoving: false,
  }),
  null,
  'Unity 3D drag should hold previous measured bounds to avoid shape jitter',
);

assert.deepEqual(
  resolveMeasuredPetVisualBounds({
    avatar3dRuntimeBackend: 'three',
    bounds: measuredBounds,
    isDragging: true,
    modelType: 'live2d',
    scale: 1,
    visualRendererIsMoving: false,
  }),
  null,
  'Live2D drag should hold previous measured bounds to avoid shape jitter',
);

const firstMeasuredVisualBounds = resolveMeasuredPetVisualBounds({
  avatar3dRuntimeBackend: 'three',
  bounds: measuredBounds,
  isDragging: false,
  modelType: 'live2d',
  scale: 1,
  visualRendererIsMoving: false,
});
const repeatedMeasuredVisualBounds = resolveMeasuredPetVisualBounds({
  avatar3dRuntimeBackend: 'three',
  bounds: { ...measuredBounds },
  isDragging: false,
  modelType: 'live2d',
  scale: 1,
  visualRendererIsMoving: false,
});

assert.equal(
  areMeasuredPetVisualBoundsEqual(firstMeasuredVisualBounds, repeatedMeasuredVisualBounds),
  true,
  'duplicate Live2D fallback visual bounds should be detectable before notifying container state',
);

const visualBoundsMeasurementSource = readProjectFile('src/components/pet/usePetVisualBoundsMeasurement.ts');
const visualRendererSource = readProjectFile('src/components/pet/PetVisualRenderer.tsx');
const live2DRendererSource = readModuleProjectFile('src/components/pet/PetLive2DRenderer.tsx');

assert.match(
  visualBoundsMeasurementSource,
  /measurementKey = createMeasuredVisualBoundsKey\(modelType, modelUrl\)[\s\S]*currentMeasuredVisualBounds = measuredVisualBounds\.measurementKey === measurementKey[\s\S]*: EMPTY_MEASURED_VISUAL_BOUNDS_STATE/,
  'model switches should invalidate measured bounds during render so old 2D/3D shapes cannot clip a newly selected Live2D model',
);

assert.match(
  visualBoundsMeasurementSource,
  /areMeasuredPetVisualBoundsEqual\(currentBoundsForModel, nextMeasuredVisualBounds\)[\s\S]*return;/,
  'unchanged visual bounds should not notify the container and re-sync native interactive regions',
);

assert.match(
  visualRendererSource,
  /<PetLive2DRenderer[\s\S]*isDragging=\{isDragging\}/,
  'Live2D renderer should receive drag state from the visual renderer',
);

assert.match(
  live2DRendererSource,
  /target:\s*dragSettledPointerLookTarget[\s\S]*const dragSettledPointerLookTarget = resolveLive2DDragSettledPointerLookTarget\(\{[\s\S]*shouldSettle:\s*shouldSettleLive2DLook[\s\S]*const shouldUseDragSettleCenter = shouldUseLive2DDragSettleCenter\(\s*shouldSettleLive2DLook,\s*dragSettledFocusTarget,?\s*\)/,
  'Live2D drag and post-drag settle should pause outer pointer-look visual transforms to avoid release-time jitter',
);

assert.match(
  live2DRendererSource,
  /emitLive2DFallbackBounds\(\{[\s\S]*useEffect\(\(\) => \{[\s\S]*if \(isDragging\) \{[\s\S]*return;[\s\S]*\}[\s\S]*emitFallbackBoundsWhenChanged\(state, values\);[\s\S]*\}, \[[^\]]*isDragging[^\]]*\]\);/,
  'Live2D drag should not emit fallback visual bounds because container bounds updates can resize or reclamp the shell mid-drag',
);

assert.match(
  live2DRendererSource,
  /lastEmissionSignatureRef[\s\S]*createLive2DFallbackBoundsSignature[\s\S]*state\.lastEmissionSignatureRef\.current === fallbackBoundsSignature[\s\S]*return;/,
  'Live2D fallback visual bounds should only emit when the fallback bounds signature changes',
);

assert.match(
  live2DRendererSource,
  /state\.lastEmissionSignatureRef\.current = '';[\s\S]*if \(isDragging\) \{[\s\S]*resetFallbackBoundsWhileDragging\(state, values\);[\s\S]*return;/,
  'Live2D fallback visual bounds signature should reset during drag so release restores native shape once',
);

const visualBoundsEvent = {
  bounds: measuredBounds,
  petId: 'primary',
  runtimeKind: 'three',
  source: 'measured',
  type: 'visual-bounds',
} as const;
const firstRuntimeSummary = reduceAvatarRuntimeEventSummaryByPetId({}, visualBoundsEvent, 1000);
const repeatedRuntimeSummary = reduceAvatarRuntimeEventSummaryByPetId(
  firstRuntimeSummary,
  visualBoundsEvent,
  2000,
);

assert.equal(
  repeatedRuntimeSummary,
  firstRuntimeSummary,
  'duplicate visual-bounds events should not replace the summary object and trigger timestamp-only React updates',
);
assert.equal(
  repeatedRuntimeSummary.primary.lastVisualBoundsAt,
  1000,
  'duplicate visual-bounds events should keep the original visual bounds timestamp',
);

console.log('pet-visual-bounds-measurement smoke passed');
