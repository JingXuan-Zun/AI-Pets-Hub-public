import { desktopPetChatStore } from '../chatStore';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakCompanionLine } from '../life-companion/companionLineSpeech';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../multiPetRoster';
import type { PetConfig, PetConfigUpdateHandler } from '../types';
import {
  checkDeepSeekKey,
  findApiKeyInText,
  isChatModelConfigured,
  maskApiKeyInText,
  withDeepSeekSettings,
  type ApiKeyCheck,
} from './onboardingApiSetup';
import { ONBOARDING_REPLIES, WELCOME_QUICK_REPLIES, type OnboardingLineId } from './onboardingLines';
import { readOnboardingProgress, updateOnboardingProgress } from './onboardingState';
import { postGuideMessage, sayOnboardingLine, stopOnboardingVoice } from './onboardingSpeech';

// The first-run guide (docs/starter/xiaoling-onboarding-script.md). Before a chat model is set up,
// 小玲 speaks fixed lines and every chat message comes here instead of going to a model. Once a
// working key is in, she says she is awake and asks whether to introduce herself.

const NOT_READY_VOICE_LIMIT = 2;
const WELCOME_FALLBACK = '我们正式认识一下吧。要不要听我简单介绍一下我能做什么？或者你有什么想问的，直接问我就好。';

/** A key that was right but could not be used yet (no balance / no network): retried on request. */
let pendingKey: string | null = null;
let welcoming = false;
/** Bumped when the user speaks during the introduction: the rest of it is not played. */
let introRun = 0;

export function isOnboardingActive(config: PetConfig) {
  return !isChatModelConfigured(config.settings);
}

/** At launch, when nothing is set up yet: the full introduction once, a short reminder after. */
export async function startOnboardingOnLaunch(config: PetConfig) {
  if (!isOnboardingActive(config)) return;
  const progress = readOnboardingProgress();
  if (progress.introPlayedAt) {
    await sayOnboardingLine(config, 'L12');
    return;
  }
  const run = ++introRun;
  for (const id of ['L01', 'L02', 'L03'] as OnboardingLineId[]) {
    if (run !== introRun) return;
    await sayOnboardingLine(config, id);
  }
  // Only a finished introduction counts: if the window reloads halfway, it starts over.
  updateOnboardingProgress({ introPlayedAt: Date.now() });
}

const RESULT_LINES: Record<Exclude<ApiKeyCheck, 'ok'>, OnboardingLineId> = {
  invalid: 'L07',
  'no-balance': 'L08',
  network: 'L09',
  other: 'L09',
};

async function tryKey(options: { apiKey: string; config: PetConfig; onUpdateConfig: PetConfigUpdateHandler }) {
  await sayOnboardingLine(options.config, 'L06');
  const result = await checkDeepSeekKey(options.apiKey);
  pushFrontendRuntimeLog('新手引导', '试了一下 Key', { result });
  if (result !== 'ok') {
    pendingKey = result === 'invalid' ? null : options.apiKey;
    await sayOnboardingLine(options.config, RESULT_LINES[result]);
    return;
  }
  pendingKey = null;
  const next = { ...options.config, settings: withDeepSeekSettings(options.config.settings, options.apiKey) };
  options.onUpdateConfig(next, { persist: true });
  await welcomeAfterSetup(next);
}

function addUserMessage(text: string) {
  desktopPetChatStore.addMessage({
    chatMode: 'single',
    createdAt: Date.now(),
    id: createChatMessageId('user'),
    petId: PRIMARY_DESKTOP_PET_SLOT_ID,
    role: 'user',
    text: maskApiKeyInText(text),
  });
}

/**
 * Handles a chat message while no model is set up. Returns false when the guide is not active
 * (the message then goes the normal way).
 */
