import assert from 'node:assert/strict';
import { type DesktopPetAnimationToolAudioPlaybackState, type DesktopPetAnimationToolTrigger } from '../src/chatState';
import { createAnimationToolAudioPlaybackDisplay } from '../src/components/pet/animationToolAudioPlaybackDisplay';
import {
  createAnimationToolAudioPlaybackSession,
} from '../src/components/pet/animationToolAudioPlaybackSession';
import {
  controlAnimationToolAudioRuntime,
  type AnimationToolAudioPlaybackRefs,
} from '../src/components/pet/animationToolAudioPlaybackRuntime';
import { createPlayableAnimationToolAudioPlaybackState } from '../src/components/pet/animationToolAudioPlaybackState';
import { createAudioElementPlaybackSession } from '../src/voice/ttsPlaybackPrimitives';
import { type VoicePlaybackSession } from '../src/voice/types';

function createAudioElementStub() {
  return {
    currentTime: 0,
    onended: null,
    onerror: null,
    pauseCount: 0,
    playCount: 0,
    playbackRate: 1,
    pause() {
      this.pauseCount += 1;
    },
    play() {
      this.playCount += 1;
      return Promise.resolve();
    },
  } as unknown as HTMLAudioElement & {
    pauseCount: number;
    playCount: number;
  };
}

function createPlayableTrigger(token: number): DesktopPetAnimationToolTrigger {
  return {
    animationIds: ['wave_hello'],
    audio: {
      durationMs: 7500,
      playbackUrl: 'https://example.test/song.mp3',
      source: 'audio',
      sourceRef: 'https://example.test/song.mp3',
    },
    source: 'agent-skill',
    token,
  };
}

function createRefs(
  activeTrigger: DesktopPetAnimationToolTrigger,
  playbackSession: VoicePlaybackSession,
): AnimationToolAudioPlaybackRefs {
  return {
    activeAudioTriggerRef: { current: activeTrigger },
    activePlaybackTokenRef: { current: activeTrigger.token },
    playbackSessionRef: { current: playbackSession },
    startTimerRef: { current: null },
  };
}

const audio = createAudioElementStub();
const session = createAudioElementPlaybackSession(audio, 'smoke audio');
assert.equal(audio.playCount, 1);
audio.currentTime = 1.25;
const pauseSnapshot = session.pause?.();
assert.equal(audio.pauseCount, 1);
assert.equal(pauseSnapshot?.resumeSupported, true);
assert.equal(pauseSnapshot?.playbackPositionMs, 1250);
assert.equal(pauseSnapshot?.playbackState, 'paused');
const resumeSnapshot = session.resume?.();
assert.equal(audio.playCount, 2);
assert.equal(resumeSnapshot?.resumeSupported, true);
assert.equal(resumeSnapshot?.playbackPositionMs, 1250);
assert.equal(resumeSnapshot?.playbackState, 'playing');

const trigger = createPlayableTrigger(44);
const publishedStates: DesktopPetAnimationToolAudioPlaybackState[] = [];
const refs = createRefs(trigger, session);
const publishStatus = (
  sourceTrigger: DesktopPetAnimationToolTrigger,
  status: 'cancelled' | 'ended' | 'failed' | 'paused' | 'pending' | 'playing',
  _errorMessage?: string,
  controlSnapshot?: Parameters<typeof createPlayableAnimationToolAudioPlaybackState>[0]['controlSnapshot'],
) => {
  const state = createPlayableAnimationToolAudioPlaybackState({
    controlSnapshot,
    petId: 'primary',
    status,
    trigger: sourceTrigger,
  });
  if (state) {
    publishedStates.push(state);
  }
};

audio.currentTime = 2.4;
assert.equal(controlAnimationToolAudioRuntime(refs, publishStatus, {
  animationIds: [],
  control: 'pause',
  source: 'user-direct',
  token: 45,
}), true);
assert.equal(publishedStates[0]?.status, 'paused');
assert.equal(publishedStates[0]?.durationMs, 7500);
assert.equal(publishedStates[0]?.resumeSupported, true);
assert.equal(publishedStates[0]?.playbackPositionMs, 2400);
assert.match(createAnimationToolAudioPlaybackDisplay(publishedStates[0])?.detail ?? '', /2\.4s \/ 7\.5s/u);

assert.equal(controlAnimationToolAudioRuntime(refs, publishStatus, {
  animationIds: [],
  control: 'resume',
  source: 'user-direct',
  token: 46,
}), true);
assert.equal(publishedStates[1]?.status, 'playing');
assert.equal(publishedStates[1]?.resumeSupported, true);
assert.equal(publishedStates[1]?.playbackPositionMs, 2400);

session.stop();

const previousAudio = globalThis.Audio;
(globalThis as typeof globalThis & { Audio: unknown }).Audio = function AudioStub() {
  return createAudioElementStub();
};
const delayedSessionResult = await createAnimationToolAudioPlaybackSession({
  playbackUrl: 'https://example.test/fallback.mp3',
  startDelayMs: 0,
});
const delayedPauseSnapshot = delayedSessionResult.playback.pause?.();
assert.equal(delayedPauseSnapshot?.resumeSupported, true);
assert.equal(delayedPauseSnapshot?.playbackState, 'paused');
const delayedResumeSnapshot = delayedSessionResult.playback.resume?.();
assert.equal(delayedResumeSnapshot?.resumeSupported, true);
assert.equal(delayedResumeSnapshot?.playbackState, 'playing');
delayedSessionResult.playback.stop();
if (previousAudio === undefined) {
  delete (globalThis as typeof globalThis & { Audio?: unknown }).Audio;
} else {
  (globalThis as typeof globalThis & { Audio: unknown }).Audio = previousAudio;
}

console.log('animation tool audio resume runtime smoke ok');
