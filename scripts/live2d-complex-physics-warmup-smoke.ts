import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS,
  LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES,
  warmLive2DComplexPhysicsRig,
} from '../src/components/pet/live2dComplexPhysicsWarmup';

const updates: Array<{ deltaMs: number; nowMs: number }> = [];
const warmed = warmLive2DComplexPhysicsRig({
  complexPhysicsRig: true,
  model: {
    internalModel: {
      update: (deltaMs, nowMs) => updates.push({ deltaMs, nowMs }),
    },
  },
  startNowMs: 1000,
});

assert.equal(warmed.completed, true);
assert.equal(warmed.frameCount, LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES);
assert.equal(updates.length, LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES);
assert.equal(updates[0].deltaMs, LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS);
assert.equal(updates[0].nowMs, 1000 + LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS);
assert.equal(
  updates.at(-1)?.nowMs,
  1000 + LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS * LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES,
);

let simpleRigUpdates = 0;
const skipped = warmLive2DComplexPhysicsRig({
  complexPhysicsRig: false,
  model: {
    internalModel: {
      update: () => {
        simpleRigUpdates += 1;
      },
    },
  },
  startNowMs: 0,
});
assert.equal(skipped.completed, false);
assert.equal(skipped.frameCount, 0);
assert.equal(simpleRigUpdates, 0);

const unsupported = warmLive2DComplexPhysicsRig({
  complexPhysicsRig: true,
  model: {},
  startNowMs: 0,
});
assert.equal(unsupported.completed, false);
assert.equal(unsupported.frameCount, 0);

const rendererSource = readFileSync(
  new URL('../src/components/pet/PetLive2DRenderer.tsx', import.meta.url),
  'utf8',
);
const disableAutoUpdateAt = rendererSource.indexOf('autoUpdate: false');
const warmupAt = rendererSource.indexOf('const physicsWarmup = warmLive2DComplexPhysicsRig');
const addToStageAt = rendererSource.indexOf('app.stage.addChild(model)');
const enableAutoUpdateAt = rendererSource.indexOf('model.autoUpdate = true');
assert.ok(disableAutoUpdateAt >= 0, 'model must load with automatic updates disabled');
assert.ok(warmupAt > disableAutoUpdateAt, 'complex Physics warmup must run after model load');
assert.ok(addToStageAt > warmupAt, 'complex Physics warmup must finish before the model becomes visible');
assert.ok(enableAutoUpdateAt > addToStageAt, 'automatic updates must resume after stage attachment');

console.log('live2d complex physics warmup smoke passed');
