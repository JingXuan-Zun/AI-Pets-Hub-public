import assert from 'node:assert/strict';

let nowMs = 0;
let requestedAnimationFrameCount = 0;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    cancelAnimationFrame: () => {},
    location: {
      search: '',
    },
    performance: {
      now: () => nowMs,
    },
    requestAnimationFrame: () => {
      requestedAnimationFrameCount += 1;
      return requestedAnimationFrameCount;
    },
  },
});

const { createLive2DPointerLookRuntimeController } = await import(
  '../src/components/pet/live2dPointerLookRuntimeController'
);
const {
  resolveLive2DAutonomousIdleLookTarget,
  resolveLive2DIdleReentryTarget,
  resolveLive2DPointerLookLerpFactor,
  resolveLive2DPointerLookParameterInfluence,
} = await import(
  '../src/components/pet/live2dPointerLookRuntimeController'
);
const { resolveLive2DRuntimeProfile } = await import(
  '../src/pet-runtime/live2d/live2dRuntimeProfile'
);

assert.ok(
  Math.abs(resolveLive2DPointerLookLerpFactor('center', 'focus') - 0.08) < 0.000001,
  'drag focus return should avoid a large first-frame head jump',
);

assert.ok(
  Math.abs(resolveLive2DPointerLookLerpFactor('focus', 'focus') - 0.34) < 0.000001,
  'focus input should reach the unified drag range quickly while remaining smooth',
);

const halfFrameReturnLerp = resolveLive2DPointerLookLerpFactor(
  'center',
  'center',
  1000 / 120,
);
assert.ok(
  Math.abs((1 - (1 - halfFrameReturnLerp) ** 2) - 0.08) < 0.000001,
  `two 120Hz return updates should equal one 60Hz update, got ${halfFrameReturnLerp}`,
);

assert.equal(
  resolveLive2DPointerLookParameterInfluence({
    appliedSource: 'focus',
    currentX: 0.64,
    currentY: -0.52,
    timedSource: 'focus',
  }),
  1,
  'drag focus should preserve full parameter influence',
);
assert.equal(
  resolveLive2DPointerLookParameterInfluence({
    appliedSource: 'center',
    currentX: 0,
    currentY: 0,
    timedSource: 'center',
  }),
  1,
  'explicit drag return should keep full parameter influence until idle resumes',
);
assert.equal(
  resolveLive2DPointerLookParameterInfluence({
    appliedSource: 'focus',
    currentX: 0.1,
    currentY: 0,
    timedSource: 'center',
  }),
  0.28,
  'autonomous idle should remain lower influence than drag focus',
);

const parameterIds = [
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ParamBodyAngleX',
  'ParamEyeBallX',
  'ParamEyeBallY',
  'ParamAngleX2',
  'ParamAngleY2',
  'ParamAngleZ2',
] as const;

type ParameterId = typeof parameterIds[number];

type ParameterWrite = {
  value: number;
  weight?: number;
};

type PointerLookDiagnosticFrame = {
  appliedSource: 'center' | 'focus' | 'pointer';
  currentX: number;
  currentY: number;
  parameterInfluence: number;
  targetX: number;
  targetY: number;
  timedSource: 'center' | 'focus' | 'pointer';
};

