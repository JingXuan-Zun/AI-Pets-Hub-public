import assert from 'node:assert/strict';
import { resolveLive2DRuntimeProfile } from '../src/pet-runtime/live2d/live2dRuntimeProfile';

let nowMs = 0;
let fallbackFrame: ((timestampMs: number) => void) | null = null;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    cancelAnimationFrame: () => { fallbackFrame = null; },
    performance: { now: () => nowMs },
    requestAnimationFrame: (callback: (timestampMs: number) => void) => {
      fallbackFrame = callback;
      return 1;
    },
  },
});

const { createLive2DMouthRuntimeController } = await import(
  '../src/components/pet/live2dMouthRuntimeController'
);

const writes: number[] = [];
let beforeModelUpdate: ((timestampMs?: number) => void) | null = null;
const coreModel = {
  getParameterDefaultValue: () => 0,
  getParameterIndex: (id: string) => id === 'ParamMouthOpenY' ? 0 : -1,
  getParameterMaximumValue: () => 1,
  setParameterValueByIndex: (_index: number, value: number) => writes.push(value),
};
const internalModel = {
  coreModel,
  off: () => { beforeModelUpdate = null; },
  on: (_eventName: string, listener: (timestampMs?: number) => void) => {
    beforeModelUpdate = listener;
  },
  removeListener: () => { beforeModelUpdate = null; },
};
const runtimeProfile = resolveLive2DRuntimeProfile({ coreModel });
const controller = createLive2DMouthRuntimeController(
  { internalModel },
  { modelUrl: 'mock.model3.json', petId: 'mouth-controller-smoke', runtimeProfile },
);
assert.ok(controller);
assert.ok(beforeModelUpdate);

controller.setState({ isTyping: true, latestMessage: 'hello', visible: true });
nowMs = 60;
fallbackFrame?.(nowMs);
assert.ok((writes.at(-1) ?? 0) > 0, 'typing should open the mouth without voice playback');

controller.setState({ isTyping: false, visible: false });
nowMs = 180;
beforeModelUpdate?.(nowMs);
assert.ok((writes.at(-1) ?? 1) < (writes.at(-2) ?? 0), 'mouth should release smoothly');

controller.destroy();
assert.equal(writes.at(-1), 0, 'destroy should restore the mouth default');
assert.equal(beforeModelUpdate, null);

const unavailableProfile = resolveLive2DRuntimeProfile({
  coreModel: { getParameterIndex: () => -1 },
});
assert.equal(createLive2DMouthRuntimeController(
  { internalModel },
  { modelUrl: 'mock.model3.json', petId: 'missing-mouth', runtimeProfile: unavailableProfile },
), null);

console.log('live2d mouth runtime controller smoke passed');
