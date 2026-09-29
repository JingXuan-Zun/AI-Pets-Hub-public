import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';

desktopPetChatStore.reset();
desktopPetChatStore.replayAnimationToolTrigger('primary');
assert.equal(desktopPetChatStore.getState().animationToolTriggersByPetId.primary, undefined);

desktopPetChatStore.queueAnimationToolTrigger(
  'primary',
  ['intro_pose', 'chorus_dance'],
  'agent-skill',
  [
    { animationId: 'intro_pose', delayMs: 0 },
    { animationId: 'chorus_dance', delayMs: 1200 },
  ],
  {
    durationMs: 43000,
    offsetMs: 80,
    playbackUrl: 'https://example.test/song.mp3',
    source: 'song',
    sourceRef: 'song:main-theme',
    startDelayMs: 250,
  },
);

const originalTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(originalTrigger?.control, undefined);
assert.equal(
  desktopPetChatStore.getState().lastReplayableAnimationToolTriggersByPetId.primary?.token,
  originalTrigger?.token,
);

desktopPetChatStore.pauseAnimationToolTrigger('primary');
const pauseTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(pauseTrigger?.control, 'pause');
assert.equal(
  desktopPetChatStore.getState().lastReplayableAnimationToolTriggersByPetId.primary?.token,
  originalTrigger?.token,
);

desktopPetChatStore.stopAnimationToolTrigger('primary');
const stopTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(stopTrigger?.control, 'stop');
assert.equal(
  desktopPetChatStore.getState().lastReplayableAnimationToolTriggersByPetId.primary?.token,
  originalTrigger?.token,
);

desktopPetChatStore.replayAnimationToolTrigger('primary');
const replayTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(replayTrigger?.control, undefined);
assert.equal(replayTrigger?.source, 'agent-skill');
assert.deepEqual(replayTrigger?.animationIds, originalTrigger?.animationIds);
assert.deepEqual(replayTrigger?.audio, originalTrigger?.audio);
assert.deepEqual(replayTrigger?.schedule, originalTrigger?.schedule);
assert.notEqual(replayTrigger?.audio, originalTrigger?.audio);
assert.notEqual(replayTrigger?.schedule, originalTrigger?.schedule);
assert.equal((replayTrigger?.token ?? 0) > (stopTrigger?.token ?? 0), true);
assert.equal(
  desktopPetChatStore.getState().lastReplayableAnimationToolTriggersByPetId.primary?.token,
  replayTrigger?.token,
);

console.log('animation tool replay control smoke ok');
