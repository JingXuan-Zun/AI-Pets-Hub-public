import { buildVisibleCharacterReplyText } from '../components/chat/characterToolProtocol';
import { getPetResponseStrict } from '../services/geminiService';
import type { ChatMessage, ChatMessageImageAttachment, PetPersonality, PetConfig } from '../types';

// A family member's own conversation with the character on WeChat (everyone but the owner):
// kept apart from the chat window and from each other, plain conversation without tools, so
// nobody but the owner can have her operate the computer. Each person's recent lines are kept
// on this computer so she remembers what they talked about.

const STORAGE_KEY = 'desktop-pet.weixin-family-chats.v1';
const MAX_KEPT_MESSAGES = 40;

type FamilyChats = Record<string, ChatMessage[]>;

function readChats(): FamilyChats {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as FamilyChats : {};
  } catch {
    return {};
  }
}

function writeChats(chats: FamilyChats) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {}
}

export function readFamilyChat(accountId: string) {
  const messages = readChats()[accountId];
  return Array.isArray(messages) ? messages : [];
}

/** Forgets one person's conversation (when their login is removed). */
export function clearFamilyChat(accountId: string) {
  const chats = readChats();
  delete chats[accountId];
  writeChats(chats);
}

/** What she is told about who is speaking; how she treats family is up to her persona. */
export function buildFamilyTurnInput(label: string, text: string) {
  const note = `（这条是「${label}」在微信上发给你的。${label}是主人的家人，不是主人本人。）`;
  return text ? `${note}\n${text}` : `${note}\n（发来了图片）`;
}

/** One turn: her reply (visible text, no tool markup), and both lines added to that person's history. */
export async function replyToFamilyMember({ accountId, attachments, config, label, petId, personality, text }: {
  accountId: string;
  attachments: ChatMessageImageAttachment[];
  config: PetConfig;
  label: string;
  petId: string;
  personality: PetPersonality;
  text: string;
}) {
  const history = readFamilyChat(accountId);
  const input = buildFamilyTurnInput(label, text);
  const raw = await getPetResponseStrict(history, input, personality, config.settings, 'allow', attachments);
  const reply = buildVisibleCharacterReplyText(raw, personality.systemInstruction).trim();
  if (!reply) return '';
  const now = Date.now();
  const turn: ChatMessage[] = [
    { createdAt: now, id: `weixin-${now}-u`, role: 'user', text: input },
    { createdAt: now, id: `weixin-${now}-m`, petId, petName: personality.name, role: 'model', text: reply },
  ];
  const next = [...history, ...turn].slice(-MAX_KEPT_MESSAGES);
  writeChats({ ...readChats(), [accountId]: next });
  return reply;
}
