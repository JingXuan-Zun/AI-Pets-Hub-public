import { useEffect, useRef } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { startConversationCapture, type ConversationCapture } from '../../voice/conversationCapture';
import { resolveConversationSttSettings } from '../../voice/conversationSttModel';
import { transcribeLocalVoice } from '../../voice/runtime';
import { buildVoiceWakeTargets, matchVoiceWakeTarget, type VoiceWakeTarget } from '../../voice/voiceWakeTargets';
import { desktopPetChatStore } from '../../chatStore';
import { voiceMicStatusStore } from '../../voice/voiceMicStatus';
import { isAwaitingVoiceApproval, isPetVoiceBusy, subscribePetVoiceBusy } from './voiceConversationBusy';
import { judgeApprovalAnswerWithModel, resolvePendingApprovalBySpeech } from './voiceApproval';
import { resolveConversationUnavailableReason } from './useVoiceConversationController';

// Wake phrases are short; long monologues are not worth a recognition pass.
const MAX_WAKE_UTTERANCE_MS = 10000;
const MAX_CONSECUTIVE_FAILURES = 2;
const EMPTY_UTTERANCE_MIN_MS = 1500;
const EMPTY_STREAK_BEFORE_REOPEN = 3;
const CAPTURE_REOPEN_DELAY_MS = 600;

interface UseVoiceWakeListenerOptions {
  config: PetConfig;
  conversationActive: boolean;
  onOpenChat?: () => void;
  /** A character's own wake phrase was heard: make that character the one being talked to. */
  onWakeCharacter: (petId: string) => void;
  publishStatusMessage: (message: string) => void;
  startConversation: (initialText?: string) => Promise<boolean>;
}

function shouldListenForWake(config: PetConfig, conversationActive: boolean) {
  return desktopPetShellRuntime.isDesktopMode()
    && config.settings.voiceWakeEnabled
    && !conversationActive
    && resolveConversationUnavailableReason(config.settings) === null;
}

