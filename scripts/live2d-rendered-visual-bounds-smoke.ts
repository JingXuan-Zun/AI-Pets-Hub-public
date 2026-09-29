import assert from 'node:assert/strict';
import {
  resolveLive2DRenderedVisualBounds,
  summarizeLive2DRenderedAlphaBounds,
} from '../src/components/pet/live2dRenderedVisualBounds';
import { clampPositionToActivityAreaBoundary } from '../src/components/pet/petActivityRegionMath';

const pixels = new Uint8Array(200 * 200 * 4);
for (let y = 20; y < 181; y += 1) {
  for (let x = 60; x < 141; x += 1) {
    pixels[(y * 200 + x) * 4 + 3] = 255;
  }
}

const summary = summarizeLive2DRenderedAlphaBounds(pixels, 200, 200);
assert.deepEqual(summary.bounds, {
  bottom: 180,
  height: 161,
  left: 60,
  right: 140,
  top: 20,
  width: 81,
});

const visualBounds = resolveLive2DRenderedVisualBounds({
  alphaBounds: summary.bounds,
  rendererHeight: 200,
  rendererWidth: 200,
  stageSize: 100,
});
assert.deepEqual(visualBounds, {
  bottom: 49,
  left: 22,
  right: 27,
  top: 41,
});

const area = { height: 400, width: 600, x: -300, y: -200 };
const clampedAtLeftEdge = clampPositionToActivityAreaBoundary(
  { x: -999, y: 0 },
  area,
  1,
  visualBounds,
);
assert.equal(
  clampedAtLeftEdge.x - visualBounds!.left,
  area.x,
  'the rendered left edge should be able to reach the activity-area boundary',
);

const highDpiBounds = resolveLive2DRenderedVisualBounds({
  alphaBounds: {
    bottom: 361,
    height: 322,
    left: 120,
    right: 281,
    top: 40,
    width: 162,
  },
  rendererHeight: 400,
  rendererWidth: 400,
  stageSize: 100,
});
assert.deepEqual(highDpiBounds, visualBounds, 'device-pixel resolution must not change CSS-space bounds');

console.log('live2d rendered visual bounds smoke passed');
