import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS,
  LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES,
  warmLive2DComplexPhysicsRig,
} from '../src/components/pet/live2dComplexPhysicsWarmup';
import { readModuleProjectFile } from './projectModuleSource.mjs';

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

const rendererSource = readModuleProjectFile('src/components/pet/PetLive2DRenderer.tsx');
const disableAutoUpdateAt = rendererSource.indexOf('autoUpdate: false');
const warmupAt = rendererSource.indexOf('const physicsWarmup = warmLive2DComplexPhysicsRig');
const addToStageAt = rendererSource.indexOf('modelLayer.addChild(model)', warmupAt);
const keepAutoUpdateDisabledAt = rendererSource.indexOf('model.autoUpdate = false', addToStageAt);
const attachTickerAt = rendererSource.indexOf('attachLive2DModelToApplicationTicker(app, model, {', keepAutoUpdateDisabledAt);
const startApplicationAt = rendererSource.indexOf('app.start()', attachTickerAt);
assert.ok(disableAutoUpdateAt >= 0, 'model must load with automatic updates disabled');
assert.ok(warmupAt > disableAutoUpdateAt, 'complex Physics warmup must run after model load');
assert.ok(addToStageAt > warmupAt, 'complex Physics warmup must finish before the model becomes visible');
assert.ok(keepAutoUpdateDisabledAt > addToStageAt, 'model automatic updates must remain disabled after layer attachment');
assert.ok(attachTickerAt > keepAutoUpdateDisabledAt, 'shared application ticker must attach after warmup and layer attachment');
assert.ok(startApplicationAt > attachTickerAt, 'application must start after model ticker attachment');

console.log('live2d complex physics warmup smoke passed');
