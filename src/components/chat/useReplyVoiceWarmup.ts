import { useCallback, type MutableRefObject } from 'react';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { warmupLocalVoice } from '../../voice/runtime';

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
  ].join('::');
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
    if (!settings.voiceEnabled || !settings.autoSpeakResponses || settings.ttsProvider !== 'local') {
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

    void warmupLocalVoice(settings)
      .then(() => {
        if (replyVoiceWarmupActiveKeyRef.current !== warmupKey) {
          return;
        }

        replyVoiceWarmupReadyKeyRef.current = warmupKey;
        pushFrontendRuntimeLog('voice', 'local reply voice warmup ready', {
          provider: settings.ttsProvider,
          modelId: settings.localTtsModelId || null,
          referenceId: settings.localVoiceReferenceId || null,
        });
      })
      .catch((error) => {
        if (replyVoiceWarmupActiveKeyRef.current === warmupKey) {
          replyVoiceWarmupReadyKeyRef.current = '';
        }

        pushFrontendRuntimeError('voice', 'local reply voice warmup failed', error, {
          provider: settings.ttsProvider,
          modelId: settings.localTtsModelId || null,
          referenceId: settings.localVoiceReferenceId || null,
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
