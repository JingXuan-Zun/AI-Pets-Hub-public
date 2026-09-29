import assert from 'node:assert/strict';
import {
  resolveNextMovementFocusTarget,
  resolvePetLayerMovementFocusTarget,
  resolvePetLayerFocusTarget,
  resolvePetLayerDragFocusDelta,
  resolvePetLayerRawFocusTarget,
  resolvePetMovementFocusPositionUpdate,
  resolveMovementFocusTargetHoldMs,
  shouldIgnoreLive2DIdlePositionFocus,
  shouldSuppressMovementFocusAfterDragHandoff,
  shouldExpireMovementFocusTargetForModelType,
} from '../src/components/pet/petLayerMotionStateUtils';

const diagonalDragFocus = resolvePetLayerDragFocusDelta('live2d', { x: 1, y: 1 });
assert.ok(
  Math.abs(Math.hypot(diagonalDragFocus.x, diagonalDragFocus.y) - 24) < 0.001,
  'short diagonal Live2D drags should use the unified maximum direction magnitude',
);
assert.ok(
  diagonalDragFocus.x > 16.9 && diagonalDragFocus.y > 16.9,
  'diagonal amplification must preserve both axes instead of selecting one axis',
);

assert.deepEqual(
  resolvePetLayerFocusTarget('live2d', { x: 1, y: -0.75 }),
  { x: 1, y: -0.75 },
  'Live2D final focus normalization must preserve sub-4px companion drag deltas',
);

assert.deepEqual(
  resolvePetLayerFocusTarget('3d', { x: 1, y: -0.75 }),
  { x: 0, y: 0 },
  'Live2D focus precision must not change the shared 3D quantization policy',
);

assert.equal(
  resolvePetLayerMovementFocusTarget({
    dragHandoffFocusTarget: null,
    isDragging: true,
    modelType: 'live2d',
    movementFocusTarget: { x: 124, y: 108 },
  }),
  null,
  'a new Live2D drag should synchronously hide the previous release focus before its timer expires',
);

assert.deepEqual(
  resolvePetLayerMovementFocusTarget({
    dragHandoffFocusTarget: { x: 18, y: -6 },
    isDragging: true,
    modelType: 'live2d',
    movementFocusTarget: null,
  }),
  { x: 18, y: -6 },
  'Live2D should use the current drag direction as a transient head-look target while dragging',
);

assert.deepEqual(
  resolvePetMovementFocusPositionUpdate({
    delta: { x: 0, y: 0 },
    isDragging: true,
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: false,
  }),
  { type: 'clear' },
  'a new Live2D drag should cancel the previous release focus and expiry timer',
);

assert.equal(
  resolveMovementFocusTargetHoldMs('live2d'),
  900,
  'Live2D drag direction feedback should retain the shared movement focus hold',
);

assert.equal(
  resolveMovementFocusTargetHoldMs('3d'),
  900,
  'Live2D timing tuning should not change the existing 3D movement focus hold',
);

assert.deepEqual(
  resolvePetMovementFocusPositionUpdate({
    delta: { x: 12, y: -8 },
    isDragging: false,
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: false,
  }),
  { type: 'preserve' },
  'Live2D idle position corrections should preserve an active drag-release focus and its expiry timer',
);

assert.deepEqual(
  resolvePetMovementFocusPositionUpdate({
    delta: { x: 12, y: -8 },
    isDragging: false,
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: true,
  }),
  { target: { x: 12, y: -8 }, type: 'set' },
  'Live2D drag release should still establish a meaningful direction focus',
);

assert.deepEqual(
  resolvePetMovementFocusPositionUpdate({
    delta: { x: 0, y: 0 },
    isDragging: false,
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: true,
  }),
  { type: 'clear' },
  'Live2D drag release without a meaningful direction should clear stale focus',
);

assert.deepEqual(
  resolvePetMovementFocusPositionUpdate({
    delta: { x: 0, y: 0 },
    dragFocusTarget: { x: -16, y: 8 },
    isDragging: false,
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: true,
  }),
  { target: { x: -16, y: 8 }, type: 'set' },
  'Live2D drag release should retain the last meaningful drag direction when pointer-up has no new delta',
);

assert.deepEqual(
  resolvePetMovementFocusPositionUpdate({
    delta: { x: 1, y: 0 },
    dragFocusTarget: { x: 24, y: 0 },
    isDragging: false,
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: true,
  }),
  { target: { x: 24, y: 0 }, type: 'set' },
  'a late 1px release commit must not replace the unified maximum Live2D drag direction',
);

assert.deepEqual(
  resolvePetLayerRawFocusTarget({
    motionFocusTarget: { x: 80, y: 0 },
    movementFocusTarget: { x: 12, y: 4 },
    shouldAnimateAsMoving: true,
    visionTarget: { x: -30, y: 0 },
  }),
  { x: 12, y: 4 },
  'moving visuals should prefer the current movement focus when it has horizontal direction',
);

