import { useCallback, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakText, stopVoicePlayback } from '../services/voiceService';
import { type PetAutoSpeechTrigger, type PetConfig } from '../types';
import { getVoiceErrorMessage, isVoiceCancellationError } from '../voice/errorMessages';
import { resolvePetMessageExpressionAction } from '../pet-runtime/interactions/petMessageExpressionSignals';
import { getStartupGreetingLlmResponse } from '../life-companion/startupGreetingLlm';
import { resolvePetVoiceSettings } from '../voice/petVoiceSettings';

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

  const playPetSpeech = useCallback(async (text: string, settings: PetConfig['settings']) => {
    if (!text.trim()) {
      return;
    }

    desktopPetChatStore.addMessage({
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `runtime-message-${Date.now()}`,
      role: 'model',
      text,
      chatMode: 'single',
      petId: 'primary',
      petName: configRef.current.personality.name,
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
      desktopPetChatStore.setSpeakingPetId('primary');
      const expressionAction = resolvePetMessageExpressionAction(text);
      desktopPetChatStore.setSpeechExpressionAction('primary', expressionAction);
      pushFrontendRuntimeLog('语音', '开始主动播报', {
        provider: settings.ttsProvider,
        textLength: text.length,
      });
      const voiceSettings = resolvePetVoiceSettings({ ...configRef.current, settings }, 'primary');
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
        desktopPetChatStore.setSpeechExpressionAction('primary', null);
      }
    }
  }, [addLog, configRef]);

  const enqueueTriggeredPetSpeech = useCallback((trigger: PetAutoSpeechTrigger) => {
    autoSpeechQueueRef.current = autoSpeechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const { getPetTriggeredResponse } = await import('../services/geminiService');
          pushFrontendRuntimeLog('对话', '开始生成主动对话', {
            trigger: trigger.kind,
          });
          const text = await getPetTriggeredResponse(
            desktopPetChatStore.getState().messages,
            trigger,
            configRef.current.personality,
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
          await playPetSpeech(text, configRef.current.settings);
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
  }, [addLog, configRef, playPetSpeech]);

  const enqueueStartupGreeting = useCallback(() => {
    const requestToken = ++startupGreetingTokenRef.current;
    startupGreetingAbortRef.current?.abort();
    const abortController = new AbortController();
    startupGreetingAbortRef.current = abortController;
    autoSpeechQueueRef.current = autoSpeechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (requestToken !== startupGreetingTokenRef.current || abortController.signal.aborted) return;
        try {
          pushFrontendRuntimeLog('对话', '开始生成启动模型问候');
          const text = await getStartupGreetingLlmResponse({
            history: desktopPetChatStore.getState().messages,
            personality: configRef.current.personality,
            settings: configRef.current.settings,
            signal: abortController.signal,
          });
          if (requestToken !== startupGreetingTokenRef.current || abortController.signal.aborted) return;
          await waitForChatIdle(abortController.signal);
          if (requestToken !== startupGreetingTokenRef.current || abortController.signal.aborted) return;
          await playPetSpeech(text, configRef.current.settings);
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
  }, [addLog, configRef, playPetSpeech, waitForChatIdle]);

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
