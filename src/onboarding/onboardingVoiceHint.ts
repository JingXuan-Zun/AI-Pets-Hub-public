import { desktopPetChatStore } from '../chatStore';
import { readSharedConfig } from './onboardingConfigSource';
import { speakCompanionLine } from '../life-companion/companionLineSpeech';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../multiPetRoster';
import { readOnboardingProgress, updateOnboardingProgress } from './onboardingState';
import { postGuideMessage } from './onboardingSpeech';

// After a new user's first finished job, 小玲 offers her real voice once (the starter pack's
// one-click install lives at the top of 设置 → AI → 语音模型).

export const REAL_VOICE_HINT = '对了，现在我用的是电脑自带的声音。想听我真正的声音的话，可以一键装一下我的声音包，大概要下载一会儿～';
const MAX_WAIT_MS = 60_000;

async function waitUntilQuiet() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const chat = desktopPetChatStore.getState();
    if (!chat.isTyping && !chat.isSpeaking) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function offerRealVoiceOnce() {
  const progress = readOnboardingProgress();
  if (!progress.welcomedAt || progress.voiceHintAt) return;
  const config = readSharedConfig();
  if (!config) return;
  const settings = config.settings;
  if (settings.ttsProvider === 'gpt-sovits' && settings.gptSovitsModelId) return;
  updateOnboardingProgress({ voiceHintAt: Date.now() });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await waitUntilQuiet();
  postGuideMessage(config, REAL_VOICE_HINT, [
    { kind: 'settings', label: '装真声音', value: 'ai-voice-model' },
    { kind: 'send', label: '以后再说', value: '以后再说' },
  ]);
  speakCompanionLine(REAL_VOICE_HINT, PRIMARY_DESKTOP_PET_SLOT_ID);
}
