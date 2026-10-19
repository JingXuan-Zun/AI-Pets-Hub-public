import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { startConversationCapture } from '../../voice/conversationCapture';
import { resolveConversationSttSettings } from '../../voice/conversationSttModel';
import { getVoiceErrorMessage } from '../../voice/errorMessages';
import { voiceMicStatusStore } from '../../voice/voiceMicStatus';
import { transcribeLocalVoice } from '../../voice/runtime';
import { judgeApprovalAnswerWithModel, resolvePendingApprovalBySpeech } from './voiceApproval';
import { latestPendingAgentLoopApprovalId } from './runController/agentLoopApprovalRegistry';
import { isAwaitingVoiceApproval, isPetAudible, isPetVoiceBusy, subscribePetVoiceBusy } from './voiceConversationBusy';
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

// The repeated-failure stop used to blame the model even when the speech environment was
// simply not installed (a new build in another folder), which sent people the wrong way.
const MISSING_STT_ENVIRONMENT = /venv|python|runtime|environment|not installed|ENOENT|环境|未安装|找不到/iu;

export function resolveRecognitionStopMessage(lastError: string) {
  if (MISSING_STT_ENVIRONMENT.test(lastError)) {
    return '语音识别环境还没装好，实时对话已停止。请到 设置 → 语音模型 安装语音识别环境后再试。';
  }
  const reason = lastError.trim().slice(0, 80);
  return reason ? `${END_MESSAGES.error.replace('请检查语音识别模型后再试。', '')}原因：${reason}` : END_MESSAGES.error;
}

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
    let lastRecognitionError = '';
    const session = createVoiceConversationSession({
      startCapture: startConversationCapture,
      recognize: (audioBase64) => transcribeLocalVoice(audioBase64, stt.settings),
      // A spoken "同意"/"拒绝" while an approval card waits answers the card instead of chatting;
      // other speech then is not sent, so it cannot cut into the task that is waiting.
      send: async (text) => {
        const decision = await resolvePendingApprovalBySpeech(text, judgeApprovalAnswerWithModel(configRef.current.settings));
        if (isAwaitingVoiceApproval() || decision) pushFrontendRuntimeLog('voice', 'approval answer heard', { decision, heard: text.slice(0, 40), listener: 'conversation' });
        if (decision) return;
        if (isAwaitingVoiceApproval()) {
          if (!isPetAudible()) publishStatusMessage('正在等你确认上面的卡片：说“好”或“不要”就可以。');
          return;
        }
        await sendMessage(text);
      },
      isBusy: isPetVoiceBusy,
      subscribeBusy: subscribePetVoiceBusy,
      onListeningChange: (listening) => desktopPetChatStore.setListening(listening),
      onRecognitionError: (error) => {
        pushFrontendRuntimeError('voice', 'conversation recognition failed', error);
        lastRecognitionError = getVoiceErrorMessage(error, '');
        publishStatusMessage(getVoiceErrorMessage(error, '语音识别执行失败，请再说一次。'));
      },
      onEnd: (reason) => {
        if (sessionRef.current === session) sessionRef.current = null;
        setActive(false);
        voiceMicStatusStore.setConversation(false);
        pushFrontendRuntimeLog('voice', 'conversation stopped', { reason });
        if (reason === 'error') onOpenChat?.(); // status messages only render in chat; surface the failure
        publishStatusMessage(reason === 'error' ? resolveRecognitionStopMessage(lastRecognitionError) : END_MESSAGES[reason]);
      },
      idleTimeoutMs: settings.voiceConversationIdleTimeoutSec * 1000,
      holdIdle: () => Boolean(latestPendingAgentLoopApprovalId()),
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