function createHarness(onDiagnosticFrame?: (frame: PointerLookDiagnosticFrame) => void) {
  const writes = new Map<ParameterId, ParameterWrite[]>(
    parameterIds.map((id) => [id, []]),
  );
  const listenerStore = new Map<string, (timestampMs?: number) => void>();

  const coreModel = {
    getParameterDefaultValue: () => 0,
    getParameterIndex: (parameterId: string) => parameterIds.indexOf(parameterId as ParameterId),
    getParameterMaximumValue: () => 999,
    getParameterMinimumValue: () => -999,
    setParameterValueByIndex: (parameterIndex: number, value: number, weight?: number) => {
      const parameterId = parameterIds[parameterIndex];
      if (!parameterId) {
        return;
      }

      writes.get(parameterId)?.push({ value, weight });
    },
  };

  const internalModel = {
    coreModel,
    off: (eventName: string) => {
      listenerStore.delete(eventName);
    },
    on: (eventName: string, listener: (timestampMs?: number) => void) => {
      listenerStore.set(eventName, listener);
    },
    removeListener: (eventName: string) => {
      listenerStore.delete(eventName);
    },
  };

  const frameCountBeforeController = requestedAnimationFrameCount;
  const controller = createLive2DPointerLookRuntimeController(
    { internalModel },
    {
      modelUrl: 'mock-live2d.model3.json',
      onDiagnosticFrame,
      petId: 'smoke',
    },
  );

  assert.ok(controller, 'expected pointer look runtime controller to initialize with mock core model');
  assert.ok(listenerStore.has('beforeModelUpdate'), 'expected controller to subscribe beforeModelUpdate');
  assert.equal(
    requestedAnimationFrameCount,
    frameCountBeforeController + 1,
    'pointer look should arm a watchdog even when beforeModelUpdate is available',
  );

  return {
    controller,
    dispatchModelUpdate: () => {
      listenerStore.get('beforeModelUpdate')?.();
    },
    readLastWrite: (parameterId: ParameterId) => (writes.get(parameterId) ?? []).at(-1) ?? null,
    readLastValue: (parameterId: ParameterId) => {
      const parameterWrites = writes.get(parameterId) ?? [];
      return parameterWrites.at(-1)?.value ?? 0;
    },
    readWriteCount: (parameterId: ParameterId) => (writes.get(parameterId) ?? []).length,
  };
}

function assertFallbackAnimationFrameWithoutModelUpdateEvent() {
  const parameterIdsForFallback = ['ParamAngleX'] as const;
  const coreModel = {
    getParameterDefaultValue: () => 0,
    getParameterIndex: (parameterId: string) => parameterIdsForFallback.indexOf(
      parameterId as typeof parameterIdsForFallback[number],
    ),
    getParameterMaximumValue: () => 30,
    getParameterMinimumValue: () => -30,
    setParameterValueByIndex: () => {},
  };
  const frameCountBeforeFallback = requestedAnimationFrameCount;
  const controller = createLive2DPointerLookRuntimeController(
    { internalModel: { coreModel } },
    {
      modelUrl: 'fallback-live2d.model3.json',
      petId: 'fallback-smoke',
    },
  );

  assert.ok(controller, 'expected fallback controller to initialize without model update events');
  assert.equal(
    requestedAnimationFrameCount,
    frameCountBeforeFallback + 1,
    'models without beforeModelUpdate should retain the animation-frame fallback',
  );
  controller.destroy();
}

assertFallbackAnimationFrameWithoutModelUpdateEvent();