// Opt-in background listener: local STT on each short utterance, starts hands-free conversation on a
// wake phrase. Muted while the pet has the floor so her own voice cannot wake her.
export function useVoiceWakeListener({
  config, conversationActive, onOpenChat, onWakeCharacter, publishStatusMessage, startConversation,
}: UseVoiceWakeListenerOptions) {
  const callbacksRef = useRef({ onOpenChat, onWakeCharacter, publishStatusMessage, startConversation });
  callbacksRef.current = { onOpenChat, onWakeCharacter, publishStatusMessage, startConversation };
  const enabled = shouldListenForWake(config, conversationActive);
  const targetsKey = JSON.stringify(buildVoiceWakeTargets(config));

  useEffect(() => {
    const targets = JSON.parse(targetsKey) as VoiceWakeTarget[];
    if (!enabled || targets.length === 0) return undefined;
    let disposed = false;
    let capture: ConversationCapture | null = null;
    let unsubscribe: (() => void) | null = null;
    let sttSettings: PetConfig['settings'] | null = null;
    let failures = 0;
    const shutdown = () => {
      disposed = true;
      voiceMicStatusStore.setWakeListening(false);
      unsubscribe?.();
      unsubscribe = null;
      void capture?.stop();
      capture = null;
    };
    const syncBusy = () => {
      if (!capture) return;
      if (isPetVoiceBusy()) capture.pause();
      else if (capture.isPaused()) capture.resume();
    };
    // A microphone opened while the previous one was still closing (live conversation ending
    // into wake listening) delivered silence: a minute and a half of speech all came back as
    // ".". Several long utterances in a row with nothing in them reopen the microphone.
    let emptyStreak = 0;
    const onUtterance = async (audioBase64: string, durationMs: number) => {
      if (disposed || !sttSettings || durationMs > MAX_WAKE_UTTERANCE_MS || isPetVoiceBusy()) return;
      try {
        const transcript = await transcribeLocalVoice(audioBase64, sttSettings);
        failures = 0;
        if (durationMs >= EMPTY_UTTERANCE_MIN_MS && !transcript.replace(/[\s\p{P}]/gu, '')) {
          emptyStreak += 1;
          if (emptyStreak >= EMPTY_STREAK_BEFORE_REOPEN && !disposed) {
            emptyStreak = 0;
            pushFrontendRuntimeLog('voice', 'wake listener heard only silence; reopening the microphone', {});
            void reopenCapture();
          }
          return;
        }
        emptyStreak = 0;
        // While an approval card waits, a plain "同意"/"拒绝" answers it without the wake word.
        if (!disposed && await resolvePendingApprovalBySpeech(transcript, judgeApprovalAnswerWithModel(config.settings))) {
          pushFrontendRuntimeLog('voice', 'approval answered by voice', {});
          return;
        }
        const match = disposed ? null : matchVoiceWakeTarget(transcript, targets, desktopPetChatStore.getState().activePetId);
        if (match?.remainder && await resolvePendingApprovalBySpeech(match.remainder, judgeApprovalAnswerWithModel(config.settings))) {
          pushFrontendRuntimeLog('voice', 'approval answered by voice', { withWakeWord: true });
          return;
        }
        // The microphone only listens mid-task to hear the answer; nothing else starts a chat then.
        if (isAwaitingVoiceApproval()) return;
        if (!match) {
          // Local-only diagnostics so misheard wake phrases can be tuned (e.g. add the heard variant).
          pushFrontendRuntimeLog('voice', 'wake phrase not matched', { heard: transcript.slice(0, 24), durationMs });
          return;
        }
        pushFrontendRuntimeLog('voice', 'wake phrase detected', { phrase: match.phrase, petId: match.petId, hasRemainder: Boolean(match.remainder) });
        shutdown();
        if (match.petId) callbacksRef.current.onWakeCharacter(match.petId);
        await callbacksRef.current.startConversation(match.remainder);
      } catch (error) {
        pushFrontendRuntimeError('voice', 'wake recognition failed', error);
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES && !disposed) {
          shutdown();
          callbacksRef.current.onOpenChat?.();
          callbacksRef.current.publishStatusMessage('语音唤醒的识别连续失败，已暂停唤醒监听。请检查语音识别模型后重新开启。');
        }
      }
    };
    const openCapture = () => startConversationCapture({ onUtterance: (audio, ms) => void onUtterance(audio, ms) })
      .then((nextCapture) => {
        if (disposed) {
          void nextCapture.stop();
          return;
        }
        capture = nextCapture;
        voiceMicStatusStore.setWakeListening(true);
        unsubscribe ??= subscribePetVoiceBusy(syncBusy);
        syncBusy();
        pushFrontendRuntimeLog('voice', 'wake listener started', { phrases: targets.length, sttModelId: sttSettings?.localSttModelId });
      });
    const reopenCapture = async () => {
      const previous = capture;
      capture = null;
      await previous?.stop();
      await new Promise((resolve) => { window.setTimeout(resolve, CAPTURE_REOPEN_DELAY_MS); });
      if (!disposed) await openCapture().catch((error) => pushFrontendRuntimeError('voice', 'wake listener reopen failed', error));
    };
    // Give the microphone that live conversation just released a moment to close first.
    const startTimer = window.setTimeout(() => {
      void resolveConversationSttSettings(config.settings)
        .then((stt) => {
          if ('error' in stt) throw new Error(stt.error);
          sttSettings = stt.settings;
          return openCapture();
        })
        .catch((error) => pushFrontendRuntimeError('voice', 'wake listener start failed', error));
    }, CAPTURE_REOPEN_DELAY_MS);
    return () => {
      window.clearTimeout(startTimer);
      shutdown();
    };
  }, [enabled, targetsKey]); // config.settings is read once per (re)start; these keys cover what matters
}
