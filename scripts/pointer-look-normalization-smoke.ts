import assert from 'node:assert/strict';
import {
  POINTER_LOOK_HEAD_HORIZON_Y,
  resolvePointerLookNormalizedY,
  resolvePointerLookNormalizedTarget,
} from '../src/pet-runtime/interactions/pointerLookTargetNormalization';

const headHorizonOptions = {
  neutralY: POINTER_LOOK_HEAD_HORIZON_Y,
  yDivisor: 21,
};

assert.equal(resolvePointerLookNormalizedY(0, { yDivisor: 21 }), 0, 'legacy center baseline should stay level without a neutral offset');
assert.equal(resolvePointerLookNormalizedY(-24, headHorizonOptions), 0, 'head horizon should stay level');
assert.ok(
  resolvePointerLookNormalizedY(-28, headHorizonOptions) > 0,
  'area above the head horizon should naturally look upward',
);
assert.ok(
  resolvePointerLookNormalizedY(-42, headHorizonOptions) > 0.8
  && resolvePointerLookNormalizedY(-42, headHorizonOptions) <= 0.9,
  'top-edge target should use the stronger upward range from the head horizon',
);
assert.ok(
  resolvePointerLookNormalizedY(0, headHorizonOptions) < 0,
  'chest-area target should now sit below the visual horizon',
);

assert.deepEqual(
  resolvePointerLookNormalizedTarget(
    { x: 14, y: -24 },
    {
      neutralY: POINTER_LOOK_HEAD_HORIZON_Y,
      xDivisor: 14,
      yDivisor: 21,
    },
  ),
  { x: 1, y: 0 },
  'head-area target should preserve horizontal tracking while staying level',
);

console.log('pointer look normalization smoke ok');
