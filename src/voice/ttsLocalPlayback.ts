import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { getVoiceErrorMessage, isVoiceCancellationError } from './errorMessages';
import { synthesizeLocalVoice } from './runtime';
import { createSilentPlaybackSession } from './shared';
import { resolveLocalVoicePlaybackProfile } from './ttsLocalProfile';
import { splitLocalSpeechText } from './ttsLocalSegmentation';
import { resolveTtsProvider } from './ttsRequest';
import {
  createAudioPlaybackSession,
  createPreparedAudioPlayback,
  createSilentPreparedVoicePlayback,
} from './ttsPlaybackPrimitives';
import { type PreparedVoicePlayback, type VoicePlaybackSession, type VoiceSettings } from './types';

type LocalSynthesisSuccess = {
  ok: true;
  result: Awaited<ReturnType<typeof synthesizeLocalVoice>>;
};

type LocalSynthesisFailure = {
  ok: false;
  error: unknown;
};

type LocalSynthesisOutcome = LocalSynthesisSuccess | LocalSynthesisFailure;

type LocalChunkSynthesisTask = {
  chunkIndex: number;
  chunkText: string;
  elapsedMs: number;
  synthesisResult: LocalSynthesisOutcome;
};

function isLocalSynthesisFailure(result: LocalSynthesisOutcome): result is LocalSynthesisFailure {
  return result.ok === false;
}

function getNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

async function synthesizeLocalChunk(
  text: string,
  settings: VoiceSettings,
  seed: number | null,
): Promise<LocalSynthesisOutcome> {
  try {
    const result = await synthesizeLocalVoice(
      text,
      settings,
      seed === null ? {} : { seed },
    );
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}

function formatLocalVoiceGenerationError(error: unknown) {
  return getVoiceErrorMessage(error, '\u8bf7\u68c0\u67e5\u672c\u5730\u8bed\u97f3\u6a21\u578b\u3001\u53c2\u8003\u97f3\u9891\u548c\u8fd0\u884c\u73af\u5883\u3002');
}

function resolveLocalAudioPlaybackSource(result: Awaited<ReturnType<typeof synthesizeLocalVoice>>) {
  const fileUrl = typeof result.audioFileUrl === 'string' ? result.audioFileUrl.trim() : '';
  if (fileUrl) {
    return fileUrl;
  }

  if (result.audioBase64) {
    return `data:${result.mimeType};base64,${result.audioBase64}`;
  }

  throw new Error('Local voice returned no playable audio source.');
}

export async function prepareLocalVoicePlayback(
  text: string,
  settings: VoiceSettings,
): Promise<PreparedVoicePlayback> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return createSilentPreparedVoicePlayback();
  }

  const localVoiceProfile = resolveLocalVoicePlaybackProfile(settings);
  const provider = resolveTtsProvider(settings);
  const synthesisStartedAt = getNowMs();

  pushFrontendRuntimeLog('\u8bed\u97f3', '\u5f00\u59cb\u9884\u751f\u6210\u6d41\u5f0f\u8bed\u97f3\u5206\u6bb5', {
    provider,
    textLength: normalizedText.length,
    seed: localVoiceProfile.seed,
  });

  const synthesisResult = await synthesizeLocalVoice(
    normalizedText,
    settings,
    localVoiceProfile.seed === null ? {} : { seed: localVoiceProfile.seed },
  );

  pushFrontendRuntimeLog('\u8bed\u97f3', '\u6d41\u5f0f\u8bed\u97f3\u5206\u6bb5\u9884\u751f\u6210\u5b8c\u6210', {
    provider,
    textLength: normalizedText.length,
    elapsedMs: Math.round(getNowMs() - synthesisStartedAt),
    cacheHit: synthesisResult.cacheHit,
    promptCacheHit: synthesisResult.promptCacheHit,
    audioFilePath: synthesisResult.audioFilePath,
  });

  return await createPreparedAudioPlayback(
    resolveLocalAudioPlaybackSource(synthesisResult),
    false,
    '\u672c\u5730\u8bed\u97f3\u64ad\u653e',
    settings.speechPlaybackRate,
  );
}

