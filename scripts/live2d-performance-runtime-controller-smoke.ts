import assert from 'node:assert/strict';

let nowMs = 0;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    cancelAnimationFrame: () => {},
    performance: {
      now: () => nowMs,
    },
    requestAnimationFrame: () => 1,
  },
});

const { createLive2DPerformanceRuntimeController } = await import(
  '../src/components/pet/live2dPerformanceRuntimeController'
);
const { resolveLive2DHoverPerformanceCue } = await import(
  '../src/components/pet/live2dHoverPerformanceCue'
);

const parameterIds = [
  'ParamEyeLOpen',
  'ParamEyeROpen',
  'ParamBreath',
  'ParamMouthOpenY',
  'ParamBodyAngleY',
  'ParamBodyAngleZ',
] as const;

type ParameterId = typeof parameterIds[number];

type ParameterWrite = {
  value: number;
  weight?: number;
};

function createHarness(hasComplexStandingRig = false) {
  const complexStandingParameterIds = [
    'HeadAngleX',
    'HeadAngleY',
    'HeadAngleZ',
    'ChestX_input',
    'ChestY_input',
    'ChestZ_input',
  ] as const;
  const availableParameterIds: readonly string[] = hasComplexStandingRig
    ? [...parameterIds, ...complexStandingParameterIds]
    : parameterIds;
  const writes = new Map<string, ParameterWrite[]>(
    availableParameterIds.map((id) => [id, []]),
  );
  const listenerStore = new Map<string, (timestampMs?: number) => void>();

  const coreModel = {
    getParameterDefaultValue: (parameterIndex: number) => {
      const parameterId = parameterIds[parameterIndex];
      return parameterId === 'ParamEyeLOpen' || parameterId === 'ParamEyeROpen' ? 1 : 0;
    },
    getParameterIndex: (parameterId: string) => availableParameterIds.indexOf(parameterId),
    getParameterMaximumValue: (parameterIndex: number) => {
      const parameterId = availableParameterIds[parameterIndex];
      return parameterId === 'ParamEyeLOpen' || parameterId === 'ParamEyeROpen' ? 1 : 30;
    },
    getParameterMinimumValue: (parameterIndex: number) => {
      const parameterId = parameterIds[parameterIndex];
      return parameterId === 'ParamEyeLOpen' || parameterId === 'ParamEyeROpen' ? 0 : -30;
    },
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

  const controller = createLive2DPerformanceRuntimeController(
    { internalModel },
    {
      modelUrl: 'mock-live2d.model3.json',
      petId: 'smoke',
    },
  );

  assert.ok(controller, 'expected performance controller to initialize with mock core model');
  assert.ok(listenerStore.has('beforeModelUpdate'), 'expected controller to subscribe beforeModelUpdate');

  return {
    controller,
    listenerStore,
    readLastValue: (parameterId: ParameterId) => {
      const parameterWrites = writes.get(parameterId) ?? [];
      return parameterWrites.at(-1)?.value ?? 0;
    },
    readLastWeight: (parameterId: ParameterId) => {
      const parameterWrites = writes.get(parameterId) ?? [];
      return parameterWrites.at(-1)?.weight ?? 0;
    },
    readWriteCount: (parameterId: ParameterId) => (writes.get(parameterId) ?? []).length,
  };
}

const idleHarness = createHarness();
nowMs = 1020;
idleHarness.controller.setState({
  action: 'IDLE',
  expressionAction: null,
  hoverRegion: null,
  isMoving: false,
  lookSource: 'center',
  manualExpressionActive: false,
  manualMotionActive: false,
  pointerLookStrength: 1,
  visible: true,
});
idleHarness.controller.applyImmediate(nowMs);

assert.ok(
  idleHarness.readLastValue('ParamBreath') > 0,
  `idle performance should write a breathing parameter, got ${idleHarness.readLastValue('ParamBreath')}`,
);
assert.equal(
  idleHarness.readWriteCount('ParamMouthOpenY'),
  0,
  'performance controller must leave the mouth parameter to the dedicated mouth controller',
);
assert.notEqual(
  idleHarness.readLastValue('ParamBodyAngleY'),
  0,
  'idle performance should add subtle body Y motion so Live2D does not only look left/right',
);

const headHoverHarness = createHarness();
nowMs = 1020;
headHoverHarness.controller.setState({
  action: 'IDLE',
  hoverRegion: 'head',
  lookSource: 'center',
  visible: true,
});
headHoverHarness.controller.applyImmediate(nowMs);

assert.equal(headHoverHarness.readWriteCount('ParamMouthOpenY'), 0);

const bodyHoverHarness = createHarness();
nowMs = 1020;
bodyHoverHarness.controller.setState({
  action: 'IDLE',
  hoverRegion: 'body',
  visible: true,
});
bodyHoverHarness.controller.applyImmediate(nowMs);

assert.ok(
  bodyHoverHarness.readLastValue('ParamBreath') > idleHarness.readLastValue('ParamBreath'),
  `body hover should subtly increase breathing, got body=${bodyHoverHarness.readLastValue('ParamBreath')} idle=${idleHarness.readLastValue('ParamBreath')}`,
);

const handLeftHoverHarness = createHarness();
nowMs = 1020;
handLeftHoverHarness.controller.setState({
  action: 'IDLE',
  hoverRegion: 'handL',
  visible: true,
});
handLeftHoverHarness.controller.applyImmediate(nowMs);

const handRightHoverHarness = createHarness();
nowMs = 1020;
handRightHoverHarness.controller.setState({
  action: 'IDLE',
  hoverRegion: 'handR',
  visible: true,
});
handRightHoverHarness.controller.applyImmediate(nowMs);

assert.ok(
  handLeftHoverHarness.readLastValue('ParamBodyAngleY') < idleHarness.readLastValue('ParamBodyAngleY'),
  `left hand hover should bias body Y left, got left=${handLeftHoverHarness.readLastValue('ParamBodyAngleY')} idle=${idleHarness.readLastValue('ParamBodyAngleY')}`,
);
assert.ok(
  handRightHoverHarness.readLastValue('ParamBodyAngleY') > idleHarness.readLastValue('ParamBodyAngleY'),
  `right hand hover should bias body Y right, got right=${handRightHoverHarness.readLastValue('ParamBodyAngleY')} idle=${idleHarness.readLastValue('ParamBodyAngleY')}`,
);
assert.ok(
  handLeftHoverHarness.readLastValue('ParamBodyAngleZ') < handRightHoverHarness.readLastValue('ParamBodyAngleZ'),
  `hand hover should produce mirrored body Z cues, got left=${handLeftHoverHarness.readLastValue('ParamBodyAngleZ')} right=${handRightHoverHarness.readLastValue('ParamBodyAngleZ')}`,
);

assert.notDeepEqual(
  resolveLive2DHoverPerformanceCue('head', 1),
  resolveLive2DHoverPerformanceCue('head', 2),
  're-entering the same hover region should have a small stable cue variant instead of repeating the exact same angle',
);
assert.ok(
  resolveLive2DHoverPerformanceCue('handL', 1).bodyAngleYBias < 0,
  'left hand hover variants must keep their left-side bias',
);
assert.ok(
  resolveLive2DHoverPerformanceCue('handR', 1).bodyAngleYBias > 0,
  'right hand hover variants must keep their right-side bias',
);

const manualMotionHarness = createHarness();
nowMs = 1020;
manualMotionHarness.controller.setState({
  action: 'IDLE',
  manualMotionActive: true,
  visible: true,
});
manualMotionHarness.controller.applyImmediate(nowMs);

assert.ok(
  manualMotionHarness.readLastValue('ParamBreath') < idleHarness.readLastValue('ParamBreath'),
  `manual motion should damp micro performance instead of competing with the selected motion, got manual=${manualMotionHarness.readLastValue('ParamBreath')} idle=${idleHarness.readLastValue('ParamBreath')}`,
);

const manualExpressionHarness = createHarness();
nowMs = 1;
manualExpressionHarness.controller.setState({
  action: 'IDLE',
  manualExpressionActive: true,
  visible: true,
});
manualExpressionHarness.controller.applyImmediate(nowMs);

assert.ok(
  manualExpressionHarness.readLastWeight('ParamEyeLOpen') < idleHarness.readLastWeight('ParamEyeLOpen'),
  `manual expression should reduce eye override weight, got manual=${manualExpressionHarness.readLastWeight('ParamEyeLOpen')} idle=${idleHarness.readLastWeight('ParamEyeLOpen')}`,
);

const complexStandingHarness = createHarness(true);
nowMs = 1020;
complexStandingHarness.controller.setState({
  action: 'IDLE',
  isMoving: false,
  lookSource: 'center',
  visible: true,
});
complexStandingHarness.controller.applyImmediate(nowMs);
assert.ok(
  complexStandingHarness.readLastValue('ParamBreath') > 0,
  'complex standing rigs should retain breathing and other non-body micro performance',
);
assert.equal(
  complexStandingHarness.readWriteCount('ParamBodyAngleY'),
  0,
  'complex standing rigs must not receive an extra programmatic body Y sway',
);
assert.equal(
  complexStandingHarness.readWriteCount('ParamBodyAngleZ'),
  0,
  'complex standing rigs must not receive an extra programmatic body Z sway',
);
complexStandingHarness.controller.destroy();

idleHarness.controller.destroy();
assert.equal(
  idleHarness.listenerStore.has('beforeModelUpdate'),
  false,
  'destroy should unsubscribe from beforeModelUpdate',
);

console.log('live2d performance runtime controller smoke passed');
