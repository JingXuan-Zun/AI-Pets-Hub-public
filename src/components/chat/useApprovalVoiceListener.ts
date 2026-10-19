import { useEffect, useRef } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { startConversationCapture, type ConversationCapture } from '../../voice/conversationCapture';
import { resolveConversationSttSettings } from '../../voice/conversationSttModel';
import { transcribeLocalVoice } from '../../voice/runtime';
import { voiceMicStatusStore } from '../../voice/voiceMicStatus';
import { latestPendingAgentLoopApprovalId, subscribeAgentLoopApprovals } from './runController/agentLoopApprovalRegistry';
import { judgeApprovalAnswerWithModel, resolvePendingApprovalBySpeech } from './voiceApproval';
import { isPetVoiceBusy, subscribePetVoiceBusy } from './voiceConversationBusy';
import { resolveConversationUnavailableReason } from './useVoiceConversationController';

const MAX_ANSWER_UTTERANCE_MS = 8000;

// While a task waits for the user's yes/no and neither live conversation nor the wake listener
// has the microphone, it listens just for that answer and lets go once the question is
// settled. Without this a spoken "同意" went unheard whenever the microphone was off.
export function useApprovalVoiceListener({ config, conversationActive }: { config: PetConfig; conversationActive: boolean }) {
  const settingsRef = useRef(config.settings);
  settingsRef.current = config.settings;
  const allowed = desktopPetShellRuntime.isDesktopMode()
    && !conversationActive
    && resolveConversationUnavailableReason(config.settings) === null;

  useEffect(() => {
    if (!allowed) return undefined;
    let capture: ConversationCapture | null = null;
    let starting = false;
    let unsubscribeBusy: (() => void) | null = null;
    let sttSettings: PetConfig['settings'] | null = null;

    const stop = () => {
      unsubscribeBusy?.();
      unsubscribeBusy = null;
      void capture?.stop();
      capture = null;
    };
    const syncBusy = () => {
      if (!capture) return;
      if (isPetVoiceBusy()) capture.pause();
      else if (capture.isPaused()) capture.resume();
    };
    const onUtterance = async (audioBase64: string, durationMs: number) => {
      if (!sttSettings || durationMs > MAX_ANSWER_UTTERANCE_MS || !latestPendingAgentLoopApprovalId()) return;
      try {
        const transcript = await transcribeLocalVoice(audioBase64, sttSettings);
        const decision = await resolvePendingApprovalBySpeech(transcript, judgeApprovalAnswerWithModel(settingsRef.current));
        // Local diagnostics: what was heard and whether it answered the question.
        pushFrontendRuntimeLog('voice', 'approval answer heard', { decision, heard: transcript.slice(0, 40), listener: 'approval' });
      } catch (error) {
        pushFrontendRuntimeError('voice', 'approval answer recognition failed', error);
      }
    };
    const sync = () => {
      const needed = Boolean(latestPendingAgentLoopApprovalId()) && !voiceMicStatusStore.getState().wakeListening;
      if (!needed) {
        if (capture) stop();
        return;
      }
      if (capture || starting) return;
      starting = true;
      void resolveConversationSttSettings(settingsRef.current)
        .then((stt) => {
          if ('error' in stt) throw new Error(stt.error);
          sttSettings = stt.settings;
          return startConversationCapture({ onUtterance: (audio, ms) => void onUtterance(audio, ms) });
        })
        .then((nextCapture) => {
          starting = false;
          if (!latestPendingAgentLoopApprovalId()) {
            void nextCapture.stop();
            return;
          }
          capture = nextCapture;
          unsubscribeBusy = subscribePetVoiceBusy(syncBusy);
          syncBusy();
          pushFrontendRuntimeLog('voice', 'listening for an approval answer', {});
        })
        .catch((error) => {
          starting = false;
          pushFrontendRuntimeError('voice', 'approval listener start failed', error);
        });
    };
    const unsubscribeChat = desktopPetChatStore.subscribe(sync);
    const unsubscribeMic = voiceMicStatusStore.subscribe(sync);
    const unsubscribeApprovals = subscribeAgentLoopApprovals(sync);
    sync();
    return () => {
      unsubscribeChat();
      unsubscribeMic();
      unsubscribeApprovals();
      stop();
    };
  }, [allowed]);
}
