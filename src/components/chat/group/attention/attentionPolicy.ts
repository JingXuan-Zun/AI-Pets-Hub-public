import { PRIMARY_DESKTOP_PET_SLOT_ID, type DesktopPetSlot } from '../../../../multiPetRoster';
import type { ChatMessage } from '../../../../types';
import { isChatMessageInMode } from '../../chatMessageScopeUtils';
import { resolveGroupRoleFatiguePenalty, resolveGroupRoleTopicRelevance } from './groupAttentionRelevance';

export type GroupAttentionCandidate = {
  roleId: string;
  score: number;
  reasons: string[];
  slot: DesktopPetSlot;
};

export type GroupAttentionSelection = {
  budget: number;
  selected: GroupAttentionCandidate[];
  silentRoleIds: string[];
  usedFallback: boolean;
};

function groupModelMessages(messages: ChatMessage[]) {
  return messages.filter((message) => isChatMessageInMode(message, 'group') && message.role === 'model');
}

function petId(message: ChatMessage) {
  return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

function replyTargets(message: ChatMessage) {
  return message.replyToPetIds?.filter(Boolean)
    ?? (message.replyToPetId ? [message.replyToPetId] : []);
}

export function rankGroupAttention(options: {
  candidateSlots: DesktopPetSlot[];
  messages: ChatMessage[];
}) {
  const recent = groupModelMessages(options.messages);
  const latestSpeakerId = recent.at(-1) ? petId(recent.at(-1)!) : null;
  const pendingTargetIds = latestSpeakerId ? replyTargets(recent.at(-1)!) : [];

  return options.candidateSlots
    .map((slot, index): GroupAttentionCandidate & { index: number; slot: DesktopPetSlot } => {
      const recentMessages = recent.slice(-8);
      const messagesByRole = recentMessages.filter((message) => petId(message) === slot.id).length;
      const repliesToRole = recent.slice(-6).filter((message) => replyTargets(message).includes(slot.id)).length;
      const isPendingTarget = pendingTargetIds.includes(slot.id) && slot.id !== latestSpeakerId;
      const isLastSpeaker = slot.id === latestSpeakerId;
      const topicRelevance = resolveGroupRoleTopicRelevance(slot, options.messages);
      const fatiguePenalty = resolveGroupRoleFatiguePenalty(slot);
      const score = (isPendingTarget ? 100 : 0) + (messagesByRole === 0 ? 10 : 0)
        + topicRelevance - fatiguePenalty
        - (isLastSpeaker ? 8 : 0) - (messagesByRole * 2) - repliesToRole;
      const reasons = [
        ...(isPendingTarget ? ['pending-reply'] : []),
        ...(messagesByRole === 0 ? ['silent-role'] : []),
        ...(isLastSpeaker ? ['recent-speaker'] : []),
        ...(!isPendingTarget && !isLastSpeaker ? ['independent-perspective'] : []),
        ...(topicRelevance > 0 ? ['topic-relevance'] : []),
        ...(fatiguePenalty > 0 ? ['fatigue-penalty'] : []),
      ];
      return { roleId: slot.id, score, reasons, index, slot };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function resolveSpeakerBudget(candidateCount: number, requiredCount: number) {
  return Math.max(candidateCount, requiredCount);
}

export function selectGroupAttentionParticipants(options: {
  candidateSlots: DesktopPetSlot[];
  messages: ChatMessage[];
  requiredRoleIds?: string[];
}): GroupAttentionSelection {
  const ranked = rankGroupAttention(options);
  const requiredRoleIds = new Set(options.requiredRoleIds ?? []);
  const budget = resolveSpeakerBudget(ranked.length, requiredRoleIds.size);
  const required = ranked.filter((candidate) => requiredRoleIds.has(candidate.roleId));
  const others = ranked.filter((candidate) => !requiredRoleIds.has(candidate.roleId));
  const selected = [...required, ...others].slice(0, budget);
  const usedFallback = selected.length === 0 && ranked.length > 0;
  const finalSelection = usedFallback ? ranked.slice(0, 1) : selected;
  const selectedRoleIds = new Set(finalSelection.map((candidate) => candidate.roleId));
  return {
    budget,
    selected: finalSelection,
    silentRoleIds: ranked
      .filter((candidate) => !selectedRoleIds.has(candidate.roleId))
      .map((candidate) => candidate.roleId),
    usedFallback,
  };
}
