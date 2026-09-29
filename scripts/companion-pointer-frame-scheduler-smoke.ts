import assert from 'node:assert/strict';
import { createPointerFrameScheduler } from '../src/pet-runtime/interactions/pointerFrameScheduler';

let nextFrameId = 0;
const callbacks = new Map<number, FrameRequestCallback>();
Object.assign(globalThis, {
  window: {
    cancelAnimationFrame: (id: number) => callbacks.delete(id),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      nextFrameId += 1;
      callbacks.set(nextFrameId, callback);
      return nextFrameId;
    },
  },
});

const appliedValues: Array<{ x: number; y: number }> = [];
const scheduler = createPointerFrameScheduler((value: { x: number; y: number }) => {
  appliedValues.push(value);
});
scheduler.push({ x: 1, y: 1 });
scheduler.push({ x: 3, y: 4 });
assert.equal(callbacks.size, 1, 'pointer moves should share one scheduled animation frame');
callbacks.values().next().value?.(16);
assert.deepEqual(
  appliedValues,
  [{ x: 3, y: 4 }],
  'the frame scheduler should apply only the latest diagonal pointer position',
);

scheduler.push({ x: 5, y: 8 });
scheduler.flush();
assert.deepEqual(appliedValues.at(-1), { x: 5, y: 8 });
assert.equal(callbacks.size, 0, 'flush should cancel the pending animation frame');

console.log('companion pointer frame scheduler smoke passed');
