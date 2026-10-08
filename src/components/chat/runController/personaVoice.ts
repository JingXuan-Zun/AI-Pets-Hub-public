import { type ChatSendTargetSlot } from '../chatMessageSendUtils';
import { type AgentPlayVoiceText } from './controllerTypes';

export function playDeferredAgentPersonaVoice(options: {
  playVoiceText: AgentPlayVoiceText;
  shouldAutoSpeakReply: boolean;
  targetSlot: ChatSendTargetSlot;
  text: string;
}) {
  const {
    playVoiceText,
    shouldAutoSpeakReply,
    targetSlot,
    text,
  } = options;
  const voiceText = text.trim();
  if (!shouldAutoSpeakReply || !voiceText) {
    return;
  }

  void playVoiceText(voiceText, {
    petId: targetSlot.id,
    source: 'reply',
  });
}
