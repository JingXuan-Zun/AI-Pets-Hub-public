import assert from 'node:assert/strict';
import { createConversationVad, type ConversationVadEvent } from '../src/voice/conversationVad';

const SAMPLE_RATE = 48000;
const FRAME = 1024;
const frameMs = (FRAME / SAMPLE_RATE) * 1000;
let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

let seed = 7;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
function frames(ms: number, kind: 'noise' | 'speech', level: number) {
  const out: Float32Array[] = [];
  for (let t = 0; t < ms; t += frameMs) {
    const frame = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i += 1) {
      frame[i] = kind === 'noise' ? random() * level * Math.sqrt(3) : Math.sin(((t / 1000) * SAMPLE_RATE + i) * 0.05) * level * Math.SQRT2;
    }
    out.push(frame);
  }
  return out;
}
function run(vad: ReturnType<typeof createConversationVad>, input: Float32Array[]) {
  const events: ConversationVadEvent[] = [];
  for (const frame of input) {
    const event = vad.push(frame);
    if (event) events.push(event);
  }
  return events;
}
const summary = (events: ConversationVadEvent[]) => events.map((event) => (
  event.type === 'utterance' ? `utterance:${event.reason}:${Math.round(event.durationMs / 100) / 10}s` : event.type
));

// Quiet room, one sentence, then silence → one utterance ending on silence, with pre-roll kept.
let vad = createConversationVad({ sampleRate: SAMPLE_RATE });
check(run(vad, frames(1500, 'noise', 0.003)), [], 'background noise never triggers');
const sentence = run(vad, [...frames(1200, 'speech', 0.1), ...frames(900, 'noise', 0.003)]);
check(summary(sentence).map((item) => item.replace(/:\d+(\.\d)?s$/u, '')), ['speech-start', 'utterance:silence'], 'sentence detected');
const utterance = sentence[1] as Extract<ConversationVadEvent, { type: 'utterance' }>;
check(utterance.durationMs > 1200 + 600 && utterance.durationMs < 1200 + 300 + 800, true, `utterance spans speech + pre-roll + end silence (${utterance.durationMs}ms)`);
check(vad.isInSpeech(), false, 'idle after utterance');

// A cough/click shorter than minSpeechMs is dropped.
vad = createConversationVad({ sampleRate: SAMPLE_RATE });
run(vad, frames(1000, 'noise', 0.003));
check(summary(run(vad, [...frames(150, 'speech', 0.1), ...frames(900, 'noise', 0.003)])).map((s) => s.split(':')[0]), ['speech-start', 'discarded'], 'short click discarded');

// Talking non-stop is cut at maxUtteranceMs.
vad = createConversationVad({ sampleRate: SAMPLE_RATE, maxUtteranceMs: 4000 });
const long = run(vad, frames(5000, 'speech', 0.1));
check(long.map((event) => (event.type === 'utterance' ? event.reason : event.type)).slice(0, 2), ['speech-start', 'max-length'], 'max length cut');

// Steady fan noise above the absolute floor adapts instead of triggering.
vad = createConversationVad({ sampleRate: SAMPLE_RATE });
check(run(vad, frames(4000, 'noise', 0.009)), [], 'steady fan noise does not trigger');
check(vad.getNoiseFloor() > 0.006, true, 'noise floor adapted upward');
check(summary(run(vad, [...frames(1000, 'speech', 0.12), ...frames(900, 'noise', 0.009)])).map((s) => s.split(':')[0]), ['speech-start', 'utterance'], 'speech still detected over fan noise');

// Pause/reset (half-duplex) drops a half-heard utterance.
vad = createConversationVad({ sampleRate: SAMPLE_RATE });
run(vad, [...frames(800, 'noise', 0.003), ...frames(600, 'speech', 0.1)]);
check(vad.isInSpeech(), true, 'mid utterance');
vad.reset();
check([vad.isInSpeech(), run(vad, frames(900, 'noise', 0.003))], [false, []], 'reset discards partial speech');

console.log(`voice conversation VAD passed: ${cases} cases`);