function assertPhysicsDrivenHeadOutputTakesPriority() {
  const physicsDrivenParameterIds = [
    'ParamAngleX',
    'ParamAngleY',
    'ParamAngleZ',
    'HeadAngleX',
    'HeadAngleY',
    'HeadAngleZ',
    'ParamEyeBallX',
    'ParamEyeBallY',
  ] as const;
  type PhysicsDrivenParameterId = typeof physicsDrivenParameterIds[number];
  const writes = new Map<PhysicsDrivenParameterId, ParameterWrite[]>(
    physicsDrivenParameterIds.map((id) => [id, []]),
  );
  const listenerStore = new Map<string, (timestampMs?: number) => void>();
  const coreModel = {
    getParameterDefaultValue: () => 0,
    getParameterIndex: (parameterId: string) => physicsDrivenParameterIds.indexOf(
      parameterId as PhysicsDrivenParameterId,
    ),
    getParameterMaximumValue: () => 30,
    getParameterMinimumValue: () => -30,
    setParameterValueByIndex: (parameterIndex: number, value: number, weight?: number) => {
      const parameterId = physicsDrivenParameterIds[parameterIndex];
      if (parameterId) {
        writes.get(parameterId)?.push({ value, weight });
      }
    },
  };
  const internalModel = {
    coreModel,
    off: (eventName: string) => listenerStore.delete(eventName),
    on: (eventName: string, listener: (timestampMs?: number) => void) => {
      listenerStore.set(eventName, listener);
    },
    removeListener: (eventName: string) => listenerStore.delete(eventName),
  };
  const controller = createLive2DPointerLookRuntimeController(
    { internalModel },
    {
      modelUrl: 'physics-driven-standing.model3.json',
      petId: 'physics-driven-standing-smoke',
    },
  );

  assert.ok(controller, 'expected physics-driven standing model controller to initialize');
  assert.equal(controller.summary.angleX, 'HeadAngleX');
  assert.equal(controller.summary.angleY, 'HeadAngleY');
  assert.equal(controller.summary.angleZ, 'HeadAngleZ');
  nowMs += 20;
  controller.updateInputTarget({ source: 'pointer', x: 0.8, y: 0.6 }, nowMs);
  controller.applyImmediate();
  assert.ok(
    (writes.get('HeadAngleX')?.at(-1)?.value ?? 0) > 0,
    'pointer look should write the final head output in the same frame',
  );
  assert.equal(
    writes.get('ParamAngleX')?.length,
    0,
    'pointer look must not drive the standing model full-body physics input',
  );
  controller.destroy();

  for (const parameterWrites of writes.values()) {
    parameterWrites.length = 0;
  }
  const configuredRuntimeProfile = resolveLive2DRuntimeProfile({
    config: {
      capabilities: {
        eyeLook: false,
      },
      parameters: {
        lookX: {
          invert: true,
          sensitivity: 0.5,
        },
      },
      profileVersion: 1,
    },
    coreModel,
  });
  const configuredController = createLive2DPointerLookRuntimeController(
    { internalModel },
    {
      modelUrl: 'configured-standing.model3.json',
      petId: 'configured-standing-smoke',
      runtimeProfile: configuredRuntimeProfile,
    },
  );
  assert.ok(configuredController);
  assert.equal(configuredController.summary.eyeBallX, null);
  nowMs += 20;
  configuredController.updateInputTarget({ source: 'pointer', x: 0.8, y: 0 }, nowMs);
  configuredController.applyImmediate();
  assert.ok(
    (writes.get('HeadAngleX')?.at(-1)?.value ?? 0) < 0,
    'configured invert must reverse the resolved head output',
  );
  configuredController.destroy();
}

assertPhysicsDrivenHeadOutputTakesPriority();

const highRefreshHarness = createHarness();
nowMs += 20;
highRefreshHarness.controller.updateInputTarget({
  source: 'focus',
  x: 0.64,
  y: -0.52,
}, nowMs);
highRefreshHarness.controller.applyImmediate();
const highRefreshWriteCount = highRefreshHarness.readWriteCount('ParamAngleX');
nowMs += 4;
highRefreshHarness.dispatchModelUpdate();
assert.equal(
  highRefreshHarness.readWriteCount('ParamAngleX'),
  highRefreshWriteCount + 1,
  'every beforeModelUpdate frame must rewrite pointer parameters even above 120Hz',
);
highRefreshHarness.controller.destroy();

function sampleFirstAngleXFor(lookPosition: { source: 'center' | 'focus' | 'pointer'; x: number; y: number }) {
  nowMs += 20;
  const harness = createHarness();
  harness.controller.updateInputTarget(lookPosition, nowMs);
  harness.controller.applyImmediate();
  const value = harness.readLastValue('ParamAngleX');
  harness.controller.destroy();
  return value;
}

const pointerFirstFrameAngleX = sampleFirstAngleXFor({
  source: 'pointer',
  x: 1,
  y: 0,
});
const focusFirstFrameAngleX = sampleFirstAngleXFor({
  source: 'focus',
  x: 1,
  y: 0,
});

assert.ok(
  pointerFirstFrameAngleX > focusFirstFrameAngleX,
  `pointer look should still respond faster than focus fallback, got pointer=${pointerFirstFrameAngleX} focus=${focusFirstFrameAngleX}`,
);
assert.ok(
  focusFirstFrameAngleX > 0,
  `focus fallback should remain visible instead of being disabled, got ${focusFirstFrameAngleX}`,
);

