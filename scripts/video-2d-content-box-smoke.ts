import assert from 'node:assert/strict';
import { resolveVideo2DVisualBounds } from '../src/components/pet/video2dVisualBounds';
import { areVideoContentBoxesEqual, unionVideoContentBoxes } from '../src/components/pet/video2dContentBox';

// A 640x360 (wide) video drawn in a 256x256 pet canvas: the frame is 256x144, centered.
const containerRect = { left: 0, top: 0, width: 256, height: 256 };
const videoRect = { left: 0, top: 0, width: 256, height: 256 };
const source = { sourceWidth: 640, sourceHeight: 360 };

const wholeFrame = resolveVideo2DVisualBounds({ containerRect, videoRect, ...source });
assert.deepEqual(wholeFrame, { left: 128, right: 128, top: 72, bottom: 72 }, 'without a content box the whole frame counts');

// The character only fills the middle of the frame (x 25%-75%, y 10%-90%).
const contentBox = { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 };
const character = resolveVideo2DVisualBounds({ containerRect, videoRect, contentBox, ...source });
assert.deepEqual(character, { left: 64, right: 64, top: 58, bottom: 58 }, 'bounds shrink to the opaque character box');

// Off-center character: bounds must stay asymmetric so the clamp matches each side.
const offCenter = resolveVideo2DVisualBounds({
  containerRect, videoRect, ...source,
  contentBox: { left: 0.5, top: 0.2, right: 0.9, bottom: 1 },
});
assert.deepEqual(offCenter, { left: 1, right: 103, top: 44, bottom: 72 }, 'an off-center character keeps per-side extents');

// Unioning samples covers the whole motion; equality ignores identical boxes.
const merged = unionVideoContentBoxes({ left: 0.3, top: 0.2, right: 0.6, bottom: 0.9 }, { left: 0.25, top: 0.25, right: 0.7, bottom: 0.85 });
assert.deepEqual(merged, { left: 0.25, top: 0.2, right: 0.7, bottom: 0.9 });
assert.equal(areVideoContentBoxesEqual(merged, { ...merged }), true);
assert.equal(areVideoContentBoxesEqual(merged, null), false);

console.log('video 2d content box smoke ok');
