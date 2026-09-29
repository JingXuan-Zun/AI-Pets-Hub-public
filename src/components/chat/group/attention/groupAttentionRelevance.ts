import type { DesktopPetSlot } from '../../../../multiPetRoster';
import type { ChatMessage } from '../../../../types';

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').trim();
}

function units(value: string) {
  const text = normalize(value).slice(0, 1200);
  if (!text) return [];
  const words = text.match(/[a-z0-9]{2,}/giu) ?? [];
  const characters = Array.from(text.replace(/\s+/gu, '')).filter((item) => /[^a-z0-9]/iu.test(item));
  return [...new Set([...words, ...characters])];
}

function latestTopicText(messages: ChatMessage[]) {
  const latestUser = [...messages].reverse().find((message) => (
    message.role === 'user' && message.chatMode === 'group'
  ));
  return latestUser?.text ?? messages.at(-1)?.text ?? '';
}

export function resolveGroupRoleTopicRelevance(slot: DesktopPetSlot, messages: ChatMessage[]) {
  const topicUnits = new Set(units(latestTopicText(messages)));
  if (!topicUnits.size) return 0;
  const roleText = [
    slot.personality.name,
    slot.personality.traits?.join(' ') ?? '',
    slot.personality.knowledgeBase ?? '',
  ].join(' ');
  const roleUnits = new Set(units(roleText));
  const matches = [...topicUnits].filter((unit) => roleUnits.has(unit)).length;
  return Math.min(20, Math.round((matches / topicUnits.size) * 40));
}

export function resolveGroupRoleFatiguePenalty(slot: DesktopPetSlot) {
  const fatigue = slot.stats?.fatigue ?? 0;
  if (slot.currentAction === 'SLEEPING' || fatigue >= 85) return 15;
  if (fatigue >= 65) return 8;
  return 0;
}