const focusInfluenceFrames: PointerLookDiagnosticFrame[] = [];
const focusInfluenceHarness = createHarness((frame) => {
  focusInfluenceFrames.push(frame);
});
nowMs += 20;
focusInfluenceHarness.controller.updateInputTarget({
  source: 'focus',
  x: 0.64,
  y: -0.52,
}, nowMs);
focusInfluenceHarness.controller.applyImmediate();
assert.ok(
  focusInfluenceFrames[0].parameterInfluence > 0.28
  && focusInfluenceFrames[0].parameterInfluence < 1,
  `drag focus should acquire parameter ownership progressively, got ${JSON.stringify(focusInfluenceFrames[0])}`,
);
for (let index = 0; index < 45; index += 1) {
  nowMs += 20;
  focusInfluenceHarness.controller.applyImmediate();
}
assert.ok(
  focusInfluenceFrames.at(-1)!.parameterInfluence > 0.99,
  `drag focus should still reach full parameter ownership, got ${JSON.stringify(focusInfluenceFrames.at(-1))}`,
);
focusInfluenceHarness.controller.destroy();

const disabledStrengthHarness = createHarness();
nowMs += 20;
disabledStrengthHarness.controller.setStrength(0);
disabledStrengthHarness.controller.updateInputTarget({
  source: 'pointer',
  x: 1,
  y: 0,
}, nowMs);
disabledStrengthHarness.controller.applyImmediate();
assert.equal(
  disabledStrengthHarness.readLastValue('ParamAngleX'),
  0,
  'pointer look strength 0 should fully suppress parameter offset',
);
disabledStrengthHarness.controller.destroy();

const rightUpPointerHarness = createHarness();
nowMs += 20;
rightUpPointerHarness.controller.updateInputTarget({
  source: 'pointer',
  x: 0.8,
  y: 0.8,
}, nowMs);
rightUpPointerHarness.controller.applyImmediate();
assert.ok(
  rightUpPointerHarness.readLastValue('ParamAngleY') > 0,
  'active upper pointer look should remain a valid upward angle',
);
rightUpPointerHarness.controller.destroy();

const idleLookStart = resolveLive2DAutonomousIdleLookTarget({
  nowMs: 0,
  seed: 'idle-look-smoke',
});
const idleLookLater = resolveLive2DAutonomousIdleLookTarget({
  nowMs: 5200,
  seed: 'idle-look-smoke',
});
const idleLookRegressionSeeds = [
  'primary:public/models-3d/live2d/薇薇安/薇薇安.model3.json:idle-look',
  'primary:/models-3d/live2d/薇薇安/薇薇安.model3.json:idle-look',
  'primary:mock-live2d.model3.json:idle-look',
  'smoke:mock-live2d.model3.json:idle-look',
];
if (
  idleLookStart.source !== 'focus'
  || (idleLookStart.x === 0 && idleLookStart.y === 0)
) {
  throw new Error(`Expected autonomous idle look to produce a soft non-center target, got ${JSON.stringify(idleLookStart)}`);
}
if (
  Math.abs(idleLookStart.x - idleLookLater.x) < 0.01
  && Math.abs(idleLookStart.y - idleLookLater.y) < 0.01
) {
  throw new Error(`Expected autonomous idle look to change over time, got start=${JSON.stringify(idleLookStart)} later=${JSON.stringify(idleLookLater)}`);
}
for (const seed of idleLookRegressionSeeds) {
  for (let sampleMs = 0; sampleMs <= 120_000; sampleMs += 100) {
    const target = resolveLive2DAutonomousIdleLookTarget({
      nowMs: sampleMs,
      seed,
    });
    if (target.x > 0.12 && target.y > 0.03) {
      throw new Error(`Expected autonomous idle not to generate prominent upper-right glances without input, got seed=${seed} t=${sampleMs} target=${JSON.stringify(target)}`);
    }
  }
}

const idleReentryTarget = {
  source: 'focus' as const,
  x: 0.2,
  y: -0.1,
};
assert.deepEqual(
  resolveLive2DIdleReentryTarget(idleReentryTarget, 0),
  { source: 'focus', x: 0, y: 0 },
  'autonomous idle should resume from the true center after drag release',
);
const idleReentryMidpoint = resolveLive2DIdleReentryTarget(idleReentryTarget, 900);
assert.ok(
  idleReentryMidpoint.x > 0
  && idleReentryMidpoint.x < idleReentryTarget.x
  && idleReentryMidpoint.y < 0
  && idleReentryMidpoint.y > idleReentryTarget.y,
  `autonomous idle should blend in without a target jump, got ${JSON.stringify(idleReentryMidpoint)}`,
);
assert.deepEqual(
  resolveLive2DIdleReentryTarget(idleReentryTarget, 1800),
  idleReentryTarget,
  'autonomous idle should reach its normal target after the reentry blend',
);

