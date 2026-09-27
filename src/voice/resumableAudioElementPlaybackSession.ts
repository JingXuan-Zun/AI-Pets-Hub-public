import { getVoiceErrorMessage } from './errorMessages';
import { createDeferredPlaybackDone, createPlaybackControlSnapshot } from './audioPlaybackControlSnapshot';
import { clampSpeechPlaybackRate } from './speechPlaybackRate';
import { type VoicePlaybackSession } from './types';

function resetAudioElementPosition(audio: HTMLAudioElement, positionSec: number) {
  try {
    audio.currentTime = Math.max(0, positionSec);
  } catch {
    // Ignore currentTime failures for streams that do not expose seeking.
  }
}

export function createResumableAudioElementPlaybackSession(
  audio: HTMLAudioElement,
  sourceLabel = 'Audio playback',
  cleanup?: () => void,
  playbackRate = 1,
): VoicePlaybackSession {
  const { done, rejectDone, resolveDone } = createDeferredPlaybackDone();
  let finalized = false;

  const finalizeSuccess = () => {
    if (finalized) {
      return;
    }

    finalized = true;
    audio.onended = null;
    audio.onerror = null;
    cleanup?.();
    resolveDone();
  };

  const finalizeError = (error: unknown) => {
    if (finalized) {
      return;
    }

    finalized = true;
    audio.onended = null;
    audio.onerror = null;
    cleanup?.();
    rejectDone(new Error(getVoiceErrorMessage(error, `${sourceLabel} failed.`)));
  };

  const getPlaybackPositionMs = () => Math.max(0, Math.round((audio.currentTime || 0) * 1000));
  const resume = (positionMs?: number) => {
    if (finalized) {
      return null;
    }

    if (typeof positionMs === 'number') {
      resetAudioElementPosition(audio, positionMs / 1000);
    }
    void audio.play().catch((error) => {
      finalizeError(`${sourceLabel} failed: ${getVoiceErrorMessage(error, 'Unable to start playback.')}`);
    });
    return createPlaybackControlSnapshot(getPlaybackPositionMs(), 'playing');
  };

  audio.onended = finalizeSuccess;
  audio.onerror = () => finalizeError(`${sourceLabel} failed: audio data could not be played.`);
  audio.playbackRate = clampSpeechPlaybackRate(playbackRate);
  resetAudioElementPosition(audio, 0);
  resume(0);

  return {
    stop: () => {
      audio.pause();
      resetAudioElementPosition(audio, 0);
      finalizeSuccess();
    },
    pause: () => {
      if (finalized) {
        return null;
      }

      audio.pause();
      return createPlaybackControlSnapshot(getPlaybackPositionMs(), 'paused');
    },
    resume,
    getPlaybackPositionMs,
    isPlaybackActive: () => !finalized && !audio.paused && !audio.ended,
    done,
    scheduler: 'immediate',
    scheduledStartTime: null,
    scheduledEndTime: null,
  };
}
