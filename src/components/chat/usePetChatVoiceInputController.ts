import { useCallback, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeError } from '../../frontendRuntimeLogger';
import { startVoiceInput } from '../../services/voiceService';
import { type PetConfig } from '../../types';
import { getVoiceErrorMessage } from '../../voice/errorMessages';
import { type VoiceInputSession } from '../../voice/types';

const VOICE_INPUT_DISABLED_MESSAGE = '语音输入当前已在设置中关闭。';
const VOICE_LISTENING_STARTED_MESSAGE = '语音监听已启动。';
const VOICE_INPUT_START_FAILED_MESSAGE = '语音识别启动失败。';

const VOICE_AGENT_COMMAND_PREFIX_PATTERN = /^\/\s*(?:agent)?$/i;

interface UsePetChatVoiceInputControllerOptions {
  configRef: MutableRefObject<PetConfig>;
  onOpenChat?: () => void;
  publishStatusMessage: (message: string) => void;
  stopPetSpeech?: () => void;
  sendMessage: (
    textOverride?: string,
    options?: { browserSearchMode?: 'allow' | 'block' | 'force' },
  ) => Promise<void>;
  voiceInputSessionRef: MutableRefObject<VoiceInputSession | null>;
  voiceTranscriptRef: MutableRefObject<string>;
}

function resolveVoiceInputCommandPrefix(inputValue: string) {
  const trimmedInput = inputValue.trim();

  return VOICE_AGENT_COMMAND_PREFIX_PATTERN.test(trimmedInput)
    ? trimmedInput
    : '';
}

function applyVoiceInputCommandPrefix(prefix: string, transcript: string) {
  if (!prefix) {
    return transcript;
  }

  return `${prefix} ${transcript}`.trim();
}

export function usePetChatVoiceInputController({
  configRef,
  onOpenChat,
  publishStatusMessage,
  stopPetSpeech,
  sendMessage,
  voiceInputSessionRef,
  voiceTranscriptRef,
}: UsePetChatVoiceInputControllerOptions) {
  const stopVoiceInput = useCallback(() => {
    if (!desktopPetChatStore.getState().isListening && !voiceInputSessionRef.current) {
      publishStatusMessage('当前没有正在进行的语音输入监听。');
      return {
        ok: true,
        responseText: '当前没有正在进行的语音输入监听。',
        verification: 'No active voice input session.',
      };
    }

    voiceInputSessionRef.current?.stop();
    voiceInputSessionRef.current = null;
    voiceTranscriptRef.current = '';
    desktopPetChatStore.setListening(false);
    publishStatusMessage('语音输入监听已停止。');

    return {
      ok: true,
      responseText: '语音输入监听已停止。',
      verification: 'Voice input session stopped.',
    };
  }, [
    publishStatusMessage,
    voiceInputSessionRef,
    voiceTranscriptRef,
  ]);

  const startVoiceInputSession = useCallback(async (options: { agentPrefix?: boolean } = {}) => {
    if (!configRef.current.settings.voiceInputEnabled) {
      publishStatusMessage(VOICE_INPUT_DISABLED_MESSAGE);
      return {
        errorText: VOICE_INPUT_DISABLED_MESSAGE,
        ok: false,
        responseText: VOICE_INPUT_DISABLED_MESSAGE,
      };
    }

    if (desktopPetChatStore.getState().isListening) {
      return {
        ok: true,
        responseText: '语音输入监听已经在进行中。',
        verification: 'Voice input session already active.',
      };
    }

    const commandPrefix = options.agentPrefix
      ? '/agent'
      : resolveVoiceInputCommandPrefix(desktopPetChatStore.getState().inputValue);
    onOpenChat?.();
    stopPetSpeech?.();
    voiceTranscriptRef.current = '';

    try {
      const session = await startVoiceInput({
        settings: configRef.current.settings,
        onError: (message) => {
          desktopPetChatStore.setListening(false);
          voiceInputSessionRef.current = null;
          publishStatusMessage(message);
        },
        onFinalTranscript: (transcript) => {
          voiceInputSessionRef.current = null;
          const nextTranscript = transcript.trim();
          if (nextTranscript) {
            void sendMessage(applyVoiceInputCommandPrefix(commandPrefix, nextTranscript));
          }
        },
        onInterimTranscript: (transcript) => {
          const nextTranscript = transcript.trim();
          voiceTranscriptRef.current = nextTranscript;
          desktopPetChatStore.setInputValue(applyVoiceInputCommandPrefix(commandPrefix, nextTranscript));
        },
        onListeningChange: (nextIsListening) => {
          desktopPetChatStore.setListening(nextIsListening);
          if (!nextIsListening && voiceInputSessionRef.current && !voiceTranscriptRef.current.trim()) {
            voiceInputSessionRef.current = null;
          }
        },
      });

      voiceInputSessionRef.current = session;
      publishStatusMessage(VOICE_LISTENING_STARTED_MESSAGE);

      return {
        ok: true,
        responseText: options.agentPrefix
          ? '我开始听了；识别到的内容会作为 Agent 指令发送。'
          : '我开始听了；识别到的内容会发回当前聊天。',
        verification: 'Voice input session started.',
      };
    } catch (error) {
      pushFrontendRuntimeError('voice', 'voice input start failed', error, {
        provider: configRef.current.settings.sttProvider,
      });
      console.error('Voice recognition failed:', error);
      desktopPetChatStore.setListening(false);
      voiceInputSessionRef.current = null;
      const message = getVoiceErrorMessage(error, VOICE_INPUT_START_FAILED_MESSAGE);
      publishStatusMessage(message);

      return {
        errorText: message,
        ok: false,
        responseText: message,
        verification: `Voice input start failed: ${message}`,
      };
    }
  }, [
    configRef,
    onOpenChat,
    publishStatusMessage,
    sendMessage,
    stopPetSpeech,
    voiceInputSessionRef,
    voiceTranscriptRef,
  ]);

  const toggleVoiceInput = useCallback(() => {
    if (desktopPetChatStore.getState().isListening) {
      stopVoiceInput();
      return;
    }

    void startVoiceInputSession();
  }, [
    startVoiceInputSession,
    stopVoiceInput,
  ]);

  return {
    startVoiceInputSession,
    stopVoiceInput,
    toggleVoiceInput,
  };
}