assert.deepEqual(
  resolvePetLayerRawFocusTarget({
    motionFocusTarget: { x: -80, y: 0 },
    movementFocusTarget: { x: 0.1, y: 4 },
    shouldAnimateAsMoving: true,
    visionTarget: { x: 30, y: 0 },
  }),
  { x: -80, y: 0 },
  'moving visuals should fall back to the motion target when movement focus has no horizontal direction',
);

assert.deepEqual(
  resolvePetLayerRawFocusTarget({
    motionFocusTarget: { x: -80, y: 0 },
    movementFocusTarget: null,
    shouldAnimateAsMoving: false,
    visionTarget: { x: 30, y: 0 },
  }),
  { x: 30, y: 0 },
  'idle visuals should ignore motion target and use vision target when no movement focus exists',
);

assert.equal(
  resolvePetLayerRawFocusTarget({
    modelType: 'live2d',
    motionFocusTarget: { x: -80, y: 0 },
    movementFocusTarget: null,
    shouldAnimateAsMoving: false,
    visionTarget: { x: 200, y: -150 },
  }),
  null,
  'Live2D idle visuals should not convert random vision targets into non-pointer focus glances',
);

assert.deepEqual(
  resolvePetLayerRawFocusTarget({
    modelType: 'live2d',
    motionFocusTarget: { x: 80, y: -40 },
    movementFocusTarget: { x: 20, y: -12 },
    shouldAnimateAsMoving: true,
    visionTarget: { x: 200, y: -150 },
  }),
  { x: 20, y: -12 },
  'Live2D should still preserve movement focus while moving',
);

assert.equal(
  shouldExpireMovementFocusTargetForModelType('2d'),
  false,
  '2D should keep the locked facing chain stable instead of expiring movement focus automatically',
);

assert.equal(
  shouldExpireMovementFocusTargetForModelType('3d'),
  true,
  '3D can expire stale movement focus for more natural look-at recovery',
);

assert.equal(
  shouldExpireMovementFocusTargetForModelType('live2d'),
  true,
  'Live2D can expire stale movement focus for more natural look-at recovery',
);

assert.equal(
  resolveNextMovementFocusTarget('3d', { x: 0.4, y: 0.3 }),
  null,
  '3D should ignore tiny movement deltas that quantize to center instead of snapping look-at back',
);

assert.deepEqual(
  resolveNextMovementFocusTarget('live2d', { x: -0.4, y: 0.3 }),
  { x: -0.5, y: 0.25 },
  'Live2D should preserve small drag movement for responsive look-at feedback',
);

assert.deepEqual(
  resolveNextMovementFocusTarget('2d', { x: 0.4, y: 0.3 }),
  { x: 0, y: 0 },
  '2D should preserve the existing locked movement focus behavior for tiny deltas',
);

assert.deepEqual(
  resolveNextMovementFocusTarget('3d', { x: 8.4, y: -3.2 }),
  { x: 8, y: -4 },
  '3D should still accept meaningful movement focus updates after runtime quantization',
);

assert.equal(
  shouldIgnoreLive2DIdlePositionFocus({
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: false,
  }),
  true,
  'Live2D scale or idle position corrections should not become head-look targets',
);

assert.equal(
  shouldIgnoreLive2DIdlePositionFocus({
    modelType: 'live2d',
    shouldAnimateAsMoving: false,
    wasDragging: true,
  }),
  false,
  'Live2D should retain a real drag-release direction handoff',
);

assert.equal(
  shouldSuppressMovementFocusAfterDragHandoff({
    isDragging: false,
    modelType: 'live2d',
    nextFocusTarget: null,
    wasDragging: true,
  }),
  true,
  'Live2D should ignore a drag handoff that does not produce a meaningful focus direction',
);

assert.equal(
  shouldSuppressMovementFocusAfterDragHandoff({
    isDragging: false,
    modelType: 'live2d',
    nextFocusTarget: { x: 16, y: -4 },
    wasDragging: true,
  }),
  false,
  'Live2D should preserve a meaningful drag-release direction as a short movement focus',
);

assert.equal(
  shouldSuppressMovementFocusAfterDragHandoff({
    isDragging: false,
    modelType: '3d',
    wasDragging: true,
  }),
  false,
  '3D drag handoff should keep its existing movement focus behavior',
);

assert.equal(
  shouldSuppressMovementFocusAfterDragHandoff({
    isDragging: false,
    modelType: 'live2d',
    wasDragging: false,
  }),
  false,
  'Live2D normal non-drag movement should still be able to update movement focus',
);

console.log('pet-layer-motion-state smoke passed');
