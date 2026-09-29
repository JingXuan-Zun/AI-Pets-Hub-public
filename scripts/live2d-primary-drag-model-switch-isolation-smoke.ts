import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePetLayerDragFocusDelta } from '../src/components/pet/petLayerMotionStateUtils';
import { resolveLive2DLookPosition } from '../src/components/pet/live2dPointerLookTarget';
import { resolvePetDragVisualPreviewDelta } from '../src/pet-runtime/interactions/petDragVisualPreview';

const previewDelta = resolvePetDragVisualPreviewDelta({
  position: { x: 108, y: 92 },
  previousPosition: { x: 100, y: 100 },
});
const dragFocus = resolvePetLayerDragFocusDelta('live2d', previewDelta);
const lookPosition = resolveLive2DLookPosition({
  focusTarget: dragFocus,
  pointerLookTarget: null,
});
assert.equal(lookPosition.source, 'focus');
assert.ok(
  Math.abs(lookPosition.x) > 0 && Math.abs(lookPosition.y) > 0,
  'diagonal primary drag must preserve both Live2D look axes',
);

const containerSource = readFileSync('src/components/PetContainer.tsx', 'utf8');
const avatarLayerSource = readFileSync('src/components/pet/PetAvatarLayer.tsx', 'utf8');
const primaryDragControllerSource = readFileSync('src/pet-runtime/interactions/petDragController.ts', 'utf8');
const rosterSource = readFileSync('src/multiPetRoster.ts', 'utf8');
assert.match(
  rosterSource,
  /pet\.id === slotId[\s\S]*modelUrl: updates\.modelUrl \?\? pet\.modelUrl/,
  'companion model selection must stay scoped to the selected slot',
);
assert.match(
  containerSource,
  /previewPosition\(\s*preview\.position,\s*preview\.previousPosition/,
  'primary drag preview must preserve both positions instead of dropping frame direction',
);
assert.match(
  avatarLayerSource,
  /usePetLayerMotionState\(\{[\s\S]*dragDelta:\s*primaryDragDelta,[\s\S]*isDragging/,
  'primary Live2D motion state must consume explicit per-frame drag direction',
);
assert.match(
  primaryDragControllerSource,
  /const releaseVisualDragFrameIdRef = useRef<number \| null>\(null\)[\s\S]*if \(dragState\.kind === 'pet' && dragMovedRef\.current\)[\s\S]*requestAnimationFrame\([\s\S]*setIsPetDragActive\(false\)/u,
  'primary drag release must leave one committed visual frame for the final Live2D direction',
);

console.log('live2d primary drag model-switch isolation smoke passed');
