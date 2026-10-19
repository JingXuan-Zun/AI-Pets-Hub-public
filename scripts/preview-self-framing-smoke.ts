import assert from 'node:assert/strict';
import { resolvePreviewFramingStep } from '../src/pet-runtime/avatar3d/usePreviewSelfFraming';

// A 300 px tall preview, camera 3 units away, 45° vertical field of view.
const step = (top: number, bottom: number) => resolvePreviewFramingStep({ bottom, left: 50, right: 50, top }, 300, 3, 45);

assert.equal(step(110, 110), null, 'centred and fitting: nothing to do');
const low = step(80, 150);
assert.ok(low && low.shiftY < 0, 'drawn low and cut at the bottom: the camera comes down');
assert.ok(low && low.distanceScale >= 1.2, 'clipped: back off to see the rest');
const high = step(140, 60);
assert.ok(high && high.shiftY > 0, 'drawn high: the camera goes up');
assert.equal(high?.distanceScale, 1, 'fits, only off-centre: no zoom');
const big = step(140, 140);
assert.ok(big && big.distanceScale > 1 && Math.abs(big.shiftY) < 1e-9, 'too tall but centred: zoom out only');
// The canvas is 124% of the card: judged by the 300 px the card shows, not the 372 px canvas.
const inCard = resolvePreviewFramingStep({ bottom: 150, left: 50, right: 50, top: 90 }, 372, 3, 45, 300);
assert.ok(inCard && inCard.shiftY < 0 && inCard.distanceScale >= 1.2, 'feet at the card edge count as cut');
console.log('preview self framing smoke ok');
