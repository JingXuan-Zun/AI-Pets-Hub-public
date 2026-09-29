import assert from 'node:assert/strict';
import {
  type DesktopPetAnimationToolAudioPlaybackState,
  type DesktopPetAnimationToolTrigger,
} from '../src/chatState';
import {
  createAnimationToolAudioProgressDetail,
  resolveAnimationToolAudioElapsedMs,
} from '../src/components/pet/animationToolAudioPlaybackProgress';
import { shouldTickAnimationToolAudioProgress } from '../src/components/pet/animationToolAudioProgressTicker';
import {
  createAnimationToolBadgeScrubberLabel,
  createAnimationToolBadgeScrubberState,
  resolveAnimationToolBadgeScrubberSeekPosition,
} from '../src/components/pet/animationToolBadgeScrubberControls';
import { createAnimationToolBadgeSeekTarget } from '../src/components/pet/animationToolBadgeSeekControls';
import { createAnimationToolPlaybackBadgeControls } from '../src/components/pet/animationToolPlaybackBadgeControls';

const replayableTrigger = {
  animationIds: ['intro_pose'],
  source: 'agent-skill',
  token: 7,
} satisfies DesktopPetAnimationToolTrigger;

const playingAudioState = {
  durationMs: 7500,
  petId: 'primary',
  playbackPositionMs: 2400,
  playbackUrl: 'https://example.test/song.mp3',
  resumeSupported: true,
  scheduledDelayMs: 0,
  source: 'song',
  sourceRef: 'song:main-theme',
  status: 'playing',
  token: 11,
  updatedAt: 1000,
} satisfies DesktopPetAnimationToolAudioPlaybackState;

assert.equal(resolveAnimationToolAudioElapsedMs(playingAudioState, 3500), 4900);
assert.equal(createAnimationToolAudioProgressDetail(playingAudioState, 3500), 'elapsed 4.9s / 7.5s');
assert.equal(resolveAnimationToolAudioElapsedMs(playingAudioState, 20000), 7500);
assert.equal(shouldTickAnimationToolAudioProgress(playingAudioState), true);

assert.equal(shouldTickAnimationToolAudioProgress({
  ...playingAudioState,
  durationMs: undefined,
  resumeSupported: false,
}), false);

const pendingControls = createAnimationToolPlaybackBadgeControls({
  audioState: {
    ...playingAudioState,
    playbackPositionMs: 0,
    resumeSupported: false,
    status: 'pending',
  },
  lastReplayableTrigger: replayableTrigger,
  performanceState: undefined,
});
assert.equal(pendingControls.pause.visible, true);
assert.equal(pendingControls.pause.disabled, true);
assert.match(pendingControls.pause.title, /after playback starts/u);
assert.equal(pendingControls.replay.visible, true);
assert.equal(pendingControls.stop.visible, true);

const pausedControls = createAnimationToolPlaybackBadgeControls({
  audioState: {
    ...playingAudioState,
    status: 'paused',
  },
  lastReplayableTrigger: null,
  performanceState: undefined,
});
assert.equal(pausedControls.resume.visible, true);
assert.equal(pausedControls.resume.disabled, undefined);
assert.equal(pausedControls.pause.visible, false);

const scheduledControls = createAnimationToolPlaybackBadgeControls({
  audioState: null,
  lastReplayableTrigger: replayableTrigger,
  performanceState: {
    itemCount: 3,
    petId: 'primary',
    status: 'playing',
    token: 12,
    triggerKind: 'scheduled',
    updatedAt: 2000,
  },
});
assert.equal(scheduledControls.pause.visible, true);
assert.equal(scheduledControls.pause.disabled, undefined);
assert.equal(scheduledControls.stop.visible, true);

const seekBackwardTarget = createAnimationToolBadgeSeekTarget({
  direction: 'backward',
  nowMs: 3500,
  state: playingAudioState,
});
assert.equal(seekBackwardTarget.visible, true);
assert.equal(seekBackwardTarget.positionMs, 0);

const seekForwardTarget = createAnimationToolBadgeSeekTarget({
  direction: 'forward',
  nowMs: 3500,
  state: playingAudioState,
});
assert.equal(seekForwardTarget.visible, true);
assert.equal(seekForwardTarget.positionMs, 7500);
assert.equal(seekForwardTarget.disabled, undefined);

const seekEndTarget = createAnimationToolBadgeSeekTarget({
  direction: 'forward',
  nowMs: 20000,
  state: playingAudioState,
});
assert.equal(seekEndTarget.positionMs, 7500);
assert.equal(seekEndTarget.disabled, true);

const scrubberState = createAnimationToolBadgeScrubberState({
  nowMs: 3500,
  state: playingAudioState,
});
assert.equal(scrubberState.visible, true);
assert.equal(scrubberState.elapsedMs, 4900);
assert.equal(scrubberState.durationMs, 7500);
assert.equal(scrubberState.label, '4.9s/7.5s');
assert.equal(scrubberState.percent, 65);
assert.equal(createAnimationToolBadgeScrubberLabel({
  durationMs: scrubberState.durationMs,
  positionMs: 3000,
}), '3s/7.5s');
assert.equal(resolveAnimationToolBadgeScrubberSeekPosition({
  durationMs: scrubberState.durationMs,
  percent: 40,
}), 3000);
assert.equal(createAnimationToolBadgeScrubberState({
  state: {
    ...playingAudioState,
    durationMs: undefined,
  },
}).visible, false);
assert.equal(createAnimationToolBadgeScrubberState({
  state: {
    ...playingAudioState,
    resumeSupported: false,
  },
}).visible, false);

const playingControls = createAnimationToolPlaybackBadgeControls({
  audioState: playingAudioState,
  lastReplayableTrigger: replayableTrigger,
  performanceState: undefined,
});
assert.equal(playingControls.seekBackward.visible, true);
assert.equal(playingControls.seekForward.visible, true);

console.log('animation tool long performance controls smoke ok');
