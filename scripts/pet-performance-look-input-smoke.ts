import assert from 'node:assert/strict';
import { resolvePetPerformanceLookInput } from '../src/pet-runtime/interactions/petPerformanceLookInput';

assert.deepEqual(
  resolvePetPerformanceLookInput({
    focusTarget: { x: -16, y: 24 },
    pointerLookTarget: { x: 28, y: -42 },
  }),
  {
    source: 'pointer',
    target: { x: 28, y: -42 },
  },
  'pointer look target should outrank focus fallback',
);

assert.deepEqual(
  resolvePetPerformanceLookInput({
    focusTarget: { x: -16, y: 24 },
    pointerLookTarget: null,
  }),
  {
    source: 'focus',
    target: { x: -16, y: 24 },
  },
  'focus target should be used when pointer look target is absent',
);

assert.deepEqual(
  resolvePetPerformanceLookInput({
    focusTarget: { x: -16, y: 24 },
    pointerLookTarget: { x: Number.NaN, y: -42 },
  }),
  {
    source: 'focus',
    target: { x: -16, y: 24 },
  },
  'invalid pointer look target should not suppress a valid focus fallback',
);

assert.deepEqual(
  resolvePetPerformanceLookInput({
    focusTarget: { x: Number.POSITIVE_INFINITY, y: 24 },
    pointerLookTarget: undefined,
  }),
  {
    source: 'center',
    target: null,
  },
  'invalid focus target should resolve to center when no valid pointer exists',
);

assert.deepEqual(
  resolvePetPerformanceLookInput({}),
  {
    source: 'center',
    target: null,
  },
  'missing look inputs should resolve to center',
);

console.log('pet performance look input smoke ok');
