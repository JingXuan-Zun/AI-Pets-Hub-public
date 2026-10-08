import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import { type DesktopPetAnimationToolTrigger } from '../src/chatState';
import { handleAnimationToolTriggerPlayback } from '../src/components/pet/animationToolTriggerPlayback';
import {
  handleAnimationToolAudioTrigger,
  type AnimationToolAudioPlaybackRefs,
} from '../src/components/pet/animationToolAudioPlaybackRuntime';
import { createPlayableAnimationToolAudioPlaybackState } from '../src/components/pet/animationToolAudioPlaybackState';
import { createAnimationToolPerformanceDisplay } from '../src/components/pet/animationToolPerformanceDisplay';
import { type PetModelMotionBinding, type PetModelMotionKey } from '../src/types';

function createBinding(id: string, name: string, motionKey: PetModelMotionKey): PetModelMotionBinding {
  return {
    format: 'vrma',
    id,
    motionKey,
    name,
    sourceUrl: `C:/motions/${id}.vrma`,
  };
}

function createAudioTrigger(token: number): DesktopPetAnimationToolTrigger {
  return {
    animationIds: ['wave_hello'],
    audio: {
      playbackUrl: 'https://example.test/song.mp3',
      source: 'audio',
      sourceRef: 'https://example.test/song.mp3',
      startDelayMs: 100,
    },
    source: 'agent-skill',
    token,
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

desktopPetChatStore.reset();
desktopPetChatStore.queueAnimationToolTrigger('primary', ['wave_hello'], 'agent-skill');
const queuedTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(queuedTrigger?.control, undefined);
assert.deepEqual(queuedTrigger?.animationIds, ['wave_hello']);

desktopPetChatStore.stopAnimationToolTrigger('primary');
const stopTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
const cancelledPerformanceState = desktopPetChatStore.getState().animationToolPerformanceByPetId.primary;
assert.equal(stopTrigger?.control, 'stop');
assert.deepEqual(stopTrigger?.animationIds, []);
assert.equal(stopTrigger?.source, 'user-direct');
assert.equal((stopTrigger?.token ?? 0) > (queuedTrigger?.token ?? 0), true);
assert.equal(cancelledPerformanceState?.status, 'cancelled');
assert.equal(createAnimationToolPerformanceDisplay(cancelledPerformanceState)?.title, '已取消');

let resetCount = 0;
let enqueueCount = 0;
const handledStop = handleAnimationToolTriggerPlayback({
  animationToolTrigger: stopTrigger!,
  enqueueAnimationBindings: () => {
    enqueueCount += 1;
  },
  motionBindings: [createBinding('wave-binding', 'Wave Hello', 'happy')],
  resetMotionPlayback: () => {
    resetCount += 1;
  },
  scheduledTriggerTimeoutsRef: { current: [] },
});

assert.deepEqual(handledStop, { handled: true, itemCount: 0, status: 'cancelled' });
assert.equal(resetCount, 1);
assert.equal(enqueueCount, 0);

const handledPlay = handleAnimationToolTriggerPlayback({
  animationToolTrigger: queuedTrigger!,
  enqueueAnimationBindings: () => {
    enqueueCount += 1;
  },
  motionBindings: [createBinding('wave-binding', 'Wave Hello', 'happy')],
  resetMotionPlayback: () => {
    resetCount += 1;
  },
  scheduledTriggerTimeoutsRef: { current: [] },
});

assert.deepEqual(handledPlay, {
  handled: true,
  itemCount: 1,
  status: 'playing',
  triggerKind: 'direct',
});
assert.equal(createAnimationToolPerformanceDisplay({
  itemCount: 1,
  petId: 'primary',
  status: 'playing',
  token: queuedTrigger!.token,
  updatedAt: Date.now(),
})?.title, '演出中');

const audioStates: Array<string | null> = [];
const activeAudioTrigger = createAudioTrigger(11);
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
  trigger: stopTrigger!,
});

assert.deepEqual(audioStates, ['cancelled']);

console.log('animation tool manual stop smoke ok');
