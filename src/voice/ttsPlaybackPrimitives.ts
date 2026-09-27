import { clampSpeechPlaybackRate } from './speechPlaybackRate';
import {
  createResumableAudioBufferPlaybackSession,
  createResumableAudioElementPlaybackSession,
} from './resumableAudioPlaybackSession';
import { createSilentPlaybackSession } from './shared';
import {
  type PreparedVoicePlayback,
  type VoicePlaybackSession,
  type VoicePlaybackStartOptions,
} from './types';

let sharedWebAudioContext: AudioContext | null = null;

function getSharedWebAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const WebAudioContext = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ?? null;

  if (!WebAudioContext) {
    return null;
  }

  if (!sharedWebAudioContext) {
    sharedWebAudioContext = new WebAudioContext();
  }

  return sharedWebAudioContext;
}

export function resolvePreparedAudioClockStartTime(startDelayMs: number) {
  const audioContext = getSharedWebAudioContext();
  if (!audioContext) {
    return null;
  }

  return audioContext.currentTime + (Math.max(0, startDelayMs) / 1000);
}

export function resolvePreparedAudioClockDelayMs(scheduledStartTime: number | null | undefined) {
  const audioContext = getSharedWebAudioContext();
  if (!audioContext || typeof scheduledStartTime !== 'number') {
    return 0;
  }

  return Math.max(0, Math.round((scheduledStartTime - audioContext.currentTime) * 1000));
}

async function decodePreparedAudioBuffer(src: string) {
  const audioContext = getSharedWebAudioContext();
  if (!audioContext) {
    return null;
  }

  const response = await fetch(src);
  const audioData = await response.arrayBuffer();

  if (!audioData.byteLength) {
    return null;
  }

  return audioContext.decodeAudioData(audioData.slice(0));
}

export function createPreparedPlaybackFactory(
  createSession: (options?: VoicePlaybackStartOptions) => VoicePlaybackSession,
  dispose?: () => void,
  metadata: Pick<PreparedVoicePlayback, 'supportsGaplessScheduling' | 'durationMs'> = {},
): PreparedVoicePlayback {
  let played = false;
  let disposed = false;

  const finalizeDispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    dispose?.();
  };

  return {
    supportsGaplessScheduling: metadata.supportsGaplessScheduling,
    durationMs: metadata.durationMs ?? null,
    play: (options = {}) => {
      if (played || disposed) {
        return createSilentPlaybackSession();
      }

      played = true;
      const session = createSession(options);
      const wrappedSession: VoicePlaybackSession = {
        stop: () => {
          session.stop();
          finalizeDispose();
        },
        done: session.done.finally(finalizeDispose),
        scheduler: session.scheduler,
        scheduledStartTime: session.scheduledStartTime,
        scheduledEndTime: session.scheduledEndTime,
      };
      if (session.pause) {
        wrappedSession.pause = () => session.pause?.() ?? null;
      }
      if (session.resume) {
        wrappedSession.resume = (positionMs?: number) => session.resume?.(positionMs) ?? null;
      }
      if (session.getPlaybackPositionMs) {
        wrappedSession.getPlaybackPositionMs = () => session.getPlaybackPositionMs?.() ?? null;
      }
      if (session.isPlaybackActive) {
        wrappedSession.isPlaybackActive = () => session.isPlaybackActive?.() ?? false;
      }
      if (session.sampleOutputLevel) {
        wrappedSession.sampleOutputLevel = () => session.sampleOutputLevel?.() ?? null;
      }
      return wrappedSession;
    },
    dispose: finalizeDispose,
  };
}

export function createSilentPreparedVoicePlayback() {
  return createPreparedPlaybackFactory(() => createSilentPlaybackSession());
}

export async function createPreparedAudioPlayback(
  src: string,
  revokeOnDispose = false,
  sourceLabel = '音频播放',
  defaultPlaybackRate = 1,
): Promise<PreparedVoicePlayback> {
  const normalizedDefaultPlaybackRate = clampSpeechPlaybackRate(defaultPlaybackRate);
  if (typeof Audio === 'undefined') {
    return createPreparedPlaybackFactory(
      (options = {}) => createAudioPlaybackSession(
        src,
        revokeOnDispose,
        sourceLabel,
        options.playbackRate ?? normalizedDefaultPlaybackRate,
      ),
      revokeOnDispose
        ? () => {
          URL.revokeObjectURL(src);
        }
        : undefined,
      {
        supportsGaplessScheduling: false,
        durationMs: null,
      },
    );
  }

  try {
    const audioBuffer = await decodePreparedAudioBuffer(src);
    if (audioBuffer) {
      return createPreparedPlaybackFactory(
        (options = {}) => createResumableAudioBufferPlaybackSession(
          audioBuffer,
          getSharedWebAudioContext,
          sourceLabel,
          {
            ...options,
            playbackRate: options.playbackRate ?? normalizedDefaultPlaybackRate,
          },
        ),
        revokeOnDispose
          ? () => {
            URL.revokeObjectURL(src);
          }
          : undefined,
        {
          supportsGaplessScheduling: true,
          durationMs: Math.round((audioBuffer.duration / normalizedDefaultPlaybackRate) * 1000),
        },
      );
    }
  } catch {
    // Fall back to HTMLAudioElement playback when Web Audio decoding is unavailable.
  }

  const audio = new Audio(src);
  audio.preload = 'auto';

  try {
    audio.load();
  } catch {
    // Ignore eager preload failures and fall back to normal play-time loading.
  }

  return createPreparedPlaybackFactory(
    (options = {}) => createAudioElementPlaybackSession(
      audio,
      sourceLabel,
      undefined,
      options.playbackRate ?? normalizedDefaultPlaybackRate,
    ),
    () => {
      try {
        audio.pause();
      } catch {
        // Ignore eager audio cleanup failures.
      }

      try {
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Ignore audio source cleanup failures.
      }

      if (revokeOnDispose) {
        URL.revokeObjectURL(src);
      }
    },
    {
      supportsGaplessScheduling: false,
      durationMs: null,
    },
  );
}

function createAudioBufferPlaybackSession(
  audioBuffer: AudioBuffer,
  sourceLabel = '音频播放',
  options: VoicePlaybackStartOptions = {},
): VoicePlaybackSession {
  return createResumableAudioBufferPlaybackSession(
    audioBuffer,
    getSharedWebAudioContext,
    sourceLabel,
    options,
  );
}

export function createAudioPlaybackSession(
  src: string,
  revokeOnFinish = false,
  sourceLabel = '音频播放',
  playbackRate = 1,
): VoicePlaybackSession {
  const audio = new Audio(src);
  audio.preload = 'auto';
  return createAudioElementPlaybackSession(
    audio,
    sourceLabel,
    revokeOnFinish
      ? () => {
        URL.revokeObjectURL(src);
      }
      : undefined,
    playbackRate,
  );
}

export function createAudioElementPlaybackSession(
  audio: HTMLAudioElement,
  sourceLabel = '音频播放',
  cleanup?: () => void,
  playbackRate = 1,
): VoicePlaybackSession {
  return createResumableAudioElementPlaybackSession(audio, sourceLabel, cleanup, playbackRate);
}
