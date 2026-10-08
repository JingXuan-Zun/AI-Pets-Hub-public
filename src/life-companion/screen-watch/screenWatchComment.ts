import { desktopPetChatStore } from '../../chatStore';
import { createChatMessageId } from '../../components/chat/multiPetChat';
import { getDesktopPetSlot } from '../../multiPetRoster';
import type { PetConfig } from '../../types';
import { speakCompanionLine } from '../companionLineSpeech';
import { resolveLifeCompanionPromptTarget } from '../lifeCompanionTextPromptPublisher';
import { LIFE_COMPANION_ACTIVITY_FALLBACK_LINES, type LifeCompanionActivity } from './lifeCompanionActivity';

const MAX_LINE_LENGTH = 240;
const SKIP_TOKEN = 'SKIP';
// Only recent chat: older screen remarks in the history made the character repeat stale topics.
const RECENT_HISTORY_MESSAGES = 6;

function cleanLine(text: string) {
  const line = text.replace(/\s+/gu, ' ').trim();
  return line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH - 1)}…` : line;
}

async function askCharacter(config: PetConfig, instruction: string) {
  const target = resolveLifeCompanionPromptTarget(config);
  const personality = getDesktopPetSlot(config, target.petId)?.personality ?? config.personality;
  // Strict: a failed request throws instead of returning "聊天请求失败…" as if the character said it.
  const { getPetResponseStrict } = await import('../../services/geminiService');
  const reply = await getPetResponseStrict(desktopPetChatStore.getState().messages.slice(-RECENT_HISTORY_MESSAGES), instruction, personality, config.settings, 'block');
  return cleanLine(reply);
}

export function buildActivityLineInstruction(activity: LifeCompanionActivity, askToWatch: boolean) {
  return [
    `你注意到用户现在好像在${activity.label}（前台窗口：${activity.title || activity.processName}）。`,
    '用你自己的语气主动搭一句话，只说一句，简短自然，不要提到系统、程序、窗口检测或规则。',
    askToWatch ? '句末顺带温柔地问一句：要不要让你看看用户在做什么，陪着一起。' : '',
  ].filter(Boolean).join('\n');
}

export function buildWatchCommentInstruction(summary: string, activity: LifeCompanionActivity | null) {
  return [
    '用户已经同意你看着屏幕陪伴。下面是你刚才看到的画面内容（来自识别，不是用户说的话）：',
    summary,
    activity ? `用户大概在${activity.label}。` : '',
    `如果有值得说的，用你自己的语气说一句简短自然的话；如果没什么好说的，只回复 ${SKIP_TOKEN}。`,
    '不要复述整段画面描述，不要提到截图、识别或系统。',
  ].filter(Boolean).join('\n');
}

/** One in-character opener about the current activity; falls back to a fixed line. */
export async function requestActivityLine(config: PetConfig, activity: LifeCompanionActivity, askToWatch: boolean) {
  const fallback = LIFE_COMPANION_ACTIVITY_FALLBACK_LINES[activity.kind]
    + (askToWatch ? '要不要让我看看你在做什么，陪着你？' : '');
  try {
    return (await askCharacter(config, buildActivityLineInstruction(activity, askToWatch))) || fallback;
  } catch {
    return fallback;
  }
}

/** A remark about what the character saw, or null when nothing is worth saying. */
export async function requestWatchComment(config: PetConfig, summary: string, activity: LifeCompanionActivity | null) {
  const reply = await askCharacter(config, buildWatchCommentInstruction(summary, activity));
  return !reply || reply.toUpperCase().includes(SKIP_TOKEN) ? null : reply;
}

/** Posts a line as the active character, unless it is mid-reply or speaking. */
export function postCompanionLine(config: PetConfig, text: string) {
  const chat = desktopPetChatStore.getState();
  if (chat.isTyping || chat.isSpeaking || chat.chatMode !== 'single') return false;
  const target = resolveLifeCompanionPromptTarget(config);
  desktopPetChatStore.addMessage({
    chatMode: 'single', id: createChatMessageId(`life-companion-${target.petId}`),
    petId: target.petId, petName: target.petName, role: 'model', text,
  });
  speakCompanionLine(text, target.petId);
  return true;
}
