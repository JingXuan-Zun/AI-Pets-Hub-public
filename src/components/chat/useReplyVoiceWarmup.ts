import { useCallback, type MutableRefObject } from 'react';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { warmupLocalVoice } from '../../voice/runtime';
import { warmupGptSovitsVoice } from '../../voice/ttsGptSovitsPlayback';

interface UseReplyVoiceWarmupOptions {
  replyVoiceWarmupActiveKeyRef: MutableRefObject<string>;
  replyVoiceWarmupReadyKeyRef: MutableRefObject<string>;
}

function buildReplyVoiceWarmupKey(settings: PetConfig['settings']) {
  return [
    settings.ttsProvider,
    settings.localTtsModelId,
    settings.localVoiceReferenceId,
    settings.localVoiceRuntimePath,
    settings.customVoiceModel,
    settings.voiceName,
    settings.gptSovitsModelId,
    settings.gptSovitsDevice,
    settings.gptSovitsApiUrl,
  ].join('::');
}

// Logs the fields that identify what was warmed for each provider.
function describeWarmupTarget(settings: PetConfig['settings']) {
  return settings.ttsProvider === 'gpt-sovits'
    ? { modelId: settings.gptSovitsModelId || null, device: settings.gptSovitsDevice, provider: settings.ttsProvider }
    : { modelId: settings.localTtsModelId || null, provider: settings.ttsProvider, referenceId: settings.localVoiceReferenceId || null };
}

function runReplyVoiceWarmup(settings: PetConfig['settings']) {
  return settings.ttsProvider === 'gpt-sovits' ? warmupGptSovitsVoice(settings) : warmupLocalVoice(settings);
}

export function useReplyVoiceWarmup({
  replyVoiceWarmupActiveKeyRef,
  replyVoiceWarmupReadyKeyRef,
}: UseReplyVoiceWarmupOptions) {
  const clearReplyVoiceWarmup = useCallback(() => {
    replyVoiceWarmupActiveKeyRef.current = '';
    replyVoiceWarmupReadyKeyRef.current = '';
  }, [replyVoiceWarmupActiveKeyRef, replyVoiceWarmupReadyKeyRef]);

  const warmLocalReplyVoice = useCallback((settings: PetConfig['settings']) => {
    const warmable = settings.ttsProvider === 'local' || settings.ttsProvider === 'gpt-sovits';
    if (!settings.voiceEnabled || !settings.autoSpeakResponses || !warmable) {
      clearReplyVoiceWarmup();
      return;
    }

    const warmupKey = buildReplyVoiceWarmupKey(settings);
    if (
      replyVoiceWarmupReadyKeyRef.current === warmupKey
      || replyVoiceWarmupActiveKeyRef.current === warmupKey
    ) {
      return;
    }

    replyVoiceWarmupActiveKeyRef.current = warmupKey;

    void runReplyVoiceWarmup(settings)
      .then(() => {
        if (replyVoiceWarmupActiveKeyRef.current !== warmupKey) {
          return;
        }

        replyVoiceWarmupReadyKeyRef.current = warmupKey;
        pushFrontendRuntimeLog('voice', 'local reply voice warmup ready', {
          ...describeWarmupTarget(settings),
        });
      })
      .catch((error) => {
        if (replyVoiceWarmupActiveKeyRef.current === warmupKey) {
          replyVoiceWarmupReadyKeyRef.current = '';
        }

        pushFrontendRuntimeError('voice', 'local reply voice warmup failed', error, {
          ...describeWarmupTarget(settings),
        });
      })
      .finally(() => {
        if (replyVoiceWarmupActiveKeyRef.current === warmupKey) {
          replyVoiceWarmupActiveKeyRef.current = '';
        }
      });
  }, [
    clearReplyVoiceWarmup,
    replyVoiceWarmupActiveKeyRef,
    replyVoiceWarmupReadyKeyRef,
  ]);

  return {
    clearReplyVoiceWarmup,
    warmLocalReplyVoice,
  };
}
