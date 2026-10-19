import { desktopPetChatStore } from '../../chatStore';
import { isVoiceOutputActive, subscribeVoiceOutputActivity } from '../../voice/voiceOutputActivity';
import { latestPendingAgentLoopApprovalId, subscribeAgentLoopApprovals } from './runController/agentLoopApprovalRegistry';

// The pet "has the floor" while a reply is generating, audio is playing, or a queued sentence is
// still being synthesized; hands-free listening must stay muted for all three.
// Exception: while a task waits on an approval card and she is silent, the user has the floor
// and the microphone listens for the answer. Listening and her voice stay separate: while she
// talks (or a sentence is still being synthesized) the microphone is off, so it never hears
// her and an answer never cuts her off; once she finishes it listens again.
export function isAwaitingVoiceApproval() {
  return Boolean(latestPendingAgentLoopApprovalId()) && !isPetAudible();
}

/** The character's voice is playing or a sentence is still being synthesized. */
export function isPetAudible() {
  return desktopPetChatStore.getState().isSpeaking || isVoiceOutputActive();
}

export function isPetVoiceBusy() {
  if (isAwaitingVoiceApproval()) return false;
  const { isSpeaking, isTyping } = desktopPetChatStore.getState();
  return isTyping || isSpeaking || isVoiceOutputActive();
}

export function subscribePetVoiceBusy(listener: () => void) {
  const unsubscribeChat = desktopPetChatStore.subscribe(listener);
  const unsubscribeVoice = subscribeVoiceOutputActivity(listener);
  const unsubscribeApprovals = subscribeAgentLoopApprovals(listener);
  return () => {
    unsubscribeChat();
    unsubscribeVoice();
    unsubscribeApprovals();
  };
}
