import { getVoiceErrorMessage } from './errorMessages';
import { createDeferredPlaybackDone, createPlaybackControlSnapshot } from './audioPlaybackControlSnapshot';
import { clampSpeechPlaybackRate } from './speechPlaybackRate';
import {
  disconnectAudioNode,
  resolveWebAudioCrossfadeWindow,
  resolveWebAudioPlaybackPositionMs,
  WEB_AUDIO_PLAYBACK_LEAD_SEC,
} from './resumableAudioBufferPlaybackMath';
import { type VoicePlaybackSession, type VoicePlaybackStartOptions } from './types';

type WebAudioContextResolver = () => AudioContext | null;

type ActiveNodes = {
  analyserNode: AnalyserNode | null;
  gainNode: GainNode | null;
  levelSamples: Uint8Array | null;
  sourceNode: AudioBufferSourceNode | null;
};

type WebAudioPlaybackState = {
  audioBuffer: AudioBuffer;
  audioContext: AudioContext;
  bufferDurationMs: number;
  finalized: boolean;
  nodes: ActiveNodes;
  offsetMs: number;
  paused: boolean;
  playbackRate: number;
  rejectDone: (error: Error) => void;
  resolveDone: () => void;
  scheduledEndTime: number;
  scheduledStartTime: number;
  sourceLabel: string;
  startedAtTime: number | null;
};

function cleanupNodes(nodes: ActiveNodes) {
  if (nodes.sourceNode) {
    nodes.sourceNode.onended = null;
  }
  disconnectAudioNode(nodes.sourceNode);
  disconnectAudioNode(nodes.gainNode);
  disconnectAudioNode(nodes.analyserNode);
  nodes.sourceNode = null;
  nodes.gainNode = null;
  nodes.analyserNode = null;
  nodes.levelSamples = null;
}

function scheduleGain(options: {
  audioContext: AudioContext;
  endTime: number;
  gainNode: GainNode;
  remainingDurationSec: number;
  startTime: number;
}) {
  const { fadeInSec, fadeOutSec } = resolveWebAudioCrossfadeWindow(options.remainingDurationSec);
  const fadeOutStartTime = Math.max(options.startTime + fadeInSec, options.endTime - fadeOutSec);

  options.gainNode.gain.cancelScheduledValues(options.audioContext.currentTime);
  if (fadeInSec > 0) {
    options.gainNode.gain.setValueAtTime(0.0001, options.startTime);
    options.gainNode.gain.linearRampToValueAtTime(1, options.startTime + fadeInSec);
  } else {
    options.gainNode.gain.setValueAtTime(1, options.startTime);
  }
  if (fadeOutSec > 0 && fadeOutStartTime < options.endTime) {
    options.gainNode.gain.setValueAtTime(1, fadeOutStartTime);
    options.gainNode.gain.linearRampToValueAtTime(0.0001, options.endTime);
  }
}

function createInitialWebAudioPlaybackState(options: {
  audioBuffer: AudioBuffer,
  audioContext: AudioContext;
  playbackOptions: VoicePlaybackStartOptions;
  rejectDone: (error: Error) => void;
  resolveDone: () => void;
  sourceLabel: string;
}): WebAudioPlaybackState {
  const playbackRate = clampSpeechPlaybackRate(options.playbackOptions.playbackRate);
  const scheduledStartTime = Math.max(
    typeof options.playbackOptions.startAtTime === 'number' ? options.playbackOptions.startAtTime : 0,
    options.audioContext.currentTime + WEB_AUDIO_PLAYBACK_LEAD_SEC,
  );

  return {
    audioBuffer: options.audioBuffer,
    audioContext: options.audioContext,
    bufferDurationMs: Math.round(options.audioBuffer.duration * 1000),
    finalized: false,
    nodes: { analyserNode: null, gainNode: null, levelSamples: null, sourceNode: null },
    offsetMs: 0,
    paused: false,
    playbackRate,
    rejectDone: options.rejectDone,
    resolveDone: options.resolveDone,
    scheduledEndTime: scheduledStartTime + (options.audioBuffer.duration / playbackRate),
    scheduledStartTime,
    sourceLabel: options.sourceLabel,
    startedAtTime: null,
  };
}

function getWebAudioPlaybackPositionMs(state: WebAudioPlaybackState) {
  return resolveWebAudioPlaybackPositionMs({
    audioContext: state.audioContext,
    bufferDurationMs: state.bufferDurationMs,
    offsetMs: state.offsetMs,
    playbackRate: state.playbackRate,
    startedAtTime: state.startedAtTime,
  });
}

function finalizeWebAudioSuccess(state: WebAudioPlaybackState) {
  if (state.finalized) {
    return;
  }

  state.finalized = true;
  cleanupNodes(state.nodes);
  state.resolveDone();
}

function finalizeWebAudioError(state: WebAudioPlaybackState, error: unknown) {
  if (state.finalized) {
    return;
  }

  state.finalized = true;
  cleanupNodes(state.nodes);
  state.rejectDone(new Error(getVoiceErrorMessage(error, `${state.sourceLabel} failed.`)));
}

