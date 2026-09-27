import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePetPointerLookStrength } from '../src/pet-runtime/interactions/petPointerLookPriority';

const dragStrength = resolvePetPointerLookStrength({
  action: 'SLEEPING',
  expressionAction: 'SAD',
  isDragging: true,
  isMoving: true,
  manualMotionActive: true,
} as Parameters<typeof resolvePetPointerLookStrength>[0] & { isDragging: boolean });

assert.equal(
  dragStrength,
  1,
  'dragging must force the same full look strength for primary and companion Live2D pets',
);

const releaseSettleStrength = resolvePetPointerLookStrength({
  action: 'IDLE',
  isDragging: false,
  isDragLookSettling: true,
  isMoving: true,
});
assert.equal(
  releaseSettleStrength,
  1,
  'the 900ms drag-release settle must keep full look strength while movement is still true',
);

const ordinaryMovingStrength = resolvePetPointerLookStrength({
  action: 'IDLE',
  isDragging: false,
  isMoving: true,
});
assert.equal(
  ordinaryMovingStrength,
  0.72,
  'ordinary movement without drag settling must retain reduced look strength',
);

const rendererSource = readFileSync('src/components/pet/PetLive2DRenderer.tsx', 'utf8');
assert.match(
  rendererSource,
  /resolvePetPointerLookStrength\(\{[\s\S]*isDragLookSettling:\s*shouldSettleLive2DLook\s*&&\s*Boolean\(dragSettledFocusTarget\)/,
  'the Live2D renderer must keep drag-release settling at full look strength',
);

console.log('live2d drag look priority smoke passed');