const autonomousIdleHarness = createHarness();
nowMs = 5200;
autonomousIdleHarness.controller.updateInputTarget({
  source: 'center',
  x: 0,
  y: 0,
}, nowMs);
autonomousIdleHarness.controller.applyImmediate();
assert.notEqual(
  autonomousIdleHarness.readLastValue('ParamAngleX'),
  0,
  'center input should resolve to autonomous idle look instead of a fixed center',
);
autonomousIdleHarness.controller.destroy();

const dragFocusHandoffFrames: PointerLookDiagnosticFrame[] = [];
const dragFocusHandoffHarness = createHarness((frame) => {
  dragFocusHandoffFrames.push(frame);
});
nowMs = 7000;
dragFocusHandoffHarness.controller.updateInputTarget({
  source: 'focus',
  x: 0.64,
  y: -0.52,
}, nowMs);
for (let index = 0; index < 8; index += 1) {
  nowMs += 20;
  dragFocusHandoffHarness.controller.applyImmediate();
}

dragFocusHandoffHarness.controller.updateInputTarget({
  source: 'center',
  x: 0,
  y: 0,
}, nowMs);
const returnFrameStart = dragFocusHandoffFrames.length;
for (let index = 0; index < 100; index += 1) {
  nowMs += 20;
  dragFocusHandoffHarness.controller.applyImmediate();
}
const returnFrames = dragFocusHandoffFrames.slice(returnFrameStart);
assert.ok(returnFrames.length > 0, 'expected drag focus release frames to be sampled');
const idleReentryFrameIndex = returnFrames.findIndex((frame) => frame.appliedSource === 'focus');
assert.ok(
  idleReentryFrameIndex > 0,
  `expected autonomous idle to resume only after a real center hold, got ${JSON.stringify(returnFrames)}`,
);
const centerReturnFrames = returnFrames.slice(0, idleReentryFrameIndex);
assert.ok(
  centerReturnFrames.every((frame) => (
    frame.timedSource === 'center'
    && frame.appliedSource === 'center'
    && frame.targetX === 0
    && frame.targetY === 0
  )),
  `drag focus release should target true center before autonomous idle, got ${JSON.stringify(returnFrames)}`,
);
for (let index = 1; index < centerReturnFrames.length; index += 1) {
  assert.ok(
    centerReturnFrames[index].currentX <= centerReturnFrames[index - 1].currentX,
    `drag focus release should return horizontally without reversing, got ${JSON.stringify(centerReturnFrames)}`,
  );
  assert.ok(
    centerReturnFrames[index].currentY >= centerReturnFrames[index - 1].currentY,
    `drag focus release should return vertically without reversing, got ${JSON.stringify(centerReturnFrames)}`,
  );
}
const firstIdleReentryFrame = returnFrames[idleReentryFrameIndex];
assert.ok(
  Math.hypot(firstIdleReentryFrame.targetX, firstIdleReentryFrame.targetY) < 0.005,
  `autonomous idle should reenter near center instead of creating a second head impulse, got ${JSON.stringify(firstIdleReentryFrame)}`,
);
dragFocusHandoffHarness.controller.destroy();

const secondaryPhysicsHarness = createHarness();
nowMs += 20;
secondaryPhysicsHarness.controller.updateInputTarget({
  source: 'focus',
  x: 0.64,
  y: -0.52,
}, nowMs);
secondaryPhysicsHarness.controller.applyImmediate();
const secondaryAngleWrite = secondaryPhysicsHarness.readLastWrite('ParamAngleX2');
assert.equal(
  secondaryAngleWrite,
  null,
  'pointer-look runtime should observe model secondary physics without overwriting its output',
);
secondaryPhysicsHarness.controller.destroy();

console.log('live2d pointer look runtime controller smoke passed');
