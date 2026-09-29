import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLive2DLookPosition } from '../src/components/pet/live2dPointerLookTarget';
import {
  resolvePetLayerDragFocusDelta,
  resolvePetLayerFocusTarget,
  resolvePetLayerMovementFocusTarget,
} from '../src/components/pet/petLayerMotionStateUtils';
import { resolveCompanionDragDelta } from '../src/pet-runtime/interactions/useCompanionPetInteractionController';
import { hasExceededPetDragActivationThreshold } from '../src/pet-runtime/interactions/petDragController';

const readSource = (path: string) => readFileSync(path, 'utf8');
const runtimeStateSource = readSource('src/components/pet/usePetContainerCompanionRuntimeState.ts');
const containerSource = readSource('src/components/PetContainer.tsx');
const renderPropsSource = readSource('src/components/pet/petContainerRenderProps.ts');
const runtimeLayerSource = readSource('src/components/pet/CompanionPetRuntimeLayer.tsx');
const companionLayerSource = readSource('src/components/pet/PetCompanionLayer.tsx');
const motionStateUtilsSource = readSource('src/components/pet/petLayerMotionStateUtils.ts');

assert.match(
  runtimeStateSource,
  /draggingCompanionPetId:\s*companionDragPreview\?\.petId\s*\?\?\s*null/,
  'companion drag identity must come from React render state instead of only a mutable ref',
);
assert.match(
  containerSource,
  /createCompanionRuntimeLayerItems\(\{[\s\S]*draggingCompanionPetId,[\s\S]*draggingCompanionPetIdRef/,
  'PetContainer must pass both reactive drag identity and the motion-loop ref',
);
assert.match(
  renderPropsSource,
  /createCompanionRuntimeLayerItem\(\{[\s\S]*draggingCompanionPetId,[\s\S]*draggingCompanionPetIdRef/,
  'companion render props must preserve the reactive drag identity',
);
assert.match(
  runtimeLayerSource,
  /const isDragging = draggingCompanionPetId === slot\.id/,
  'each companion layer must derive visual drag state from the reactive pet id',
);
assert.doesNotMatch(
  runtimeLayerSource,
  /isDragging=\{draggingCompanionPetIdRef\?\.current === slot\.id\}/,
  'the Live2D visual layer must not read its only drag state from a mutable ref',
);
assert.match(
  runtimeLayerSource,
  /<PetCompanionLayer[\s\S]*dragDelta=\{companionDragDelta\}/,
  'the companion runtime layer must pass the pointer-move delta into its visual layer',
);
assert.match(
  companionLayerSource,
  /usePetLayerMotionState\(\{[\s\S]*dragDelta,[\s\S]*isDragging/,
  'the companion visual layer must pass explicit drag delta into focus calculation',
);
assert.match(
  motionStateUtilsSource,
  /targetMagnitude = LIVE2D_MAX_DRAG_FOCUS_MAGNITUDE/u,
  'Live2D drag focus should use a fixed directional magnitude instead of per-frame drag speed',
);
assert.match(
  readSource('src/pet-runtime/interactions/useCompanionPetInteractionController.ts'),
  /Let React commit the final direction while the visual layer is still/u,
  'companion drag release must preserve the final visual delta for one committed frame',
);

const pointerMoveDelta = resolveCompanionDragDelta(
  { x: 80, y: 70 },
  { x: 98, y: 64 },
);
assert.deepEqual(pointerMoveDelta, { x: 18, y: -6 });
assert.equal(
  hasExceededPetDragActivationThreshold({ x: 0, y: 0 }, { x: 0.8, y: 0 }, 1),
  false,
  'sub-threshold companion movement should remain a click until it reaches the companion threshold',
);
assert.equal(
  hasExceededPetDragActivationThreshold({ x: 0, y: 0 }, { x: 1, y: 0 }, 1),
  true,
  'companion dragging should activate at the reduced 1px threshold',
);
const dragFocusTarget = resolvePetLayerMovementFocusTarget({
  dragHandoffFocusTarget: pointerMoveDelta,
  isDragging: true,
  modelType: 'live2d',
  movementFocusTarget: null,
});
assert.deepEqual(dragFocusTarget, { x: 18, y: -6 });
assert.equal(
  resolveLive2DLookPosition({ focusTarget: dragFocusTarget, pointerLookTarget: null }).source,
  'focus',
  'a dragged companion direction must reach Live2D as a focus look input',
);
const smallPointerMoveDelta = resolveCompanionDragDelta(
  { x: 98, y: 64 },
  { x: 99, y: 63.25 },
);
const preciseFocusTarget = resolvePetLayerFocusTarget('live2d', smallPointerMoveDelta);
assert.deepEqual(preciseFocusTarget, { x: 1, y: -0.75 });
assert.deepEqual(
  resolveLive2DLookPosition({ focusTarget: preciseFocusTarget, pointerLookTarget: null }),
  { source: 'focus', x: 0.04, y: 0.01625 },
  'a high-frequency sub-4px companion drag must still produce a visible Live2D focus target',
);
const slowDragFocusDelta = resolvePetLayerDragFocusDelta('live2d', {
  x: 0.08,
  y: -0.06,
});
assert.ok(Math.abs(Math.hypot(slowDragFocusDelta.x, slowDragFocusDelta.y) - 24) < 0.000001);
assert.deepEqual(
  resolvePetLayerFocusTarget(
    'live2d',
    slowDragFocusDelta,
  ),
  { x: 19.25, y: -14.5 },
  'a slow sub-pixel companion drag must retain its direction at the unified maximum magnitude',
);

console.log('live2d companion drag look smoke passed');
