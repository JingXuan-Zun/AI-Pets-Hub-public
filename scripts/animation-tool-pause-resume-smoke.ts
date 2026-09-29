import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import { type DesktopPetAnimationToolTrigger } from '../src/chatState';
import { handleAnimationToolTriggerPlayback } from '../src/components/pet/animationToolTriggerPlayback';
import {
  handleAnimationToolAudioTrigger,
  type AnimationToolAudioPlaybackRefs,
} from '../src/components/pet/animationToolAudioPlaybackRuntime';
import { createPlayableAnimationToolAudioPlaybackState } from '../src/components/pet/animationToolAudioPlaybackState';
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
    restore() {
      if (previousWindow === undefined) {
        delete (globalThis as typeof globalThis & { window?: unknown }).window;
        return;
      }

      (globalThis as typeof globalThis & { window: unknown }).window = previousWindow;
    },
  };
}

function createRefs(activeTrigger: DesktopPetAnimationToolTrigger | null): AnimationToolAudioPlaybackRefs {
  return {
    activeAudioTriggerRef: { current: activeTrigger },
    activePlaybackTokenRef: { current: activeTrigger?.token ?? null },
    playbackSessionRef: { current: null },
    startTimerRef: { current: null },
  };
}

function createPlayableTrigger(token: number): DesktopPetAnimationToolTrigger {
  return {
    animationIds: ['wave_hello'],
    audio: {
      playbackUrl: 'https://example.test/song.mp3',
      source: 'audio',
      sourceRef: 'https://example.test/song.mp3',
    },
    source: 'agent-skill',
    token,
  };
}

const motionBindings = [
  {
    format: 'vrma',
    id: 'binding-wave',
    motionKey: 'happy',
    name: 'Wave Hello',
    sourceUrl: 'C:/motions/wave.vrma',
  },
] satisfies PetModelMotionBinding[];

const scheduledTrigger = {
  animationIds: ['wave_hello'],
  schedule: [{ animationId: 'wave_hello', delayMs: 500 }],
  source: 'agent-skill',
  token: 10,
} satisfies DesktopPetAnimationToolTrigger;

const timers = installFakeWindowTimers();
try {
  let now = 1000;
  const scheduledTriggerTimeoutsRef = { current: [] as number[] };
  const enqueuedIds: string[] = [];
  const playResult = handleAnimationToolTriggerPlayback({
    animationToolTrigger: scheduledTrigger,
    enqueueAnimationBindings: (bindings) => enqueuedIds.push(...bindings.map((binding) => binding.id)),
    motionBindings,
    nowMs: () => now,
    resetMotionPlayback: () => undefined,
    scheduledTriggerTimeoutsRef,
  });

  assert.equal(playResult.triggerKind, 'scheduled');
  assert.equal(timers.delayFor(scheduledTriggerTimeoutsRef.current[0]!), 500);
  now = 1200;
  const pauseResult = handleAnimationToolTriggerPlayback({
    animationToolTrigger: {
      animationIds: [],
      control: 'pause',
      source: 'user-direct',
      token: 11,
    },
    enqueueAnimationBindings: () => undefined,
    motionBindings,
    nowMs: () => now,
    resetMotionPlayback: () => undefined,
    scheduledTriggerTimeoutsRef,
  });

  assert.deepEqual(pauseResult, {
    handled: true,
    itemCount: 1,
    status: 'paused',
    triggerKind: 'scheduled',
  });
  assert.deepEqual(timers.activeTimeoutIds(), []);
  const resumeResult = handleAnimationToolTriggerPlayback({
    animationToolTrigger: {
      animationIds: [],
      control: 'resume',
      source: 'user-direct',
      token: 12,
    },
    enqueueAnimationBindings: () => undefined,
    motionBindings,
    nowMs: () => now,
    resetMotionPlayback: () => undefined,
    scheduledTriggerTimeoutsRef,
  });

  assert.deepEqual(resumeResult, {
    handled: true,
    itemCount: 1,
    status: 'playing',
    triggerKind: 'scheduled',
  });
  assert.equal(timers.delayFor(scheduledTriggerTimeoutsRef.current[0]!), 300);
  assert.deepEqual(enqueuedIds, []);
} finally {
  timers.restore();
}

desktopPetChatStore.reset();
desktopPetChatStore.queueAnimationToolTrigger('primary', ['wave_hello'], 'agent-skill', [
  { animationId: 'wave_hello', delayMs: 500 },
]);
desktopPetChatStore.pauseAnimationToolTrigger('primary');
const pauseStoreTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(pauseStoreTrigger?.control, 'pause');
assert.equal(desktopPetChatStore.getState().animationToolPerformanceByPetId.primary, undefined);

const activeAudioTrigger = createPlayableTrigger(40);
const audioStates: Array<string | null> = [];
handleAnimationToolAudioTrigger({
  petId: 'primary',
  publishState: (_petId, state) => audioStates.push(state?.status ?? null),
  publishStatus: (trigger, status) => {
    audioStates.push(createPlayableAnimationToolAudioPlaybackState({
      petId: 'primary',
      status,
      trigger,
    })?.status ?? null);
  },
  refs: createRefs(activeAudioTrigger),
  trigger: pauseStoreTrigger!,
});

assert.deepEqual(audioStates, []);

console.log('animation tool pause resume smoke ok');
