import assert from 'node:assert/strict';
import { resolveLive2DStageFit } from '../src/components/pet/live2dModelFit';

const canvasBounds = { height: 1000, width: 600, x: 0, y: 0 };

const ordinaryModelFit = resolveLive2DStageFit({
  canvasBounds,
  drawableBounds: { height: 920, width: 560, x: 20, y: 40 },
  stageSize: 256,
});
assert.equal(ordinaryModelFit.useDrawableBounds, false);
assert.deepEqual(ordinaryModelFit.bounds, canvasBounds);

const standingModelFit = resolveLive2DStageFit({
  canvasBounds,
  drawableBounds: { height: 1110, width: 570, x: 15, y: 20 },
  stageSize: 256,
});
assert.equal(
  standingModelFit.useDrawableBounds,
  true,
  'visible feet outside the logical canvas must participate in stage fitting',
);
assert.deepEqual(standingModelFit.bounds, { height: 1110, width: 570, x: 15, y: 20 });
assert.ok(
  standingModelFit.scale < ordinaryModelFit.scale,
  'overflowing standing models should be scaled against the complete visible height',
);

const subPixelOverflowFit = resolveLive2DStageFit({
  canvasBounds,
  drawableBounds: { height: 1000.5, width: 600, x: 0, y: 0 },
  stageSize: 256,
});
assert.equal(
  subPixelOverflowFit.useDrawableBounds,
  false,
  'rounding noise at the canvas edge must not change ordinary model presentation',
);

const forcedCanvasFit = resolveLive2DStageFit({
  canvasBounds,
  drawableBounds: { height: 1110, width: 570, x: 15, y: 20 },
  fitMode: 'canvas',
  stageSize: 256,
});
assert.equal(forcedCanvasFit.useDrawableBounds, false);

const forcedVisibleFit = resolveLive2DStageFit({
  canvasBounds,
  drawableBounds: { height: 920, width: 560, x: 20, y: 40 },
  fitMode: 'visible',
  profileScale: 0.82,
  stageSize: 256,
});
assert.equal(forcedVisibleFit.useDrawableBounds, true);
assert.ok(
  forcedVisibleFit.scale < resolveLive2DStageFit({
    canvasBounds,
    drawableBounds: { height: 920, width: 560, x: 20, y: 40 },
    fitMode: 'visible',
    profileScale: 1,
    stageSize: 256,
  }).scale,
  'profile layout scale should multiply the selected fit result',
);

console.log('live2d model fit smoke passed');
