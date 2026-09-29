import assert from 'node:assert/strict';
import {
  resolveAvatar3DLookAtInput,
  resolveAvatar3DLookAtFocusTarget,
  resolveAvatar3DLookAtProfile,
  resolveNormalizedAvatar3DLookAtFocusTarget,
} from '../src/pet-runtime/avatar3d/avatar3dLookAtController';
import { type Avatar3DRuntimeFrameState } from '../src/pet-runtime/avatar3d/avatar3dRuntimeInstance';
import { resolvePetPointerLookHoverState } from '../src/pet-runtime/interactions/petPointerLookInputGate';

const baseFrameState: Avatar3DRuntimeFrameState = {
  focusTarget: { x: 12, y: -10 },
  hoverState: {
    activeRegion: null,
    focusTarget: null,
    supportedRegions: ['head', 'body', 'handL', 'handR'],
  },
};

const hoverPriorityState: Avatar3DRuntimeFrameState = {
  ...baseFrameState,
  hoverState: {
    activeRegion: 'body',
    focusTarget: { x: -18, y: 22 },
    supportedRegions: ['head', 'body', 'handL', 'handR'],
  },
};

assert.deepEqual(
  resolveAvatar3DLookAtFocusTarget(hoverPriorityState),
  { x: -18, y: 22 },
  'hover focus target should override base focus target when a region is active',
);

assert.deepEqual(
  resolveAvatar3DLookAtInput(hoverPriorityState),
  {
    source: 'focus',
    target: { x: -18, y: 22 },
  },
  'hover active region should stay the focus fallback before base focus target',
);

const pointerLookDisabledHoverState = resolvePetPointerLookHoverState(hoverPriorityState.hoverState!, false);
assert.deepEqual(
  resolveAvatar3DLookAtInput({
    ...hoverPriorityState,
    focusTarget: null,
    hoverState: pointerLookDisabledHoverState,
    pointerLookTarget: null,
  }),
  {
    source: 'center',
    target: null,
  },
  'disabled pointer look should prevent hover focus from driving 3D look-at',
);
assert.deepEqual(
  resolveAvatar3DLookAtInput({
    ...hoverPriorityState,
    hoverState: pointerLookDisabledHoverState,
    pointerLookTarget: null,
  }),
  {
    source: 'focus',
    target: baseFrameState.focusTarget,
  },
  'disabled pointer look should still allow non-hover focus targets such as movement or vision',
);

assert.deepEqual(
  resolveAvatar3DLookAtInput({
    ...hoverPriorityState,
    pointerLookTarget: { x: 28, y: -42 },
  }),
  {
    source: 'pointer',
    target: { x: 28, y: -42 },
  },
  'pointer look should keep priority over hover active region focus',
);

assert.deepEqual(
  resolveAvatar3DLookAtInput({
    ...hoverPriorityState,
    pointerLookTarget: { x: Number.NaN, y: -42 },
  }),
  {
    source: 'focus',
    target: { x: -18, y: 22 },
  },
  'invalid pointer look should not suppress hover active region focus',
);

const bodyProfile = resolveAvatar3DLookAtProfile(hoverPriorityState);
assert.equal(bodyProfile.focusLerp, 0.16, 'body region should use body-specific focus lerp');
assert.equal(bodyProfile.horizontalScale, 0.68, 'body region should reduce horizontal look-at scale');
assert.equal(bodyProfile.verticalScale, 0.42, 'body region should reduce vertical look-at scale');

const normalizedHoverTarget = resolveNormalizedAvatar3DLookAtFocusTarget(hoverPriorityState);
assert.ok(normalizedHoverTarget, 'normalized hover target should exist');
assert.ok(normalizedHoverTarget!.x < 0, 'hover target x should preserve direction');
assert.ok(normalizedHoverTarget!.y < 0, 'hover target y should preserve inverted screen-space direction');

const fallbackNormalizedTarget = resolveNormalizedAvatar3DLookAtFocusTarget(baseFrameState);
assert.ok(fallbackNormalizedTarget, 'base focus target should still normalize without hover');
assert.ok(fallbackNormalizedTarget!.x > 0, 'base focus target x should use direct focus target');

const pointerNormalizedTargetFromSameRawFocus = resolveNormalizedAvatar3DLookAtFocusTarget({
  ...baseFrameState,
  focusTarget: null,
  pointerLookTarget: baseFrameState.focusTarget,
});
assert.ok(pointerNormalizedTargetFromSameRawFocus, 'pointer target should normalize from the same raw focus target');
assert.ok(
  fallbackNormalizedTarget!.x < pointerNormalizedTargetFromSameRawFocus!.x,
  `focus fallback should be softer than pointer look horizontally, got focus=${fallbackNormalizedTarget!.x} pointer=${pointerNormalizedTargetFromSameRawFocus!.x}`,
);
assert.ok(
  Math.abs(fallbackNormalizedTarget!.y) < Math.abs(pointerNormalizedTargetFromSameRawFocus!.y),
  `focus fallback should be softer than pointer look vertically, got focus=${fallbackNormalizedTarget!.y} pointer=${pointerNormalizedTargetFromSameRawFocus!.y}`,
);

const faceAreaNormalizedTarget = resolveNormalizedAvatar3DLookAtFocusTarget({
  ...baseFrameState,
  pointerLookTarget: { x: 0, y: -24 },
});
assert.ok(faceAreaNormalizedTarget, 'face-area pointer target should normalize');
assert.equal(faceAreaNormalizedTarget!.y, 0, 'head-horizon pointer target should stay level');

const topEdgeNormalizedTarget = resolveNormalizedAvatar3DLookAtFocusTarget({
  ...baseFrameState,
  pointerLookTarget: { x: 0, y: -42 },
});
assert.ok(topEdgeNormalizedTarget, 'top-edge pointer target should normalize');
assert.ok(
  topEdgeNormalizedTarget!.y > 0.8 && topEdgeNormalizedTarget!.y <= 0.9,
  `top-edge pointer target should restore the natural upward range from the head horizon, got ${topEdgeNormalizedTarget!.y}`,
);

console.log('avatar3d lookAt smoke ok');
