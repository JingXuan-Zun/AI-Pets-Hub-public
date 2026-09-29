import {
  createAudioPlaybackSession,
  createPreparedAudioPlayback,
  resolvePreparedAudioClockDelayMs,
  resolvePreparedAudioClockStartTime,
} from '../../voice/ttsPlaybackPrimitives';
import { type VoicePlaybackControlSnapshot, type VoicePlaybackSession } from '../../voice/types';
import { type AnimationToolAudioPlaybackStart } from './animationToolAudioPlaybackScheduler';

export interface AnimationToolAudioPlaybackSessionResult {
  playback: VoicePlaybackSession;
  scheduleBaseDelayMs: number;
  scheduler: NonNullable<VoicePlaybackSession['scheduler']>;
}

type PlaybackFactory = () => VoicePlaybackSession;
const DELAYED_AUDIO_RESUME_UNSUPPORTED_REASON = 'Audio resume is available after playback starts.';

function clearStartStatusTimer(timerId: number | null) {
  if (timerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(timerId);
  }
}

function schedulePlaybackStartedStatus(startDelayMs: number, onPlaybackStart: () => void) {
  if (startDelayMs <= 0 || typeof window === 'undefined') {
    onPlaybackStart();
    return null;
  }

  return window.setTimeout(onPlaybackStart, startDelayMs);
}

function wrapPlaybackStartStatus(
  playback: VoicePlaybackSession,
  startDelayMs: number,
  onPlaybackStart: () => void,
): VoicePlaybackSession {
  let statusTimer = schedulePlaybackStartedStatus(startDelayMs, onPlaybackStart);
  const getUnsupportedSnapshot = (): VoicePlaybackControlSnapshot => ({
    playbackPositionMs: 0,
    resumeSupported: false,
    resumeUnsupportedReason: DELAYED_AUDIO_RESUME_UNSUPPORTED_REASON,
  });

  return {
    ...playback,
    stop: () => {
      clearStartStatusTimer(statusTimer);
      statusTimer = null;
      playback.stop();
    },
    done: playback.done.finally(() => {
      clearStartStatusTimer(statusTimer);
      statusTimer = null;
    }),
    pause: () => {
      if (statusTimer !== null) {
        return getUnsupportedSnapshot();
      }

      return playback.pause?.() ?? getUnsupportedSnapshot();
    },
    resume: (positionMs?: number) => playback.resume?.(positionMs) ?? getUnsupportedSnapshot(),
    getPlaybackPositionMs: () => playback.getPlaybackPositionMs?.() ?? 0,
  };
}

function createDelayedPlaybackSession(options: {
  createSession: PlaybackFactory;
  dispose?: () => void;
  onPlaybackStart: () => void;
  startDelayMs: number;
}): VoicePlaybackSession {
  let activeSession: VoicePlaybackSession | null = null;
  let timerId: number | null = null;
  let resolveDone = () => undefined;
  let rejectDone = (_error: unknown) => undefined;
  let stopped = false;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const getUnsupportedSnapshot = (): VoicePlaybackControlSnapshot => ({
    playbackPositionMs: 0,
    resumeSupported: false,
    resumeUnsupportedReason: DELAYED_AUDIO_RESUME_UNSUPPORTED_REASON,
  });
  const startPlayback = () => {
    timerId = null;
    if (stopped) {
      return;
    }

    options.onPlaybackStart();
    activeSession = options.createSession();
    void activeSession.done.then(resolveDone).catch(rejectDone);
  };

  if (options.startDelayMs <= 0 || typeof window === 'undefined') {
    startPlayback();
  } else {
    timerId = window.setTimeout(startPlayback, options.startDelayMs);
  }

  return {
    stop: () => {
      stopped = true;
      clearStartStatusTimer(timerId);
      timerId = null;
      activeSession?.stop();
      options.dispose?.();
      resolveDone();
    },
    pause: () => activeSession?.pause?.() ?? getUnsupportedSnapshot(),
    resume: (positionMs?: number) => activeSession?.resume?.(positionMs) ?? getUnsupportedSnapshot(),
    getPlaybackPositionMs: () => activeSession?.getPlaybackPositionMs?.() ?? 0,
    done,
    scheduler: activeSession?.scheduler ?? 'immediate',
    scheduledEndTime: null,
    scheduledStartTime: null,
  };
}

export async function createAnimationToolAudioPlaybackSession(
  playbackStart: AnimationToolAudioPlaybackStart,
  onPlaybackStart: () => void = () => undefined,
): Promise<AnimationToolAudioPlaybackSessionResult> {
  const clockStartTime = resolvePreparedAudioClockStartTime(playbackStart.startDelayMs);

  try {
    const preparedPlayback = await createPreparedAudioPlayback(
      playbackStart.playbackUrl,
      false,
      'Skill animation audio',
    );
    if (!preparedPlayback.supportsGaplessScheduling || clockStartTime === null) {
      return {
        playback: createDelayedPlaybackSession({
          createSession: () => preparedPlayback.play(),
          dispose: preparedPlayback.dispose,
          onPlaybackStart,
          startDelayMs: playbackStart.startDelayMs,
        }),
        scheduleBaseDelayMs: playbackStart.startDelayMs,
        scheduler: 'immediate',
      };
    }

    const preparedSession = preparedPlayback.play({ startAtTime: clockStartTime });
    const scheduleBaseDelayMs = resolvePreparedAudioClockDelayMs(
      preparedSession.scheduledStartTime ?? clockStartTime,
    );
    const playback = wrapPlaybackStartStatus(preparedSession, scheduleBaseDelayMs, onPlaybackStart);

    return {
      playback,
      scheduleBaseDelayMs,
      scheduler: 'clocked',
    };
  } catch {
    return {
      playback: createDelayedPlaybackSession({
        createSession: () => createAudioPlaybackSession(
          playbackStart.playbackUrl,
          false,
          'Skill animation audio',
        ),
        onPlaybackStart,
        startDelayMs: playbackStart.startDelayMs,
      }),
      scheduleBaseDelayMs: playbackStart.startDelayMs,
      scheduler: 'immediate',
    };
  }
}
