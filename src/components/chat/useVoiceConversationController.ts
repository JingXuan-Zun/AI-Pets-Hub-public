import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { startConversationCapture } from '../../voice/conversationCapture';
import { resolveConversationSttSettings } from '../../voice/conversationSttModel';
import { getVoiceErrorMessage } from '../../voice/errorMessages';
import { voiceMicStatusStore } from '../../voice/voiceMicStatus';
import { transcribeLocalVoice } from '../../voice/runtime';
import { isPetVoiceBusy, subscribePetVoiceBusy } from './voiceConversationBusy';
import { createVoiceConversationSession, type VoiceConversationEndReason } from './voiceConversationSession';

interface UseVoiceConversationControllerOptions {
  configRef: MutableRefObject<PetConfig>;
  onOpenChat?: () => void;
  publishStatusMessage: (message: string) => void;
  sendMessage: (textOverride?: string) => Promise<void>;
}

type ConversationSession = ReturnType<typeof createVoiceConversationSession>;

// Model availability is resolved asynchronously at start (SenseVoice preferred, see conversationSttModel).
export function resolveConversationUnavailableReason(settings: PetConfig['settings']) {
  return settings.voiceInputEnabled ? null : '语音输入当前已在设置中关闭。';
}

const END_MESSAGES: Record<VoiceConversationEndReason, string> = {
  user: '实时对话已结束。',
  idle: '一段时间没听到你说话，麦克风先关啦。',
  error: '语音识别连续失败，实时对话已停止。请检查语音识别模型后再试。',
};

// React glue for the hands-free conversation session (settings, sending, status, active flag).
export function useVoiceConversationController({
  configRef, onOpenChat, publishStatusMessage, sendMessage,
}: UseVoiceConversationControllerOptions) {
  const sessionRef = useRef<ConversationSession | null>(null);
  const [active, setActive] = useState(false);

  const stopConversation = useCallback((reason: VoiceConversationEndReason = 'user') => {
    sessionRef.current?.stop(reason);
  }, []);

  const startConversation = useCallback(async (initialText?: string) => {
    const settings = configRef.current.settings;
    const unavailable = resolveConversationUnavailableReason(settings);
    if (unavailable) {
      publishStatusMessage(unavailable);
      return false;
    }
    if (sessionRef.current?.isActive()) return true;
    const stt = await resolveConversationSttSettings(settings);
    if ('error' in stt) {
      publishStatusMessage(stt.error);
      return false;
    }
    const session = createVoiceConversationSession({
      startCapture: startConversationCapture,
      recognize: (audioBase64) => transcribeLocalVoice(audioBase64, stt.settings),
      send: sendMessage,
      isBusy: isPetVoiceBusy,
      subscribeBusy: subscribePetVoiceBusy,
      onListeningChange: (listening) => desktopPetChatStore.setListening(listening),
      onRecognitionError: (error) => {
        pushFrontendRuntimeError('voice', 'conversation recognition failed', error);
        publishStatusMessage(getVoiceErrorMessage(error, '语音识别执行失败，请再说一次。'));
      },
      onEnd: (reason) => {
        if (sessionRef.current === session) sessionRef.current = null;
        setActive(false);
        voiceMicStatusStore.setConversation(false);
        pushFrontendRuntimeLog('voice', 'conversation stopped', { reason });
        if (reason === 'error') onOpenChat?.(); // status messages only render in chat; surface the failure
        publishStatusMessage(END_MESSAGES[reason]);
      },
      idleTimeoutMs: settings.voiceConversationIdleTimeoutSec * 1000,
    });
    sessionRef.current = session;
    try {
      await session.start();
    } catch (error) {
      sessionRef.current = null;
      pushFrontendRuntimeError('voice', 'conversation start failed', error);
      publishStatusMessage(getVoiceErrorMessage(error, '实时对话启动失败，请检查麦克风。'));
      return false;
    }
    setActive(true);
    voiceMicStatusStore.setConversation(true, () => session.stop('user'));
    if (settings.voiceConversationOpenChat) onOpenChat?.();
    pushFrontendRuntimeLog('voice', 'conversation started', { sttModelId: stt.settings.localSttModelId });
    publishStatusMessage('实时对话已开启，直接说话就好；她说话时麦克风会自动暂停。');
    if (initialText?.trim()) void sendMessage(initialText.trim());
    return true;
  }, [configRef, onOpenChat, publishStatusMessage, sendMessage]);

  useEffect(() => () => sessionRef.current?.stop('user'), []);

  return useMemo(() => ({
    active,
    isConversationActive: () => Boolean(sessionRef.current?.isActive()),
    startConversation,
    stopConversation,
  }), [active, startConversation, stopConversation]);
}
