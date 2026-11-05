import { desktopPetChatStore } from '../../chatStore';
import { createChatMessageId } from '../../components/chat/multiPetChat';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { speakCompanionLine } from '../../life-companion/companionLineSpeech';
import { getDesktopPetSlot } from '../../multiPetRoster';
import type { DesktopPetChatMode, PetConfig } from '../../types';

// When a background job ends (a drawing is ready, or it failed) the character who started it
// says so in her own words, like a reminder that comes due: bubble, voice and a chat line.
// The chat line also reaches QQ / WeChat when the user is talking from the phone.

const LINE_TIMEOUT_MS = 15_000;
/** If she is in the middle of saying something, wait for that first, at most this long. */
const MAX_WAIT_FOR_IDLE_MS = 60_000;

async function waitUntilQuiet() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_FOR_IDLE_MS) {
    const chat = desktopPetChatStore.getState();
    if (!chat.isTyping && !chat.isSpeaking) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function composeLine(config: PetConfig, petId: string, title: string, outcome: { ok: boolean; text: string }) {
  const personality = getDesktopPetSlot(config, petId)?.personality ?? config.personality;
  const prompt = [
    '这是你自己要主动对用户说的话，不是用户发来的消息。',
    `刚才你在后台做的事：${title}`,
    `结果：${outcome.text}`,
    outcome.ok
      ? '用你平时的语气，一两句话告诉用户做好了（是图就让用户看看）。'
      : '用你平时的语气，一两句话告诉用户结果：结果里写了接下来要用户做什么，就照着请用户去做；否则说没做成的原因，问要不要再试。',
    '不要提到系统、工具、后台任务这些词。',
  ].join('\n');
  try {
    const { getPetResponseStrict } = await import('../../services/geminiService');
    const response = await getPetResponseStrict([], prompt, personality, { ...config.settings, webSearchEnabled: false }, 'block', [], AbortSignal.timeout(LINE_TIMEOUT_MS));
    return response.trim();
  } catch (error) {
    pushFrontendRuntimeLog('后台任务', '用角色口吻说结果失败，改用固定句子', { error: error instanceof Error ? error.message : String(error) });
    return '';
  }
}

export async function announceBackgroundOutcome(options: {
  chatMode: DesktopPetChatMode;
  config: PetConfig;
  outcome: { ok: boolean; text: string };
  petId: string;
  petName: string;
  title: string;
}) {
  const { chatMode, config, outcome, petId, petName, title } = options;
  const line = (await composeLine(config, petId, title, outcome)) || (outcome.ok ? '好了，你看看～' : `没做成：${outcome.text}`);
  await waitUntilQuiet();
  desktopPetChatStore.addMessage({
    chatMode,
    createdAt: Date.now(),
    id: createChatMessageId(`background-${petId}`),
    petId,
    petName,
    role: 'model',
    text: line,
  });
  speakCompanionLine(line, petId);
  pushFrontendRuntimeLog('后台任务', `${petName} 说了后台任务的结果`, { ok: outcome.ok, title });
}
