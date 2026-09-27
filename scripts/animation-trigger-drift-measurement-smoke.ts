import assert from 'node:assert/strict';
import { publishAnimationToolAudioScheduleTiming } from '../src/components/pet/animationToolAudioScheduleSync';
import { enqueueScheduledAnimationTriggerBatches } from '../src/components/pet/animationTriggerBatchScheduler';
import {
  createAnimationTriggerDriftSample,
  type AnimationTriggerDriftSample,
} from '../src/components/pet/animationTriggerDriftMeasurement';
import { type DesktopPetAnimationToolTrigger } from '../src/chatState';
import { type PetModelMotionBinding } from '../src/types';

function installFakeWindowTimers() {
  const timeouts = new Map<number, { callback: () => void; delayMs: number }>();
  let nextTimeoutId = 1;
  const previousWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    clearTimeout: (timeoutId: number) => {
      timeouts.delete(timeoutId);
    },
    setTimeout: (callback: () => void, delayMs: number) => {
      const timeoutId = nextTimeoutId;
      nextTimeoutId += 1;
      timeouts.set(timeoutId, { callback, delayMs });
      return timeoutId;
    },
  };

  return {
    fire(timeoutId: number) {
      const timeout = timeouts.get(timeoutId);
      timeouts.delete(timeoutId);
      timeout?.callback();
    },
    restore() {
      if (previousWindow === undefined) {
        delete (globalThis as typeof globalThis & { window?: unknown }).window;
        return;
      }

      (globalThis as typeof globalThis & { window: unknown }).window = previousWindow;
    },
  };
}

const sample = createAnimationTriggerDriftSample({
  actualFiredAtMs: 1306,
  batchDelayMs: 500,
  batchSize: 2,
  plannedDelayMs: 1125,
  scheduledAtMs: 100,
  scheduleBaseDelayMs: 625,
  scheduler: 'clocked',
  token: 42,
  triggerSource: 'agent-skill',
});

assert.equal(sample.plannedFireAtMs, 1225);
assert.equal(sample.driftMs, 81);
assert.equal(sample.absoluteDriftMs, 81);
assert.equal(sample.severity, 'notice');

const warningSample = createAnimationTriggerDriftSample({
  ...sample,
  actualFiredAtMs: 1420,
  scheduledAtMs: 100,
});
assert.equal(warningSample.severity, 'warn');

const motionBindings = [
  {
    format: 'vrma',
    id: 'binding-wave',
    motionKey: 'happy',
    name: 'Wave Hello',
    sourceUrl: 'C:/motions/wave.vrma',
  },
] satisfies PetModelMotionBinding[];

function createTrigger(options: {
  audio?: DesktopPetAnimationToolTrigger['audio'];
  delayMs: number;
  token: number;
}): DesktopPetAnimationToolTrigger {
  return {
    animationIds: ['wave_hello'],
    ...(options.audio ? { audio: options.audio } : {}),
    schedule: [{ animationId: 'wave_hello', delayMs: options.delayMs }],
    source: 'agent-skill',
    token: options.token,
  };
}

const timers = installFakeWindowTimers();
try {
  let now = 1000;
  const timeoutIdsRef = { current: [] as number[] };
  const samples: AnimationTriggerDriftSample[] = [];
  const enqueuedIds: string[] = [];

  enqueueScheduledAnimationTriggerBatches({
    enqueueBindings: (bindings) => enqueuedIds.push(...bindings.map((binding) => binding.id)),
    motionBindings,
    nowMs: () => now,
    reportDrift: (nextSample) => samples.push(nextSample),
    timeoutIdsRef,
    trigger: createTrigger({ delayMs: 320, token: 77 }),
  });

  assert.equal(timeoutIdsRef.current.length, 1);
  now = 1335;
  timers.fire(timeoutIdsRef.current[0]!);
  assert.deepEqual(enqueuedIds, ['binding-wave']);
  assert.deepEqual(
    {
      absoluteDriftMs: samples[0]?.absoluteDriftMs,
      driftMs: samples[0]?.driftMs,
      scheduler: samples[0]?.scheduler,
      severity: samples[0]?.severity,
      token: samples[0]?.token,
    },
    {
      absoluteDriftMs: 15,
      driftMs: 15,
      scheduler: 'timer',
      severity: 'ok',
      token: 77,
    },
  );

  enqueueScheduledAnimationTriggerBatches({
    enqueueBindings: (bindings) => enqueuedIds.push(...bindings.map((binding) => binding.id)),
    motionBindings,
    nowMs: () => now,
    reportDrift: (nextSample) => samples.push(nextSample),
    timeoutIdsRef,
    trigger: createTrigger({
      audio: {
        playbackUrl: 'https://example.test/song.mp3',
        source: 'audio',
        sourceRef: 'https://example.test/song.mp3',
        startDelayMs: 100,
      },
      delayMs: 400,
      token: 78,
    }),
  });

  assert.equal(timeoutIdsRef.current[0]! < 0, true);
  publishAnimationToolAudioScheduleTiming({
    baseDelayMs: 150,
    scheduler: 'clocked',
    token: 78,
  });
  assert.equal(timeoutIdsRef.current.length, 1);
  now = 2100;
  timers.fire(timeoutIdsRef.current[0]!);
  assert.equal(samples[1]?.scheduler, 'clocked');
  assert.equal(samples[1]?.scheduleBaseDelayMs, 150);
  assert.equal(samples[1]?.plannedDelayMs, 550);
  assert.equal(samples[1]?.severity, 'warn');
} finally {
  timers.restore();
}

console.log('animation trigger drift measurement smoke ok');
