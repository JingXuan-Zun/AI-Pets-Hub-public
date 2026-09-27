import assert from 'node:assert/strict';
import {
  beginReplyTextMouthActivity,
  endReplyTextMouthActivity,
  registerReplyMouthPlayback,
  resetReplyMouthSignals,
  sampleReplyMouthSignal,
  writeReplyTextMouthActivity,
} from '../src/pet-runtime/performance/replyMouthSignalRuntime';

const petId = 'mouth-signal-smoke';
resetReplyMouthSignals();
beginReplyTextMouthActivity(petId, 'text', 100);
writeReplyTextMouthActivity(petId, 'text', 'hello', 120);
const textFrame = sampleReplyMouthSignal(petId, 170);
assert.equal(textFrame.mode, 'text');
assert.ok(textFrame.intensity > 0, 'streaming text should produce a mouth signal');

endReplyTextMouthActivity(petId, 'text', 200);
assert.equal(sampleReplyMouthSignal(petId, 500).mode, 'inactive');

const unregisterQuietAudio = registerReplyMouthPlayback({
  petId,
  playback: { isPlaybackActive: () => true, sampleOutputLevel: () => 0.72 },
  sourceId: 'audio-level',
  text: 'voice',
});
assert.deepEqual(sampleReplyMouthSignal(petId), { intensity: 0.72, mode: 'audio' });
unregisterQuietAudio();

const unregisterFallbackAudio = registerReplyMouthPlayback({
  petId,
  playback: { getPlaybackPositionMs: () => 50, isPlaybackActive: () => true },
  sourceId: 'audio-fallback',
  text: 'voice',
});
const fallbackFrame = sampleReplyMouthSignal(petId);
assert.equal(fallbackFrame.mode, 'audio');
assert.ok(fallbackFrame.intensity > 0, 'unsampled audio should use deterministic text timing');
unregisterFallbackAudio();
resetReplyMouthSignals();

console.log('reply mouth signal runtime smoke passed');
