import assert from 'node:assert/strict';
import { joinWavs, splitBridgeVoiceText } from '../src/qq-bridge/bridgeVoiceAudio';

// A long reply for QQ / WeChat is spoken in the pieces the chat window uses, then joined:
// one long piece made the voice model lose parts of it.

function wav(samples: number[], rate = 32000) {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const tag = (offset: number, value: string) => [...value].forEach((char, index) => { out[offset + index] = char.charCodeAt(0); });
  tag(0, 'RIFF'); view.setUint32(4, out.length - 8, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  tag(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return out.buffer;
}

const pieces = splitBridgeVoiceText('今天天气很好，我们一起出去走走吧。公园里的花都开了，听说湖边还有人在放风筝！你想先去哪里？要不要顺便买点吃的');
assert.ok(pieces.length >= 3, `a long reply is cut into pieces (${pieces.length})`);
assert.equal(pieces.join('').replace(/\s/gu, ''), '今天天气很好，我们一起出去走走吧。公园里的花都开了，听说湖边还有人在放风筝！你想先去哪里？要不要顺便买点吃的', 'no words lost when cutting');
assert.deepEqual(splitBridgeVoiceText('好的。'), ['好的。'], 'a short reply stays one piece');

const joined = joinWavs([wav([1, 2, 3]), wav([4, 5])])!;
const view = new DataView(joined.buffer);
const gap = Math.floor(32000 * 0.15) * 2;
assert.equal(view.getUint32(40, true), 10 + gap, 'data size = both parts + the pause');
assert.equal(view.getUint32(4, true), joined.length - 8, 'RIFF size matches');
assert.deepEqual([view.getInt16(44, true), view.getInt16(48, true), view.getInt16(50 + gap, true)], [1, 3, 4], 'samples in order, pause between');
assert.equal(joinWavs([new ArrayBuffer(10)]), null, 'not a WAV: nothing joined (the caller falls back)');

console.log('bridge voice audio smoke ok: 8 checks');