export function createLocalVoicePipelineSession(text: string, settings: VoiceSettings): VoicePlaybackSession {
  const chunks = splitLocalSpeechText(text, settings);
  if (chunks.length === 0) {
    return createSilentPlaybackSession();
  }

  const localVoiceProfile = resolveLocalVoicePlaybackProfile(settings);
  let stopped = false;
  let finalized = false;
  let activeChunkPlayback: VoicePlaybackSession | null = null;
  let resolveDone = () => undefined;
  let rejectDone = (_error: Error) => undefined;
  const startedAt = getNowMs();

  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const finalizeSuccess = () => {
    if (finalized) {
      return;
    }

    finalized = true;
    resolveDone();
  };

  const finalizeError = (error: unknown) => {
    if (finalized) {
      return;
    }

    finalized = true;
    rejectDone(error instanceof Error ? error : new Error(String(error)));
  };

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    activeChunkPlayback?.stop();
    activeChunkPlayback = null;
    finalizeSuccess();
  };

  const synthesizeChunkTask = async (chunkIndex: number): Promise<LocalChunkSynthesisTask> => {
    const chunkText = chunks[chunkIndex];
    const synthesisStartedAt = getNowMs();
    pushFrontendRuntimeLog('\u8bed\u97f3', '\u5f00\u59cb\u672c\u5730\u8bed\u97f3\u5206\u6bb5\u5408\u6210', {
      chunkIndex: chunkIndex + 1,
      chunkCount: chunks.length,
      textLength: chunkText.length,
      seed: localVoiceProfile.seed,
    });

    const synthesisResult = await synthesizeLocalChunk(chunkText, settings, localVoiceProfile.seed);

    return {
      chunkIndex,
      chunkText,
      elapsedMs: Math.round(getNowMs() - synthesisStartedAt),
      synthesisResult,
    };
  };

  void (async () => {
    pushFrontendRuntimeLog('\u8bed\u97f3', '\u5f00\u59cb\u672c\u5730\u8bed\u97f3\u64ad\u653e', {
      chunkCount: chunks.length,
      textLength: text.trim().length,
      lockVoiceTone: localVoiceProfile.lockVoiceTone,
      voiceToneStability: localVoiceProfile.voiceToneStability,
      pipelineMode: chunks.length > 1 ? 'prefetch-next-chunk' : 'single-chunk',
      seed: localVoiceProfile.seed,
    });

    let nextChunkTaskPromise: Promise<LocalChunkSynthesisTask> | null = synthesizeChunkTask(0);

    for (let index = 0; index < chunks.length; index += 1) {
      if (stopped) {
        pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u64ad\u653e\u5df2\u505c\u6b62', {
          chunkIndex: index + 1,
          chunkCount: chunks.length,
        });
        return;
      }

      const currentChunkTask = await (nextChunkTaskPromise ?? synthesizeChunkTask(index));
      if (stopped) {
        pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u64ad\u653e\u5df2\u505c\u6b62', {
          chunkIndex: index + 1,
          chunkCount: chunks.length,
        });
        return;
      }

      if (currentChunkTask.chunkIndex !== index) {
        throw new Error(`Unexpected local voice chunk order: expected ${index}, got ${currentChunkTask.chunkIndex}`);
      }

      if (isLocalSynthesisFailure(currentChunkTask.synthesisResult)) {
        if (isVoiceCancellationError(currentChunkTask.synthesisResult.error)) {
          pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u5206\u6bb5\u5408\u6210\u5df2\u53d6\u6d88', {
            chunkIndex: index + 1,
            chunkCount: chunks.length,
          });
          finalizeSuccess();
          return;
        }

        throw new Error(`\u672c\u5730\u8bed\u97f3\u751f\u6210\u5931\u8d25\uff1a${formatLocalVoiceGenerationError(currentChunkTask.synthesisResult.error)}`);
      }

      nextChunkTaskPromise = index + 1 < chunks.length
        ? synthesizeChunkTask(index + 1)
        : null;

      if (nextChunkTaskPromise) {
        pushFrontendRuntimeLog('\u8bed\u97f3', '\u540e\u53f0\u9884\u751f\u6210\u4e0b\u4e00\u6bb5\u8bed\u97f3', {
          currentChunkIndex: index + 1,
          nextChunkIndex: index + 2,
          chunkCount: chunks.length,
        });
      }

      pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u5206\u6bb5\u5df2\u751f\u6210', {
        chunkIndex: index + 1,
        chunkCount: chunks.length,
        elapsedMs: currentChunkTask.elapsedMs,
        textLength: currentChunkTask.chunkText.length,
        cacheHit: currentChunkTask.synthesisResult.result.cacheHit,
        promptCacheHit: currentChunkTask.synthesisResult.result.promptCacheHit,
        audioFilePath: currentChunkTask.synthesisResult.result.audioFilePath,
      });

      const playbackStartedAt = getNowMs();
      activeChunkPlayback = createAudioPlaybackSession(
        resolveLocalAudioPlaybackSource(currentChunkTask.synthesisResult.result),
        false,
        chunks.length > 1
          ? `\u672c\u5730\u8bed\u97f3\u5206\u6bb5\u64ad\u653e ${index + 1}/${chunks.length}`
          : '\u672c\u5730\u8bed\u97f3\u64ad\u653e',
        settings.speechPlaybackRate,
      );

      await activeChunkPlayback.done;
      activeChunkPlayback = null;

      if (stopped) {
        pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u64ad\u653e\u5df2\u505c\u6b62', {
          chunkIndex: index + 1,
          chunkCount: chunks.length,
        });
        return;
      }

      pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u5206\u6bb5\u64ad\u653e\u5b8c\u6210', {
        chunkIndex: index + 1,
        chunkCount: chunks.length,
        playbackMs: Math.round(getNowMs() - playbackStartedAt),
      });
    }

    pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u64ad\u62a5\u5b8c\u6210', {
      chunkCount: chunks.length,
      totalMs: Math.round(getNowMs() - startedAt),
    });
    finalizeSuccess();
  })().catch((error) => {
    if (isVoiceCancellationError(error) || stopped) {
      pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u64ad\u653e\u5df2\u53d6\u6d88', {
        chunkCount: chunks.length,
      });
      finalizeSuccess();
      return;
    }

    pushFrontendRuntimeLog('\u8bed\u97f3', '\u672c\u5730\u8bed\u97f3\u64ad\u62a5\u5931\u8d25', {
      chunkCount: chunks.length,
      error: getVoiceErrorMessage(error, '\u672a\u77e5\u9519\u8bef'),
    });
    finalizeError(error);
  });

  return {
    stop,
    done,
  };
}
