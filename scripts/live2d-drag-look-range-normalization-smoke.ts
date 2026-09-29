import assert from 'node:assert/strict';

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    cancelAnimationFrame: () => {},
    location: { search: '' },
    performance: { now: () => 20 },
    requestAnimationFrame: () => 1,
  },
});

const { createLive2DPointerLookRuntimeController } = await import(
  '../src/components/pet/live2dPointerLookRuntimeController'
);

type ParameterRange = {
  defaultValue: number;
  max: number;
  min: number;
};

function sampleDragLookValue(range: ParameterRange) {
  let writtenValue = range.defaultValue;
  const listeners = new Map<string, (timestampMs?: number) => void>();
  const coreModel = {
    getParameterDefaultValue: () => range.defaultValue,
    getParameterIndex: (id: string) => id === 'ParamAngleX' ? 0 : -1,
    getParameterMaximumValue: () => range.max,
    getParameterMinimumValue: () => range.min,
    setParameterValueByIndex: (_index: number, value: number) => {
      writtenValue = value;
    },
  };
  const internalModel = {
    coreModel,
    off: (event: string) => listeners.delete(event),
    on: (event: string, listener: (timestampMs?: number) => void) => {
      listeners.set(event, listener);
    },
    removeListener: (event: string) => listeners.delete(event),
  };
  const controller = createLive2DPointerLookRuntimeController(
    { internalModel },
    { modelUrl: 'range-smoke.model3.json', petId: 'range-smoke' },
  );

  assert.ok(controller, 'expected drag-look controller to initialize');
  controller.updateInputTarget({ source: 'focus', x: 0.4, y: 0 }, 20);
  controller.applyImmediate();
  controller.destroy();
  return writtenValue;
}

function positiveRangeRatio(value: number, range: ParameterRange) {
  return (value - range.defaultValue) / (range.max - range.defaultValue);
}

const compactRange = { defaultValue: 0, min: -30, max: 30 };
const wideRange = { defaultValue: 0, min: -90, max: 90 };
const offsetRange = { defaultValue: 15, min: -45, max: 135 };
const compactRatio = positiveRangeRatio(sampleDragLookValue(compactRange), compactRange);
const wideRatio = positiveRangeRatio(sampleDragLookValue(wideRange), wideRange);
const offsetRatio = positiveRangeRatio(sampleDragLookValue(offsetRange), offsetRange);

assert.ok(
  Math.abs(compactRatio - wideRatio) < 0.000001,
  `drag look should occupy the same relative range: compact=${compactRatio} wide=${wideRatio}`,
);
assert.ok(
  Math.abs(compactRatio - offsetRatio) < 0.000001,
  `drag look should support non-centered defaults: compact=${compactRatio} offset=${offsetRatio}`,
);

console.log('live2d drag look range normalization smoke passed');
