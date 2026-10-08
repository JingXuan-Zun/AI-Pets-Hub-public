import { desktopPetChatStore } from '../../chatStore';
import { isVoiceOutputActive, subscribeVoiceOutputActivity } from '../../voice/voiceOutputActivity';

// The pet "has the floor" while a reply is generating, audio is playing, or a queued sentence is
// still being synthesized; hands-free listening must stay muted for all three.
export function isPetVoiceBusy() {
  const { isSpeaking, isTyping } = desktopPetChatStore.getState();
  return isTyping || isSpeaking || isVoiceOutputActive();
}

export function subscribePetVoiceBusy(listener: () => void) {
  const unsubscribeChat = desktopPetChatStore.subscribe(listener);
  const unsubscribeVoice = subscribeVoiceOutputActivity(listener);
  return () => {
    unsubscribeChat();
    unsubscribeVoice();
  };
}
