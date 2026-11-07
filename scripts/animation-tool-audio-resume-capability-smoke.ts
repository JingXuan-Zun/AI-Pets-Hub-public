import assert from 'node:assert/strict';
import { type DesktopPetAnimationToolTrigger } from '../src/chatState';
import { createPlayableAnimationToolAudioPlaybackState } from '../src/components/pet/animationToolAudioPlaybackState';

const trigger = {
  animationIds: ['wave_hello'],
  audio: {
    playbackUrl: 'https://example.test/song.mp3',
    source: 'audio',
    sourceRef: 'https://example.test/song.mp3',
    startDelayMs: 120,
  },
  source: 'agent-skill',
  token: 88,
} satisfies DesktopPetAnimationToolTrigger;

const playingState = createPlayableAnimationToolAudioPlaybackState({
  petId: 'primary',
  status: 'playing',
  trigger,
});
assert.equal(playingState?.resumeSupported, false);
assert.equal(playingState?.playbackPositionMs, 0);
assert.match(playingState?.resumeUnsupportedReason ?? '', /saved playback position/u);

const endedState = createPlayableAnimationToolAudioPlaybackState({
  petId: 'primary',
  status: 'ended',
  trigger,
});
assert.equal(endedState?.resumeSupported, undefined);
assert.equal(endedState?.resumeUnsupportedReason, undefined);

console.log('animation tool audio resume capability smoke ok');
