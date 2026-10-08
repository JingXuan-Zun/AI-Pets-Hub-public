import { useCallback, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { speakText, stopVoicePlayback } from '../../services/voiceService';
import { type PetConfig } from '../../types';
import { isVoiceCancellationError } from '../../voice/errorMessages';
import {
  buildManualVoicePlaybackFailedMessage,
  buildVoicePlaybackFailedMessage,
} from './chatVoiceControlUtils';
import { type PlayVoiceTextOptions } from './chatVoicePlaybackTypes';
import { resolvePetVoiceSettings } from '../../voice/petVoiceSettings';
import { resolvePetMessageExpressionAction } from '../../pet-runtime/interactions/petMessageExpressionSignals';
import { registerReplyMouthPlayback } from '../../pet-runtime/performance/replyMouthSignalRuntime';

interface UseDirectVoiceTextPlaybackOptions {
  configRef: MutableRefObject<PetConfig>;
  publishStatusMessage: (message: string) => void;
  stopQueuedVoicePlayback: () => void;
  voicePlaybackStopRef: MutableRefObject<(() => void) | null>;
  voicePlaybackTokenRef: MutableRefObject<number>;
}

export function useDirectVoiceTextPlayback({
  configRef,
  publishStatusMessage,
  stopQueuedVoicePlayback,
  voicePlaybackStopRef,
  voicePlaybackTokenRef,
}: UseDirectVoiceTextPlaybackOptions) {
  const resetVoicePlaybackState = useCallback((petId: string | null = null) => {
    const speakingPetId = desktopPetChatStore.getState().speakingPetId;
    voicePlaybackStopRef.current?.();
    voicePlaybackStopRef.current = null;
    stopQueuedVoicePlayback();
    stopVoicePlayback();
    desktopPetChatStore.setSpeaking(false);
    desktopPetChatStore.setSpeakingPetId(petId);
    desktopPetChatStore.setSpeechExpressionAction(speakingPetId, null);
  }, [stopQueuedVoicePlayback, voicePlaybackStopRef]);

  const stopDirectVoicePlayback = useCallback(() => {
    voicePlaybackTokenRef.current += 1;
    resetVoicePlaybackState(null);
  }, [resetVoicePlaybackState, voicePlaybackTokenRef]);

  const playVoiceText = useCallback(async (text: string, options?: PlayVoiceTextOptions) => {
    const nextText = text.trim();
    if (!nextText) {
      return;
    }

    const targetPetId = options?.petId ?? desktopPetChatStore.getState().activePetId;
    const currentSettings = resolvePetVoiceSettings(configRef.current, targetPetId);
    const force = Boolean(options?.force);
    const source = options?.source ?? 'reply';

    if (!force && (!currentSettings.voiceEnabled || !currentSettings.autoSpeakResponses)) {
      return;
    }

    const playbackToken = ++voicePlaybackTokenRef.current;
    resetVoicePlaybackState(null);
    let unregisterMouthPlayback = () => undefined;

    try {
      const expressionAction = resolvePetMessageExpressionAction(nextText);
      desktopPetChatStore.setSpeaking(true);
      desktopPetChatStore.setSpeakingPetId(targetPetId);
      desktopPetChatStore.setSpeechExpressionAction(targetPetId, expressionAction);
      pushFrontendRuntimeLog('voice', source === 'manual' ? 'manual voice playback started' : 'reply voice playback started', {
        provider: currentSettings.ttsProvider,
        textLength: nextText.length,
        force,
      });
      const playback = await speakText(nextText, currentSettings, undefined, { force, expressionAction });
      unregisterMouthPlayback = registerReplyMouthPlayback({
        petId: targetPetId,
        playback,
        sourceId: `direct:${playbackToken}`,
        text: nextText,
      });
      if (playbackToken !== voicePlaybackTokenRef.current) {
        playback.stop();
        return;
      }

      voicePlaybackStopRef.current = () => playback.stop();
      await playback.done;
    } catch (error) {
      if (isVoiceCancellationError(error) || playbackToken !== voicePlaybackTokenRef.current) {
        pushFrontendRuntimeLog('voice', source === 'manual' ? 'manual voice playback cancelled' : 'reply voice playback cancelled');
        return;
      }

      pushFrontendRuntimeError('voice', source === 'manual' ? 'manual voice playback failed' : 'reply voice playback failed', error, {
        provider: currentSettings.ttsProvider,
        force,
      });
      console.error('Voice playback failed:', error);
      publishStatusMessage(
        source === 'manual'
          ? buildManualVoicePlaybackFailedMessage(error)
          : buildVoicePlaybackFailedMessage(error),
      );
    } finally {
      unregisterMouthPlayback();
      if (playbackToken === voicePlaybackTokenRef.current) {
        voicePlaybackStopRef.current = null;
        desktopPetChatStore.setSpeaking(false);
        desktopPetChatStore.setSpeakingPetId(null);
        desktopPetChatStore.setSpeechExpressionAction(targetPetId, null);
      }
    }
  }, [
    configRef,
    publishStatusMessage,
    resetVoicePlaybackState,
    voicePlaybackStopRef,
    voicePlaybackTokenRef,
  ]);

  return {
    playVoiceText,
    stopDirectVoicePlayback,
  };
}
