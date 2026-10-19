import { useCallback, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakText, stopVoicePlayback } from '../services/voiceService';
import { type PetAutoSpeechTrigger, type PetConfig } from '../types';
import { getVoiceErrorMessage, isVoiceCancellationError } from '../voice/errorMessages';
import { resolvePetMessageExpressionAction } from '../pet-runtime/interactions/petMessageExpressionSignals';
import { getStartupGreetingLlmResponse } from '../life-companion/startupGreetingLlm';
import { resolvePetVoiceSettings } from '../voice/petVoiceSettings';
import { getDesktopPetSlot, PRIMARY_DESKTOP_PET_SLOT_ID } from '../multiPetRoster';

interface UsePetRuntimeSpeechControllerOptions {
  addLog: (message: string) => void;
  configRef: MutableRefObject<PetConfig>;
}

export function usePetRuntimeSpeechController({
  addLog,
  configRef,
}: UsePetRuntimeSpeechControllerOptions) {
  const autoSpeechStopRef = useRef<(() => void) | null>(null);
  const autoSpeechTokenRef = useRef(0);
  const autoSpeechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const startupGreetingTokenRef = useRef(0);
  const startupGreetingAbortRef = useRef<AbortController | null>(null);

  const waitForChatIdle = useCallback((signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    const isIdle = () => {
      const state = desktopPetChatStore.getState();
      return !state.isTyping && !state.isSpeaking;
    };
    if (signal.aborted) {
      reject(new DOMException('Startup greeting cancelled', 'AbortError'));
      return;
    }
    if (isIdle()) {
      resolve();
      return;
    }

    let settled = false;
    let unsubscribe = () => undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve();
    };
    const onAbort = () => finish(new DOMException('Startup greeting cancelled', 'AbortError'));
    unsubscribe = desktopPetChatStore.subscribe(() => {
      if (isIdle()) finish();
    });
    signal.addEventListener('abort', onAbort, { once: true });
  }), []);

  // Any character can speak up on her own now (greetings, hunger, affection), not only the
  // main one: the line is posted and voiced as that character.
  const resolveSpeaker = useCallback((petId: string | null | undefined) => {
    const slot = getDesktopPetSlot(configRef.current, petId || PRIMARY_DESKTOP_PET_SLOT_ID);
    return slot
      ? { id: slot.id, personality: slot.personality }
      : { id: PRIMARY_DESKTOP_PET_SLOT_ID, personality: configRef.current.personality };
  }, [configRef]);

  const playPetSpeech = useCallback(async (text: string, settings: PetConfig['settings'], petId: string = PRIMARY_DESKTOP_PET_SLOT_ID) => {
    if (!text.trim()) {
      return;
    }
    const speaker = resolveSpeaker(petId);

    desktopPetChatStore.addMessage({
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `runtime-message-${Date.now()}`,
      role: 'model',
      text,
      chatMode: 'single',
      petId: speaker.id,
      petName: speaker.personality.name,
    });

    const chatState = desktopPetChatStore.getState();
    if (chatState.isTyping || chatState.isSpeaking) {
      return;
    }

    autoSpeechStopRef.current?.();
    autoSpeechStopRef.current = null;
    stopVoicePlayback();

    if (!settings.voiceEnabled || !settings.autoSpeakResponses) {
      desktopPetChatStore.setSpeaking(false);
      return;
    }

      const playbackToken = ++autoSpeechTokenRef.current;
    try {
      desktopPetChatStore.setSpeaking(true);
      desktopPetChatStore.setSpeakingPetId(speaker.id);
      const expressionAction = resolvePetMessageExpressionAction(text);
      desktopPetChatStore.setSpeechExpressionAction(speaker.id, expressionAction);
      pushFrontendRuntimeLog('语音', '开始主动播报', {
        provider: settings.ttsProvider,
        textLength: text.length,
      });
      const voiceSettings = resolvePetVoiceSettings({ ...configRef.current, settings }, speaker.id);
      const playback = await speakText(text, voiceSettings, undefined, { expressionAction });
      if (playbackToken !== autoSpeechTokenRef.current) {
        playback.stop();
        return;
      }

      autoSpeechStopRef.current = () => playback.stop();
      await playback.done;
    } catch (error) {
      if (isVoiceCancellationError(error)) {
        pushFrontendRuntimeLog('语音', '主动播报已取消');
        return;
      }

      pushFrontendRuntimeError('语音', '主动播报失败', error, {
        provider: settings.ttsProvider,
      });
      console.error('Pet voice playback failed:', error);
      const message = `语音播报失败：${getVoiceErrorMessage(error, '请检查本地语音设置。')}`;
      desktopPetChatStore.setStatusMessage(message);
      addLog(message);
    } finally {
      if (playbackToken === autoSpeechTokenRef.current) {
        autoSpeechStopRef.current = null;
        desktopPetChatStore.setSpeaking(false);
        desktopPetChatStore.setSpeakingPetId(null);
        desktopPetChatStore.setSpeechExpressionAction(speaker.id, null);
      }
    }
  }, [addLog, configRef, resolveSpeaker]);

  const enqueueTriggeredPetSpeech = useCallback((trigger: PetAutoSpeechTrigger) => {
    // The life companion switches for these lines were shown in settings but never checked.
    const lifeCompanion = configRef.current.settings.lifeCompanion;
    if (trigger.kind === 'affection-milestone' && lifeCompanion?.affectionEnabled === false) return;
    if (trigger.kind !== 'affection-milestone' && lifeCompanion?.hungerEnabled === false) return;
    autoSpeechQueueRef.current = autoSpeechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const { getPetTriggeredResponse } = await import('../services/geminiService');
          pushFrontendRuntimeLog('对话', '开始生成主动对话', {
            trigger: trigger.kind,
          });
          const speaker = resolveSpeaker(trigger.petId);
          const text = await getPetTriggeredResponse(
            desktopPetChatStore.getState().messages,
            trigger,
            speaker.personality,
            configRef.current.settings,
          );

          if (!text.trim()) {
            pushFrontendRuntimeLog('对话', '主动对话生成为空', {
              trigger: trigger.kind,
            });
            return;
          }

          pushFrontendRuntimeLog('对话', '主动对话生成完成', {
            trigger: trigger.kind,
            textLength: text.length,
          });
          await playPetSpeech(text, configRef.current.settings, speaker.id);
        } catch (error) {
          pushFrontendRuntimeError('对话', '主动对话生成失败', error, {
            trigger: trigger.kind,
          });
          console.error('Triggered pet speech generation failed:', error);
          addLog(
            error instanceof Error
              ? `主动对话生成失败：${error.message}`
              : '主动对话生成失败，请稍后再试。',
          );
        }
      });
  }, [addLog, configRef, playPetSpeech, resolveSpeaker]);

  /** Greets from each given character in turn (one queued task, so they do not cancel each other). */
  const enqueueStartupGreeting = useCallback((petIds: string[] = [PRIMARY_DESKTOP_PET_SLOT_ID]) => {
    const requestToken = ++startupGreetingTokenRef.current;
    startupGreetingAbortRef.current?.abort();
    const abortController = new AbortController();
    startupGreetingAbortRef.current = abortController;
    autoSpeechQueueRef.current = autoSpeechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (requestToken !== startupGreetingTokenRef.current || abortController.signal.aborted) return;
        try {
          for (const petId of petIds) {
            const speaker = resolveSpeaker(petId);
            pushFrontendRuntimeLog('对话', '开始生成启动模型问候', { petId: speaker.id });
            const text = await getStartupGreetingLlmResponse({
              history: desktopPetChatStore.getState().messages,
              personality: speaker.personality,
              settings: configRef.current.settings,
              signal: abortController.signal,
            });
            if (requestToken !== startupGreetingTokenRef.current || abortController.signal.aborted) return;
            await waitForChatIdle(abortController.signal);
            if (requestToken !== startupGreetingTokenRef.current || abortController.signal.aborted) return;
            await playPetSpeech(text, configRef.current.settings, speaker.id);
          }
          addLog('启动问候已发送');
        } catch (error) {
          if (abortController.signal.aborted || requestToken !== startupGreetingTokenRef.current) return;
          pushFrontendRuntimeError('对话', '启动模型问候生成失败', error);
          console.error('Startup greeting generation failed:', error);
          const message = '启动问候生成失败，请检查模型配置。';
          desktopPetChatStore.setStatusMessage(message);
          addLog(message);
        } finally {
          if (startupGreetingAbortRef.current === abortController) {
            startupGreetingAbortRef.current = null;
          }
        }
      });
  }, [addLog, configRef, playPetSpeech, resolveSpeaker, waitForChatIdle]);

  const cleanupAutoSpeech = useCallback(() => {
    startupGreetingTokenRef.current += 1;
    startupGreetingAbortRef.current?.abort();
    startupGreetingAbortRef.current = null;
    autoSpeechTokenRef.current += 1;
    autoSpeechStopRef.current?.();
    autoSpeechStopRef.current = null;
    stopVoicePlayback();
    desktopPetChatStore.setSpeakingPetId(null);
    desktopPetChatStore.setSpeechExpressionAction('primary', null);
  }, []);

  return {
    cleanupAutoSpeech,
    enqueueStartupGreeting,
    enqueueTriggeredPetSpeech,
  };
}