export async function handleOnboardingMessage(options: {
  config: PetConfig;
  onUpdateConfig: PetConfigUpdateHandler;
  text: string;
}) {
  const { config } = options;
  if (!isOnboardingActive(config)) return false;
  const text = options.text.trim();
  if (!text) return true;
  stopOnboardingVoice();
  introRun += 1;
  if (!readOnboardingProgress().introPlayedAt) updateOnboardingProgress({ introPlayedAt: Date.now() });
  addUserMessage(text);
  const apiKey = findApiKeyInText(text);
  if (apiKey) {
    await tryKey({ apiKey, config, onUpdateConfig: options.onUpdateConfig });
    return true;
  }
  if (text === ONBOARDING_REPLIES.howToGetKey) {
    await sayOnboardingLine(config, 'L04');
  } else if (text === ONBOARDING_REPLIES.haveKey || text === ONBOARDING_REPLIES.gotKey) {
    await sayOnboardingLine(config, 'L05');
  } else if (text === ONBOARDING_REPLIES.skip) {
    updateOnboardingProgress({ skippedAt: Date.now() });
    await sayOnboardingLine(config, 'L11');
  } else if ((text === ONBOARDING_REPLIES.retry || text === ONBOARDING_REPLIES.toppedUp) && pendingKey) {
    await tryKey({ apiKey: pendingKey, config, onUpdateConfig: options.onUpdateConfig });
  } else if (text === ONBOARDING_REPLIES.retry || text === ONBOARDING_REPLIES.toppedUp) {
    await sayOnboardingLine(config, 'L05');
  } else {
    const count = (readOnboardingProgress().notReadyReplies ?? 0) + 1;
    updateOnboardingProgress({ notReadyReplies: count });
    await sayOnboardingLine(config, 'L10', { voice: count <= NOT_READY_VOICE_LIMIT });
  }
  return true;
}

/**
 * The moment she wakes up: the fixed L20, then her own first words (by her persona) asking whether
 * to introduce herself. Only for users who came through the guide, and only once.
 */
export async function welcomeAfterSetup(config: PetConfig) {
  const progress = readOnboardingProgress();
  if (welcoming || progress.welcomedAt || !progress.introPlayedAt || isOnboardingActive(config)) return;
  welcoming = true;
  updateOnboardingProgress({ welcomedAt: Date.now() });
  try {
    await sayOnboardingLine(config, 'L20');
    let line = '';
    try {
      const { getPetResponseStrict } = await import('../services/geminiService');
      line = (await getPetResponseStrict(
        [],
        [
          '这是你自己主动对用户说的话，不是用户发来的消息。',
          '用户刚刚帮你接好了“大脑”（模型），这是你们第一次正式认识。',
          '用你自己的语气，一两句话问用户：要不要听你简单介绍一下你能做什么？或者有什么想问的，直接问你。',
          '不要提系统、设定、提示词这些词。',
        ].join('\n'),
        config.personality,
        { ...config.settings, webSearchEnabled: false },
        'block',
        [],
        AbortSignal.timeout(30_000),
      )).trim();
    } catch (error) {
      pushFrontendRuntimeLog('新手引导', '第一句自我介绍生成失败，用固定的话', { error: error instanceof Error ? error.message : String(error) });
    }
    const text = line || WELCOME_FALLBACK;
    postGuideMessage(config, text, WELCOME_QUICK_REPLIES);
    speakCompanionLine(text, PRIMARY_DESKTOP_PET_SLOT_ID);
  } finally {
    welcoming = false;
  }
}

/** The model was set up in the settings window: check it like a pasted key, then welcome. */
export async function onChatModelConfigured(config: PetConfig) {
  const progress = readOnboardingProgress();
  if (progress.welcomedAt || !progress.introPlayedAt) return;
  if (config.settings.llmProvider === 'openai' && /deepseek\.com/iu.test(config.settings.customApiUrl)) {
    await sayOnboardingLine(config, 'L06');
    const result = await checkDeepSeekKey(config.settings.customApiKey);
    if (result !== 'ok') {
      await sayOnboardingLine(config, RESULT_LINES[result]);
      return;
    }
  }
  await welcomeAfterSetup(config);
}
