import { type LocalVoiceAssets } from '../types';
import { createSilentPlaybackSession } from './shared';
import { splitSpeechTextForPlaybackPauses } from './speechText';
import { createApiVoiceSession, prepareApiVoicePlayback } from './ttsApiPlayback';
import {
  createBrowserVoiceSession,
  createPreparedBrowserVoicePlayback,
} from './ttsBrowserPlayback';
import {
  createGptSovitsVoiceSession,
  prepareGptSovitsVoicePlayback,
  stopGptSovitsVoicePlayback,
} from './ttsGptSovitsPlayback';
import { createLocalVoicePipelineSession, prepareLocalVoicePlayback } from './ttsLocalPlayback';
import { resolveGptSovitsEmotion } from './gptSovitsEmotion';
import { createSilentPreparedVoicePlayback } from './ttsPlaybackPrimitives';
import { resolveTtsRequest, type TtsProvider } from './ttsRequest';
import { type PreparedVoicePlayback, type VoicePlaybackOptions, type VoicePlaybackSession, type VoiceSettings } from './types';

import { stopBrowserVoicePlayback } from './ttsBrowserPlayback';

// Aborts in-flight HTTP synthesis for providers that run outside the renderer.
export function stopProviderVoiceRequests() {
  stopBrowserVoicePlayback();
  stopGptSovitsVoicePlayback();
}

async function prepareTtsPlaybackForProvider(
  provider: TtsProvider,
  text: string,
  settings: VoiceSettings,
  options: VoicePlaybackOptions = {},
) {
  switch (provider) {
    case 'api':
      return prepareApiVoicePlayback(text, settings);
    case 'local':
      return prepareLocalVoicePlayback(text, settings);
    case 'gpt-sovits':
      return prepareGptSovitsVoicePlayback(text, settings, resolveGptSovitsEmotion(options.expressionAction));
    case 'browser':
    default:
      return createPreparedBrowserVoicePlayback(text, settings);
  }
}

