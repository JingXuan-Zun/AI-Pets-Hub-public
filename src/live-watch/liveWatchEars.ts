import { isPetAudible } from '../components/chat/voiceConversationBusy';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import type { PetConfig } from '../types';
import { resolveConversationSttSettings } from '../voice/conversationSttModel';
import { encodeWavBase64 } from '../voice/stt';
import { findHeardCut, isSongLikely, isUsefulHeard, normalizeHeardLanguage, type LiveHeard } from './liveWatchRules';

const RATE = 16_000;
const LISTEN_EVERY_MS = 1000;
const MIN_WINDOW_SECONDS = 0.5;
// Nothing recognized for this long: drop it (music, silence) instead of growing the window.
const DROP_SILENCE_SECONDS = 2;

interface Transcript { lang?: string; text: string; times?: number[]; tokens?: string[] }

async function recognize(samples: Float32Array, settings: PetConfig['settings']): Promise<Transcript> {
  try {
    const result = await desktopPetShellRuntime.transcribeLocalVoice({ audioBase64: encodeWavBase64(samples, RATE), settings }) as Transcript | null;
    return { lang: normalizeHeardLanguage(result?.lang), text: typeof result?.text === 'string' ? result.text : '', times: result?.times, tokens: result?.tokens };
  } catch {
    // The recognizer reports "no valid text" as an error: here that just means nothing was said.
    return { text: '' };
  }
}

export interface LiveWatchEars { stop: () => void }

/**
 * Ears: the system sound (what the user hears), recognized by the local model. Every second
 * it listens to everything since the last cut and cuts after a finished sentence, a pause, or
 * at the latest after a few seconds, so she gets whole sentences. Her own voice is not heard:
 * while she speaks the samples are silenced.
 */
export async function startLiveWatchEars(options: {
  config: () => PetConfig;
  onHeard: (heard: LiveHeard) => void;
  /** Seconds since watching started, the clock everything is stamped with. */
  clock: () => number;
}): Promise<LiveWatchEars | null> {
  const stt = await resolveConversationSttSettings(options.config().settings);
  if ('error' in stt) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  } catch {
    return null;
  }
  stream.getVideoTracks().forEach((track) => track.stop());
  if (!stream.getAudioTracks().length) return null;
  const context = new AudioContext({ sampleRate: RATE });
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0; // keeps the graph running without playing the sound twice
  let buffer = new Float32Array(RATE * 30);
  let length = 0;
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    if (length + input.length > buffer.length) {
      const grown = new Float32Array(buffer.length * 2);
      grown.set(buffer.subarray(0, length));
      buffer = grown;
    }
    if (isPetAudible()) buffer.fill(0, length, length + input.length);
    else buffer.set(input, length);
    length += input.length;
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);

  let stopped = false;
  let busy = false;
  const languages: string[] = [];
  const dropUntil = (sample: number) => {
    buffer.copyWithin(0, sample, length);
    length -= sample;
  };
  const listen = async () => {
    if (busy || stopped) return;
    const windowSeconds = length / RATE;
    if (windowSeconds < MIN_WINDOW_SECONDS) return;
    busy = true;
    try {
      const end = length;
      const heard = await recognize(buffer.slice(0, end), stt.settings);
      if (stopped) return;
      if (!heard.text.trim() || !heard.tokens?.length || !heard.times?.length) {
        if (windowSeconds >= DROP_SILENCE_SECONDS) dropUntil(end);
        return;
      }
      const cut = findHeardCut(heard.tokens, heard.times, end / RATE, false);
      if (cut === null) return;
      const cutSample = Math.min(end, Math.round(cut * RATE));
      const piece = cutSample >= end ? heard : await recognize(buffer.slice(0, cutSample), stt.settings);
      const endedAt = options.clock() - (length - cutSample) / RATE;
      dropUntil(cutSample);
      if (stopped) return;
      const lang = piece.lang || heard.lang || '';
      if (lang) { languages.push(lang); if (languages.length > 10) languages.shift(); }
      // Scraps ("。", "The.") are dropped; pieces while the language keeps jumping are song lyrics.
      if (isUsefulHeard(piece.text)) options.onHeard({ at: endedAt, song: isSongLikely(languages), text: piece.text.trim() });
    } finally {
      busy = false;
    }
  };
  const timer = window.setInterval(() => { void listen(); }, LISTEN_EVERY_MS);
  return {
    stop() {
      stopped = true;
      window.clearInterval(timer);
      processor.onaudioprocess = null;
      stream.getTracks().forEach((track) => track.stop());
      void context.close().catch(() => undefined);
    },
  };
}