function stopWebAudioSource(state: WebAudioPlaybackState) {
  try {
    state.nodes.sourceNode?.stop();
  } catch {
    // Ignore stop failures for already-ended sources.
  }
}

function startWebAudioSource(state: WebAudioPlaybackState, nextOffsetMs: number, startAtTime?: number | null) {
  cleanupNodes(state.nodes);
  void state.audioContext.resume().catch(() => undefined);

  const sourceNode = state.audioContext.createBufferSource();
  const gainNode = state.audioContext.createGain();
  const analyserNode = state.audioContext.createAnalyser();
  const offsetSec = Math.max(0, Math.min(state.audioBuffer.duration, nextOffsetMs / 1000));
  const startTime = Math.max(startAtTime ?? 0, state.audioContext.currentTime + WEB_AUDIO_PLAYBACK_LEAD_SEC);
  const remainingDurationSec = Math.max(0, (state.audioBuffer.duration - offsetSec) / state.playbackRate);
  const endTime = startTime + remainingDurationSec;

  sourceNode.buffer = state.audioBuffer;
  sourceNode.playbackRate.setValueAtTime(state.playbackRate, state.audioContext.currentTime);
  sourceNode.connect(gainNode);
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.42;
  gainNode.connect(analyserNode);
  analyserNode.connect(state.audioContext.destination);
  sourceNode.onended = () => {
    if (!state.paused) {
      finalizeWebAudioSuccess(state);
    }
  };
  scheduleGain({ audioContext: state.audioContext, endTime, gainNode, remainingDurationSec, startTime });
  state.offsetMs = Math.round(offsetSec * 1000);
  state.startedAtTime = startTime;
  state.scheduledStartTime = startTime;
  state.scheduledEndTime = endTime;
  state.nodes.sourceNode = sourceNode;
  state.nodes.gainNode = gainNode;
  state.nodes.analyserNode = analyserNode;
  state.nodes.levelSamples = new Uint8Array(analyserNode.fftSize);
  sourceNode.start(startTime, offsetSec);
}

function isWebAudioPlaybackActive(state: WebAudioPlaybackState) {
  const now = state.audioContext.currentTime;
  return !state.finalized
    && !state.paused
    && state.startedAtTime !== null
    && now >= state.startedAtTime
    && now < state.scheduledEndTime;
}

function sampleWebAudioOutputLevel(state: WebAudioPlaybackState) {
  const analyserNode = state.nodes.analyserNode;
  const samples = state.nodes.levelSamples;
  if (!analyserNode || !samples || !isWebAudioPlaybackActive(state)) {
    return null;
  }
  analyserNode.getByteTimeDomainData(samples);
  let squaredSum = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    squaredSum += normalized * normalized;
  }
  const rms = Math.sqrt(squaredSum / samples.length);
  return Math.max(0, Math.min(1, (rms - 0.012) * 30));
}

function createWebAudioSessionControls(state: WebAudioPlaybackState, done: Promise<void>): VoicePlaybackSession {
  return {
    stop: () => {
      stopWebAudioSource(state);
      finalizeWebAudioSuccess(state);
    },
    pause: () => {
      if (state.finalized) {
        return null;
      }

      state.paused = true;
      state.offsetMs = getWebAudioPlaybackPositionMs(state);
      state.startedAtTime = null;
      stopWebAudioSource(state);
      cleanupNodes(state.nodes);
      return createPlaybackControlSnapshot(state.offsetMs, 'paused');
    },
    resume: (positionMs?: number) => {
      if (state.finalized) {
        return null;
      }

      const nextOffsetMs = typeof positionMs === 'number' ? positionMs : state.offsetMs;
      state.paused = false;
      try {
        startWebAudioSource(state, nextOffsetMs);
        return createPlaybackControlSnapshot(nextOffsetMs, 'playing');
      } catch (error) {
        finalizeWebAudioError(state, error);
        return null;
      }
    },
    getPlaybackPositionMs: () => getWebAudioPlaybackPositionMs(state),
    isPlaybackActive: () => isWebAudioPlaybackActive(state),
    sampleOutputLevel: () => sampleWebAudioOutputLevel(state),
    done,
    scheduler: 'clocked',
    get scheduledStartTime() {
      return state.scheduledStartTime;
    },
    get scheduledEndTime() {
      return state.scheduledEndTime;
    },
  };
}

export function createResumableAudioBufferPlaybackSession(
  audioBuffer: AudioBuffer,
  getAudioContext: WebAudioContextResolver,
  sourceLabel = 'Audio playback',
  options: VoicePlaybackStartOptions = {},
): VoicePlaybackSession {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return { stop: () => undefined, done: Promise.resolve() };
  }

  const { done, rejectDone, resolveDone } = createDeferredPlaybackDone();
  const state = createInitialWebAudioPlaybackState({
    audioBuffer,
    audioContext,
    playbackOptions: options,
    rejectDone,
    resolveDone,
    sourceLabel,
  });

  try {
    startWebAudioSource(state, 0, state.scheduledStartTime);
  } catch (error) {
    finalizeWebAudioError(state, error);
  }

  return createWebAudioSessionControls(state, done);
}