async function createTtsSessionForProvider(
  provider: TtsProvider,
  text: string,
  settings: VoiceSettings,
  options: VoicePlaybackOptions = {},
) {
  switch (provider) {
    case 'api':
      return createApiVoiceSession(text, settings);
    case 'local':
      return createLocalVoicePipelineSession(text, settings);
    case 'gpt-sovits':
      return createGptSovitsVoiceSession(text, settings, resolveGptSovitsEmotion(options.expressionAction));
    case 'browser':
    default:
      return createBrowserVoiceSession(text, settings);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

type PausableTextPart = {
  text: string;
  pauseAfterMs: number;
};

function createPausablePreparedPlayback(
  provider: TtsProvider,
  parts: PausableTextPart[],
  settings: VoiceSettings,
): PreparedVoicePlayback {
  let played = false;
  let disposed = false;
  let activeSession: VoicePlaybackSession | null = null;

  return {
    supportsGaplessScheduling: false,
    durationMs: null,
    play: () => {
      if (played || disposed) {
        return createSilentPlaybackSession();
      }

      played = true;
      activeSession = createPausablePlaybackSession(
        provider,
        parts,
        settings,
        () => disposed,
      );
      void activeSession.done.finally(() => {
        activeSession = null;
      });
      return activeSession;
    },
    dispose: () => {
      disposed = true;
      activeSession?.stop();
      activeSession = null;
    },
  };
}

function createPausablePlaybackSession(
  provider: TtsProvider,
  parts: PausableTextPart[],
  settings: VoiceSettings,
  isDisposed: () => boolean,
): VoicePlaybackSession {
  let stopped = false;
  let activeSession: VoicePlaybackSession | null = null;
  let activePreparedPlayback: PreparedVoicePlayback | null = null;
  const preparedPlaybacks = new Set<PreparedVoicePlayback>();
  let resolveDone = () => undefined;
  let rejectDone = (_error: Error) => undefined;

  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const preparePartPlayback = (part: PausableTextPart) => {
    const preparedPlaybackPromise = prepareTtsPlaybackForProvider(provider, part.text, settings)
      .then((playback) => {
        if (stopped || isDisposed()) {
          playback.dispose();
          return null;
        }

        preparedPlaybacks.add(playback);
        return playback;
      });
    void preparedPlaybackPromise.catch(() => undefined);
    return preparedPlaybackPromise;
  };

  void (async () => {
    let nextPreparedPlaybackPromise: Promise<PreparedVoicePlayback | null> | null = parts[0]
      ? preparePartPlayback(parts[0])
      : null;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (stopped || isDisposed()) {
        resolveDone();
        return;
      }

      const preparedPlayback = await nextPreparedPlaybackPromise;
      nextPreparedPlaybackPromise = null;
      if (!preparedPlayback || stopped || isDisposed()) {
        preparedPlayback?.dispose();
        resolveDone();
        return;
      }

      preparedPlaybacks.delete(preparedPlayback);
      const nextPart = parts[index + 1];
      if (nextPart) {
        nextPreparedPlaybackPromise = preparePartPlayback(nextPart);
      }

      activePreparedPlayback = preparedPlayback;
      activeSession = preparedPlayback.play();
      try {
        await activeSession.done;
      } finally {
        activeSession = null;
        activePreparedPlayback.dispose();
        activePreparedPlayback = null;
      }

      if (stopped || isDisposed()) {
        resolveDone();
        return;
      }

      if (part.pauseAfterMs > 0) {
        await delay(part.pauseAfterMs);
      }
    }

    resolveDone();
  })().catch((error) => {
    rejectDone(error instanceof Error ? error : new Error(String(error)));
  });

  return {
    stop: () => {
      stopped = true;
      activeSession?.stop();
      activeSession = null;
      activePreparedPlayback?.dispose();
      activePreparedPlayback = null;
      preparedPlaybacks.forEach((playback) => playback.dispose());
      preparedPlaybacks.clear();
      resolveDone();
    },
    done,
    scheduler: 'immediate',
    scheduledStartTime: null,
    scheduledEndTime: null,
  };
}

async function preparePausableTtsPlaybackForProvider(provider: TtsProvider, text: string, settings: VoiceSettings) {
  const pauseParts = splitSpeechTextForPlaybackPauses(text, settings);
  if (pauseParts.length <= 1 && (pauseParts[0]?.pauseAfterMs ?? 0) <= 0) {
    return prepareTtsPlaybackForProvider(provider, text, settings);
  }

  return createPausablePreparedPlayback(provider, pauseParts, settings);
}

async function createPausableTtsSessionForProvider(provider: TtsProvider, text: string, settings: VoiceSettings) {
  const preparedPlayback = await preparePausableTtsPlaybackForProvider(provider, text, settings);
  return preparedPlayback.play();
}

export async function prepareTtsPlayback(
  text: string,
  settings: VoiceSettings,
  _localVoiceAssets: LocalVoiceAssets,
  options: VoicePlaybackOptions = {},
) {
  const request = resolveTtsRequest(text, settings, options);
  if (!request) {
    return createSilentPreparedVoicePlayback();
  }

  if (request.provider === 'gpt-sovits') {
    // Pause splitting would hand the model short fragments, which it drops or garbles.
    return await prepareTtsPlaybackForProvider(request.provider, request.preparedText, settings, options);
  }

  return await preparePausableTtsPlaybackForProvider(request.provider, request.preparedText, settings);
}

export async function createTtsSession(
  text: string,
  settings: VoiceSettings,
  _localVoiceAssets: LocalVoiceAssets,
  options: VoicePlaybackOptions = {},
) {
  const request = resolveTtsRequest(text, settings, options);
  if (!request) {
    return createSilentPlaybackSession();
  }

  if (request.provider === 'local' || request.provider === 'gpt-sovits') {
    return await createTtsSessionForProvider(request.provider, request.preparedText, settings, options);
  }

  return await createPausableTtsSessionForProvider(request.provider, request.preparedText, settings);
}
