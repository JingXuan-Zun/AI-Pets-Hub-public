import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readModuleProjectFile } from './projectModuleSource.mjs';

let nowMs = 20;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    cancelAnimationFrame: () => {},
    location: { search: '' },
    performance: { now: () => nowMs },
    requestAnimationFrame: () => 1,
  },
});

const { createLive2DPointerLookRuntimeController } = await import(
  '../src/components/pet/live2dPointerLookRuntimeController'
);
const { resolveLive2DRuntimeProfile } = await import(
  '../src/pet-runtime/live2d/live2dRuntimeProfile'
);

const parameterIds = [
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ChestX_input',
  'ChestY_input',
  'ChestZ_input',
  'HeadAngleX',
  'HeadAngleY',
  'HeadAngleZ',
] as const;
type ParameterId = typeof parameterIds[number];

const values = new Map<ParameterId, number>(parameterIds.map((id) => [id, 0]));
const listeners = new Map<string, (timestampMs?: number) => void>();
let appliedSource = '';
const coreModel = {
  getParameterDefaultValue: () => 0,
  getParameterIndex: (id: string) => parameterIds.indexOf(id as ParameterId),
  getParameterMaximumValue: () => 30,
  getParameterMinimumValue: () => -30,
  getParameterValueByIndex: (index: number) => values.get(parameterIds[index] as ParameterId) ?? 0,
  setParameterValueByIndex: (index: number, value: number) => {
    const id = parameterIds[index];
    if (id) {
      values.set(id, value);
    }
  },
};
const internalModel = {
  coreModel,
  off: (eventName: string) => listeners.delete(eventName),
  on: (eventName: string, listener: (timestampMs?: number) => void) => listeners.set(eventName, listener),
  removeListener: (eventName: string) => listeners.delete(eventName),
};
const runtimeProfile = resolveLive2DRuntimeProfile({ coreModel });
assert.equal(runtimeProfile.capabilities.complexPhysicsRig, true);
assert.equal(runtimeProfile.capabilities.bodySway, false);

const controller = createLive2DPointerLookRuntimeController(
  { internalModel },
  {
    modelUrl: 'sample-model-b.model3.json',
    onDiagnosticFrame: (frame) => {
      appliedSource = frame.appliedSource;
    },
    petId: 'primary',
    runtimeProfile,
    startCenteredBeforeIdle: true,
  },
);
assert.ok(controller);
controller.updateInputTarget({ source: 'center', x: 0, y: 0 }, nowMs);
controller.applyImmediate();

assert.equal(appliedSource, 'center', 'a newly loaded model must start from a centered look frame');
assert.equal(values.get('HeadAngleX'), 0, 'model load must not inject a first-frame horizontal head angle');
assert.equal(values.get('HeadAngleY'), 0, 'model load must not inject a first-frame vertical head angle');

nowMs += 500;
listeners.get('beforeModelUpdate')?.(nowMs);
assert.equal(appliedSource, 'center', 'the model-load center hold should cover the initial physics settle');
controller.destroy();

const rendererSource = readModuleProjectFile('src/components/pet/PetLive2DRenderer.tsx');
assert.match(
  rendererSource,
  /bootstrapMode:\s*'model-load'/u,
  'model loading should create controllers in centered bootstrap mode',
);
assert.match(
  rendererSource,
  /bootstrapMode:\s*'preserve-input'/u,
  'profile hot updates should preserve the current input instead of resetting the model',
);

console.log('live2d model switch look bootstrap smoke passed');
