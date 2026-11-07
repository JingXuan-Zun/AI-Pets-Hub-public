import { desktopPetChatStore } from '../chatStore';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../multiPetRoster';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import type { ChatQuickReply, PetConfig } from '../types';
import { ONBOARDING_LINES, onboardingVoiceUrl, type OnboardingLineId } from './onboardingLines';

// Showing and speaking a guide line: a chat message from the main character (with its buttons)
// and its pre-recorded clip, with the speaking state on so her mouth moves.

let current: { audio: HTMLAudioElement; finish: () => void } | null = null;

/** Stops the clip; whoever waits for it (the intro sequence) goes on. */
export function stopOnboardingVoice() {
  if (!current) return;
  current.audio.pause();
  current.finish();
}

function playClip(id: OnboardingLineId) {
  stopOnboardingVoice();
  const audio = new Audio(onboardingVoiceUrl(id));
  desktopPetChatStore.setSpeakingPetId(PRIMARY_DESKTOP_PET_SLOT_ID);
  desktopPetChatStore.setSpeaking(true);
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (current?.audio === audio) {
        current = null;
        desktopPetChatStore.setSpeaking(false);
        desktopPetChatStore.setSpeakingPetId(null);
      }
      resolve();
    };
    current = { audio, finish };
    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', () => {
      pushFrontendRuntimeLog('新手引导', '台词语音播放失败', { id });
      finish();
    }, { once: true });
    void audio.play().catch(finish);
  });
}

export function postGuideMessage(config: PetConfig, text: string, quickReplies?: ChatQuickReply[]) {
  desktopPetChatStore.addMessage({
    chatMode: 'single',
    createdAt: Date.now(),
    id: createChatMessageId('onboarding'),
    petId: PRIMARY_DESKTOP_PET_SLOT_ID,
    petName: config.personality.name,
    quickReplies,
    role: 'model',
    text,
  });
}

/** Shows the line and, unless voice is off, speaks it; resolves when the clip ends. */
export async function sayOnboardingLine(config: PetConfig, id: OnboardingLineId, options: { voice?: boolean } = {}) {
  const line = ONBOARDING_LINES[id];
  postGuideMessage(config, line.text, line.quickReplies);
  pushFrontendRuntimeLog('新手引导', '说了一句引导', { id });
  if (options.voice === false || config.settings.voiceEnabled === false) return;
  await playClip(id);
}
