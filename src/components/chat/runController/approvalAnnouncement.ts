import { delegatedScopeFields } from './chatDelegation';
import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeError } from '../../../frontendRuntimeLogger';
import { type ChatMessage, type PetConfig, type PetPersonality } from '../../../types';
import { resolvePetVoiceSettings } from '../../../voice/petVoiceSettings';
import { isVoiceOutputActive } from '../../../voice/voiceOutputActivity';
import { createChatMessageId } from '../multiPetChat';

// When a task needs the user's permission, the character asks out loud in its own voice and
// manner ("我想控制一下电脑，可以吗？"), so hands-free use hears the question; if nobody
// answers for a while it asks again in its own style and the chat window gives a shake.
// The line is generated with the character's persona; a plain sentence is the fallback.

export const APPROVAL_REMINDER_DELAY_MS = 5 * 60_000;
const WAIT_FOR_SILENCE_MS = 30_000;
const SILENCE_HOLD_MS = 800;

// Every question used to come out the same way — a long action description, the reason, and
// "回我一句同意或拒绝" at the end — because the instruction asked for exactly that and the
// model never saw what it had said before. Each question now gets a different angle and
// length, the character's recent questions to avoid repeating, and the yes/no hint only
// now and then; the persona still decides the actual words.
const ASK_ANGLES = [
  '这次就一句很短的话直接问，别铺垫。',
  '这次顺口说一下为什么需要这一步，再问。',
  '这次带点俏皮或开玩笑的语气来问。',
  '这次温柔一点、轻声地问。',
  '这次像随口商量一样问，语气自然随意。',
  '这次先说你打算怎么做，再问行不行。',
];
const REMIND_ANGLES = [
  '这次就一句短短的催促。',
  '这次带点小情绪（委屈、着急、不耐烦或撒娇，按你的性格选一种）。',
  '这次换个说法提醒，比如问用户是不是在忙。',
  '这次用你人设里最有特点的方式提醒。',
];

const BRIEF_ASKS = ['还要你点个头：{request}。', '这一步也得问问你：{request}。', '{request}，这个也行吗？', '再麻烦你一下——{request}，可以吗？', '还有一步要你同意：{request}。'];

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

export function buildAnnouncementInstruction(request: string, reminder: boolean, recentLines: string[] = [], random: () => number = Math.random) {
  const recent = recentLines.map((line) => line.replace(/\s+/gu, ' ').slice(0, 80)).filter(Boolean);
  return [
    '（系统事件，不是用户说的话）你正在帮用户做一件事，做到这一步需要用户先同意：',
    `需要同意的事：${request}`,
    reminder
      ? `你之前已经问过，用户还没回答。用你自己的性格和说话方式再提醒一次。${pick(REMIND_ANGLES, random)}`
      : `用你自己的性格和说话方式问用户能不能这样做，用大白话说清楚要做什么。${pick(ASK_ANGLES, random)}`,
    recent.length
      ? `你最近已经这样问过：\n${recent.map((line) => `- ${line}`).join('\n')}\n这次不要重复这些说法、动作描写和句式，换一种开头和表达。`
      : '',
    '一般一两句话就够，动作描写最多一小句，也可以不要。',
    random() < 0.35 ? '可以顺带说一句回“好”或“不要”就行。' : '不用特意教用户怎么回答。',
    '只输出你要说出口的话，不要解释规则，不要替用户回答。',
  ].filter(Boolean).join('\n');
}

function recentAskLines(petId: string) {
  return desktopPetChatStore.getState().messages
    .filter((message) => message.id?.startsWith(`approval-ask-${petId}`))
    .slice(-3)
    .map((message) => message.text);
}

// speakText stops whatever is playing, so the question waits for real silence instead of
// cutting the character off: waiting a fixed time, or catching the short gap between two
// streamed sentences, chopped the rest of a reply. Silence must hold for a moment; if the
// character keeps talking, the question stays on the card and in the chat, unspoken.
export async function waitForSilence() {
  const deadline = Date.now() + WAIT_FOR_SILENCE_MS;
  let quietSince: number | null = null;
  while (Date.now() < deadline) {
    const busy = desktopPetChatStore.getState().isSpeaking || isVoiceOutputActive();
    if (busy) quietSince = null;
    else quietSince ??= Date.now();
    if (quietSince !== null && Date.now() - quietSince >= SILENCE_HOLD_MS) return true;
    await new Promise((resolve) => { globalThis.setTimeout(resolve, 150); });
  }
  return false;
}

async function generateLine(request: string, reminder: boolean, personality: PetPersonality, settings: PetConfig['settings'], petId: string) {
  try {
    const { getPetResponseStrict } = await import('../../../services/geminiService');
    const text = await getPetResponseStrict(desktopPetChatStore.getState().messages.slice(-6), buildAnnouncementInstruction(request, reminder, recentAskLines(petId)), personality, settings, 'block');
    if (text.trim()) return text.trim();
  } catch (error) {
    pushFrontendRuntimeError('agent-run', 'approval announcement generation failed', error);
  }
  return reminder ? `${request}——还等着你点头呢。` : `${request}，可以吗？`;
}

export async function announceApprovalRequest(options: {
  chatMode: ChatMessage['chatMode'];
  config: PetConfig;
  isStillWaiting: () => boolean;
  /** A later question in the same task: one short spoken line, nothing added to the chat. */
  brief?: boolean;
  reminder: boolean;
  request: string;
  slot: { id: string; personality: PetPersonality };
}) {
  const { config, slot } = options;
  if (options.reminder && typeof window !== 'undefined') window.desktopPetShell?.nudgeChatWindow?.();
  // Within one task only the first question gets a full line in the character's manner; later
  // ones are a short spoken line on top of the card, or every step stacked another paragraph.
  const text = options.brief
    ? pick(BRIEF_ASKS, Math.random).replace('{request}', options.request)
    : await generateLine(options.request, options.reminder, slot.personality, config.settings, slot.id);
  if (!options.isStillWaiting()) return;
  if (!options.brief) desktopPetChatStore.addMessage({
    chatMode: options.chatMode ?? 'single',
    createdAt: Date.now(),
    id: createChatMessageId(`approval-ask-${slot.id}`),
    petId: slot.id,
    petName: slot.personality.name,
    ...delegatedScopeFields(slot.id),
    role: 'model',
    text,
  });
  // Spoken exactly when her replies are: the voice layer itself stays silent while 语音播报
  // (settings.voiceEnabled) is off, and group replies are not read out automatically.
  if (options.chatMode === 'group') return;
  if (!await waitForSilence() || !options.isStillWaiting()) return;
  try {
    const { speakText } = await import('../../../services/voiceService');
    desktopPetChatStore.setSpeaking(true);
    desktopPetChatStore.setSpeakingPetId(slot.id);
    const playback = await speakText(text, resolvePetVoiceSettings(config, slot.id));
    await playback.done;
  } catch (error) {
    pushFrontendRuntimeError('agent-run', 'approval announcement playback failed', error);
  } finally {
    desktopPetChatStore.setSpeaking(false);
    desktopPetChatStore.setSpeakingPetId(null);
  }
}
