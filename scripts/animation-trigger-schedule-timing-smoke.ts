import assert from 'node:assert/strict';
import {
  resolveAnimationTriggerBatchDelayMs,
  resolveAnimationTriggerScheduleBaseDelayMs,
} from '../src/components/pet/animationTriggerScheduleTiming';
import { type DesktopPetAnimationToolTrigger } from '../src/chatState';
import {
  clearAnimationToolAudioScheduleTiming,
  publishAnimationToolAudioScheduleTiming,
} from '../src/components/pet/animationToolAudioScheduleSync';
import {
  clearAnimationTriggerBatchTimeouts,
  enqueueScheduledAnimationTriggerBatches,
} from '../src/components/pet/animationTriggerBatchScheduler';
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
    activeTimeoutIds() {
      return Array.from(timeouts.keys());
    },
    delayFor(timeoutId: number) {
      return timeouts.get(timeoutId)?.delayMs ?? null;
    },
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

const playableAudioTrigger = {
  animationIds: ['wave_hello'],
  audio: {
    playbackUrl: 'https://example.test/song.mp3',
    source: 'audio',
    sourceRef: 'https://example.test/song.mp3',
    startDelayMs: 125,
  },
  schedule: [{ animationId: 'wave_hello', delayMs: 500 }],
  source: 'agent-skill',
  token: 1,
} satisfies DesktopPetAnimationToolTrigger;

assert.equal(resolveAnimationTriggerScheduleBaseDelayMs(playableAudioTrigger), 125);
assert.equal(
  resolveAnimationTriggerBatchDelayMs({
    batchDelayMs: 500,
    scheduleBaseDelayMs: resolveAnimationTriggerScheduleBaseDelayMs(playableAudioTrigger),
  }),
  625,
);

const metadataAudioTrigger = {
  ...playableAudioTrigger,
  audio: {
    source: 'metadata',
    sourceRef: 'song-without-playable-url',
    startDelayMs: 125,
  },
  token: 2,
} satisfies DesktopPetAnimationToolTrigger;

assert.equal(resolveAnimationTriggerScheduleBaseDelayMs(metadataAudioTrigger), 0);
assert.equal(
  resolveAnimationTriggerBatchDelayMs({
    batchDelayMs: 500,
    scheduleBaseDelayMs: resolveAnimationTriggerScheduleBaseDelayMs(metadataAudioTrigger),
  }),
  500,
);

const noAudioTrigger = {
  animationIds: ['wave_hello'],
  schedule: [{ animationId: 'wave_hello', delayMs: 500 }],
  source: 'agent-skill',
  token: 3,
} satisfies DesktopPetAnimationToolTrigger;

assert.equal(resolveAnimationTriggerScheduleBaseDelayMs(noAudioTrigger), 0);
assert.equal(
  resolveAnimationTriggerBatchDelayMs({ batchDelayMs: -20, scheduleBaseDelayMs: 125 }),
  105,
);

const motionBindings = [
  {
    format: 'vrma',
    id: 'binding-wave',
    motionKey: 'happy',
    name: 'Wave Hello',
    sourceUrl: 'C:/motions/wave.vrma',
  },
] satisfies PetModelMotionBinding[];

const timers = installFakeWindowTimers();
try {
  const timeoutIdsRef = { current: [] as number[] };
  const enqueuedIds: string[] = [];
  assert.equal(enqueueScheduledAnimationTriggerBatches({
    enqueueBindings: (bindings) => {
      enqueuedIds.push(...bindings.map((binding) => binding.id));
    },
    motionBindings,
    timeoutIdsRef,
    trigger: {
      animationIds: ['wave_hello'],
      audio: {
        playbackUrl: 'https://example.test/song.mp3',
        source: 'audio',
        sourceRef: 'https://example.test/song.mp3',
        startDelayMs: 125,
      },
      schedule: [{ animationId: 'wave_hello', delayMs: 500 }],
      source: 'agent-skill',
      token: 99,
    },
  }), true);
  assert.equal(timeoutIdsRef.current.length, 1);
  assert.equal(timeoutIdsRef.current[0]! < 0, true, 'playable audio should wait for actual audio timing first');

  publishAnimationToolAudioScheduleTiming({
    baseDelayMs: 210,
    scheduler: 'clocked',
    token: 99,
  });
  assert.equal(timeoutIdsRef.current.length, 1);
    assert.equal(timers.delayFor(timeoutIdsRef.current[0]!), 710);
    timers.fire(timeoutIdsRef.current[0]!);
    assert.deepEqual(enqueuedIds, ['binding-wave']);

  assert.equal(enqueueScheduledAnimationTriggerBatches({
    cancelCurrentPlayback: () => enqueuedIds.push('cancel-current'),
    enqueueBindings: (bindings) => {
      enqueuedIds.push(...bindings.map((binding) => binding.id));
    },
    motionBindings,
    timeoutIdsRef,
    trigger: {
      animationIds: ['wave_hello'],
      schedule: [{ animationId: 'missing_motion', delayMs: 10 }],
      source: 'agent-skill',
      token: 100,
    },
  }), false);
  assert.equal(enqueuedIds.includes('cancel-current'), false);

  assert.equal(enqueueScheduledAnimationTriggerBatches({
    cancelCurrentPlayback: () => enqueuedIds.push('cancel-current'),
    enqueueBindings: (bindings) => {
      enqueuedIds.push(...bindings.map((binding) => binding.id));
    },
    motionBindings,
    timeoutIdsRef,
    trigger: {
      animationIds: ['wave_hello'],
      schedule: [{ animationId: 'wave_hello', delayMs: 20 }],
      source: 'agent-skill',
      token: 101,
    },
  }), true);
  assert.equal(enqueuedIds.includes('cancel-current'), true);
  assert.equal(timeoutIdsRef.current.length, 1);
  assert.equal(timers.delayFor(timeoutIdsRef.current[0]!), 20);
  clearAnimationTriggerBatchTimeouts(timeoutIdsRef);
  assert.deepEqual(timers.activeTimeoutIds(), []);

  clearAnimationToolAudioScheduleTiming(99);
  clearAnimationTriggerBatchTimeouts(timeoutIdsRef);
} finally {
  timers.restore();
}

console.log('animation trigger schedule timing smoke ok');
