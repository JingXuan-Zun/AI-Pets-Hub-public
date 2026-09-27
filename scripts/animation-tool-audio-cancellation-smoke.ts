import assert from 'node:assert/strict';
import { type DesktopPetAnimationToolAudioPlaybackState, type DesktopPetAnimationToolTrigger } from '../src/chatState';
import {
  handleAnimationToolAudioTrigger,
  type AnimationToolAudioPlaybackRefs,
} from '../src/components/pet/animationToolAudioPlaybackRuntime';
import { createPlayableAnimationToolAudioPlaybackState } from '../src/components/pet/animationToolAudioPlaybackState';

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
      startDelayMs: 40,
    },
    source: 'agent-skill',
    token,
  };
}

const noAudioTrigger = {
  animationIds: ['wave_hello'],
  source: 'agent-skill',
  token: 2,
} satisfies DesktopPetAnimationToolTrigger;

const cancelledStates: Array<DesktopPetAnimationToolAudioPlaybackState | null> = [];
const interruptedTrigger = createPlayableTrigger(1);
handleAnimationToolAudioTrigger({
  petId: 'primary',
  publishState: (_petId, state) => cancelledStates.push(state),
  publishStatus: (trigger, status) => {
    cancelledStates.push(createPlayableAnimationToolAudioPlaybackState({
      petId: 'primary',
      status,
      trigger,
    }));
  },
  refs: createRefs(interruptedTrigger),
  trigger: noAudioTrigger,
});

assert.deepEqual(
  cancelledStates.map((state) => state?.status ?? null),
  ['cancelled'],
  'interrupting playable audio with a no-audio trigger should preserve the cancelled state',
);
assert.equal(cancelledStates[0]?.token, 1);

const idleStates: Array<DesktopPetAnimationToolAudioPlaybackState | null> = [];
handleAnimationToolAudioTrigger({
  petId: 'primary',
  publishState: (_petId, state) => idleStates.push(state),
  publishStatus: () => {
    throw new Error('idle no-audio trigger should not publish a cancellation');
  },
  refs: createRefs(null),
  trigger: noAudioTrigger,
});

assert.deepEqual(
  idleStates,
  [null],
  'a no-audio trigger with no active audio should still clear the visible audio badge',
);

console.log('animation tool audio cancellation smoke ok');
