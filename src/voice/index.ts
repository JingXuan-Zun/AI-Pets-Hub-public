import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type LocalVoiceAssets } from '../types';
import { createSilentPlaybackSession, EMPTY_LOCAL_VOICE_ASSETS } from './shared';
import { startSttSession } from './stt';
import { createTtsSession, prepareTtsPlayback, stopProviderVoiceRequests } from './tts';
import { type PreparedVoicePlayback, type StartVoiceInputOptions, type VoicePlaybackOptions, type VoicePlaybackSession } from './types';
import { beginVoiceOutputJob } from './voiceOutputActivity';

let activePlaybackSession: VoicePlaybackSession | null = null;
let playbackRequestId = 0;

function cancelPendingLocalSynthesis() {
  if (!desktopPetShellRuntime.isDesktopMode()) {
    return;
  }

  const cancelPromise = desktopPetShellRuntime.cancelLocalVoiceSynthesis?.();
  if (cancelPromise && typeof cancelPromise.catch === 'function') {
    void cancelPromise.catch(() => undefined);
  }
}

function cancelActivePlayback() {
  activePlaybackSession?.stop();
  activePlaybackSession = null;
  stopProviderVoiceRequests();
  cancelPendingLocalSynthesis();
}

function trackPlaybackSession(session: VoicePlaybackSession, requestId: number) {
  let stopped = false;

  const clearIfActive = () => {
    if (activePlaybackSession === trackedSession && playbackRequestId === requestId) {
      activePlaybackSession = null;
    }
  };

  const trackedSession: VoicePlaybackSession = {
    stop: () => {
      if (stopped) {
        return;
      }

      stopped = true;
      session.stop();
      clearIfActive();
    },
    done: session.done.finally(clearIfActive),
    scheduler: session.scheduler,
    get scheduledStartTime() {
      return session.scheduledStartTime;
    },
    get scheduledEndTime() {
      return session.scheduledEndTime;
    },
  };
  if (session.pause) {
    trackedSession.pause = () => session.pause?.() ?? null;
  }
  if (session.resume) {
    trackedSession.resume = (positionMs?: number) => session.resume?.(positionMs) ?? null;
  }
  if (session.getPlaybackPositionMs) {
    trackedSession.getPlaybackPositionMs = () => session.getPlaybackPositionMs?.() ?? null;
  }
  if (session.isPlaybackActive) {
    trackedSession.isPlaybackActive = () => session.isPlaybackActive?.() ?? false;
  }
  if (session.sampleOutputLevel) {
    trackedSession.sampleOutputLevel = () => session.sampleOutputLevel?.() ?? null;
  }

  activePlaybackSession = trackedSession;
  return trackedSession;
}

// Keeps a voice job counted until the session finishes, so hands-free listening stays muted.
function endJobWithSession(session: VoicePlaybackSession, endJob: () => void) {
  void session.done.then(endJob, endJob);
  return session;
}

function trackPreparedPlayback(prepared: PreparedVoicePlayback, endJob: () => void): PreparedVoicePlayback {
  let played = false;
  return {
    ...prepared,
    play: (options) => {
      played = true;
      return endJobWithSession(prepared.play(options), endJob);
    },
    dispose: () => {
      prepared.dispose();
      if (!played) endJob();
    },
  };
}

export function stopVoicePlayback() {
  playbackRequestId += 1;
  cancelActivePlayback();
}

export async function speakText(
  text: string,
  settings: StartVoiceInputOptions['settings'],
  localVoiceAssets: LocalVoiceAssets = EMPTY_LOCAL_VOICE_ASSETS,
  options: VoicePlaybackOptions = {},
) {
  playbackRequestId += 1;
  const requestId = playbackRequestId;
  cancelActivePlayback();
  const endJob = beginVoiceOutputJob();
  let session: VoicePlaybackSession;
  try {
    session = await createTtsSession(text, settings, localVoiceAssets, options);
  } catch (error) {
    endJob();
    throw error;
  }
  if (requestId !== playbackRequestId) {
    session.stop();
    endJob();
    return createSilentPlaybackSession();
  }

  return trackPlaybackSession(endJobWithSession(session, endJob), requestId);
}

export async function createIndependentVoicePlayback(
  text: string,
  settings: StartVoiceInputOptions['settings'],
  options: VoicePlaybackOptions = {},
) {
  const endJob = beginVoiceOutputJob();
  try {
    return endJobWithSession(await createTtsSession(text, settings, EMPTY_LOCAL_VOICE_ASSETS, options), endJob);
  } catch (error) {
    endJob();
    throw error;
  }
}

export async function prepareIndependentVoicePlayback(
  text: string,
  settings: StartVoiceInputOptions['settings'],
  options: VoicePlaybackOptions = {},
): Promise<PreparedVoicePlayback> {
  const endJob = beginVoiceOutputJob();
  try {
    return trackPreparedPlayback(await prepareTtsPlayback(text, settings, EMPTY_LOCAL_VOICE_ASSETS, options), endJob);
  } catch (error) {
    endJob();
    throw error;
  }
}

export async function startVoiceInput(options: StartVoiceInputOptions) {
  return startSttSession({
    ...options,
    localVoiceAssets: options.localVoiceAssets ?? EMPTY_LOCAL_VOICE_ASSETS,
  });
}
