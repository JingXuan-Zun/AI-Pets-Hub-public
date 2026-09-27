import assert from 'node:assert/strict';
import { createPreparedPlaybackFactory } from '../src/voice/ttsPlaybackPrimitives';

const prepared = createPreparedPlaybackFactory(() => ({
  done: Promise.resolve(),
  getPlaybackPositionMs: () => 125,
  isPlaybackActive: () => true,
  sampleOutputLevel: () => 0.64,
  stop: () => undefined,
}));
const playback = prepared.play();

assert.equal(playback.getPlaybackPositionMs?.(), 125);
assert.equal(playback.isPlaybackActive?.(), true);
assert.equal(playback.sampleOutputLevel?.(), 0.64);
await playback.done;

console.log('voice playback mouth signal wiring smoke passed');
