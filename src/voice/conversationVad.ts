// Energy-based voice activity detection for hands-free conversation mode.
// Pure and frame-driven so it can be tested without a microphone.

export interface ConversationVadOptions {
  sampleRate: number;
  /** Silence needed after speech before the utterance is considered finished. */
  endSilenceMs?: number;
  /** Speech shorter than this is treated as a click/cough and dropped. */
  minSpeechMs?: number;
  /** Audio kept from before speech onset so the first syllable is not clipped. */
  preRollMs?: number;
  /** Hard cap so a stuck-open mic still produces utterances. */
  maxUtteranceMs?: number;
  /** Consecutive loud frames needed to start an utterance. */
  onsetFrames?: number;
  /** Absolute RMS floor; quieter input never counts as speech. */
  minSpeechRms?: number;
}

export type ConversationVadEvent =
  | { type: 'speech-start' }
  | { type: 'utterance'; samples: Float32Array; durationMs: number; reason: 'silence' | 'max-length' }
  | { type: 'discarded'; durationMs: number };

const DEFAULTS = {
  endSilenceMs: 700,
  minSpeechMs: 350,
  preRollMs: 300,
  maxUtteranceMs: 15000,
  onsetFrames: 2,
  minSpeechRms: 0.012,
};
const NOISE_FLOOR_ADAPT = 0.05;
const SPEECH_TO_FLOOR_RATIO = 3;
const RELEASE_RATIO = 0.6;

function frameRms(frame: Float32Array) {
  let sum = 0;
  for (let index = 0; index < frame.length; index += 1) sum += frame[index] * frame[index];
  return Math.sqrt(sum / Math.max(1, frame.length));
}

function concat(frames: Float32Array[]) {
  const total = frames.reduce((length, frame) => length + frame.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    merged.set(frame, offset);
    offset += frame.length;
  }
  return merged;
}

export function createConversationVad(options: ConversationVadOptions) {
  const config = { ...DEFAULTS, ...options };
  const msPerSample = 1000 / config.sampleRate;
  let noiseFloor = config.minSpeechRms / SPEECH_TO_FLOOR_RATIO;
  let preRoll: Float32Array[] = [];
  let speech: Float32Array[] | null = null;
  let loudFrames = 0;
  let silenceMs = 0;
  let speechMs = 0;

  const durationOf = (frames: Float32Array[]) => frames.reduce((ms, frame) => ms + frame.length * msPerSample, 0);
  const threshold = () => Math.max(config.minSpeechRms, noiseFloor * SPEECH_TO_FLOOR_RATIO);

  function reset() {
    preRoll = [];
    speech = null;
    loudFrames = 0;
    silenceMs = 0;
    speechMs = 0;
  }

  function finish(reason: 'silence' | 'max-length'): ConversationVadEvent {
    const frames = speech ?? [];
    const spokenMs = speechMs;
    reset();
    if (spokenMs < config.minSpeechMs) return { type: 'discarded', durationMs: spokenMs };
    const samples = concat(frames);
    return { type: 'utterance', samples, durationMs: samples.length * msPerSample, reason };
  }

  function pushIdle(frame: Float32Array, rms: number): ConversationVadEvent | null {
    preRoll.push(frame);
    while (preRoll.length > 1 && durationOf(preRoll) > config.preRollMs) preRoll.shift();
    if (rms >= threshold()) {
      loudFrames += 1;
      if (loudFrames >= config.onsetFrames) {
        speech = [...preRoll];
        speechMs = durationOf(preRoll.slice(-loudFrames));
        preRoll = [];
        return { type: 'speech-start' };
      }
      return null;
    }
    loudFrames = 0;
    noiseFloor += (rms - noiseFloor) * NOISE_FLOOR_ADAPT;
    return null;
  }

  // Feed one capture frame; returns an event when speech starts, ends or is discarded.
  function push(frame: Float32Array): ConversationVadEvent | null {
    const rms = frameRms(frame);
    if (!speech) return pushIdle(frame, rms);
    const frameMs = frame.length * msPerSample;
    speech.push(frame);
    if (rms >= threshold() * RELEASE_RATIO) {
      silenceMs = 0;
      speechMs += frameMs;
    } else {
      silenceMs += frameMs;
    }
    if (silenceMs >= config.endSilenceMs) return finish('silence');
    if (durationOf(speech) >= config.maxUtteranceMs) return finish('max-length');
    return null;
  }

  return { push, reset, isInSpeech: () => speech !== null, getNoiseFloor: () => noiseFloor };
}
