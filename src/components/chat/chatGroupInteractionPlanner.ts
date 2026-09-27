import { PRIMARY_DESKTOP_PET_SLOT_ID, type DesktopPetSlot } from '../../multiPetRoster';
import { type ChatMessage } from '../../types';
import { isChatMessageInMode } from './chatMessageScopeUtils';
import { selectGroupAttentionParticipants } from './group/attention/attentionPolicy';
import {
  createConversationTurnPlan,
  type ConversationTurnIntent,
  type ConversationTurnPlan,
} from './group/orchestration/conversationTurnPlan';
import type { GroupTopicStatus } from './group/topic/topicLifecycle';

export interface GroupChatInteractionPlan {
  conversationTurnPlan?: ConversationTurnPlan;
  groupInteractionKind: 'direct' | 'bridge' | 'group';
  pullInPetId: string | null;
  pullInPetName: string | null;
  replyToPetId: string | null;
  replyToPetName: string | null;
  replyToPetIds: string[];
  replyToPetNames: string[];
  userAddressedPetId?: string | null;
  userAddressedPetName?: string | null;
  userAddressedPetIds?: string[];
  userAddressedPetNames?: string[];
  followsUserAddressedExchange?: boolean;
  userTopicPriority?: boolean;
}

export type GroupChatSpeakerPlan = GroupChatInteractionPlan & {
  conversationTurnPlan: ConversationTurnPlan;
  targetSlot: DesktopPetSlot;
};

export function createGroupChatSpeakerPlan(options: {
  attentionReasons?: string[];
  attentionScore?: number | null;
  interactionPlan: GroupChatInteractionPlan;
  intent?: ConversationTurnIntent;
  targetSlot: DesktopPetSlot;
  topicStatus?: GroupTopicStatus | null;
  usedAttentionFallback?: boolean;
}): GroupChatSpeakerPlan {
  return {
    ...options.interactionPlan,
    conversationTurnPlan: createConversationTurnPlan({
      attentionReasons: options.attentionReasons,
      attentionScore: options.attentionScore,
      interaction: options.interactionPlan,
      intent: options.intent,
      speakerId: options.targetSlot.id,
      topicStatus: options.topicStatus,
      usedAttentionFallback: options.usedAttentionFallback,
    }),
    targetSlot: options.targetSlot,
  };
}

export function markGroupChatSpeakerPlanUserTopicPriority(plan: GroupChatSpeakerPlan) {
  return createGroupChatSpeakerPlan({
    attentionReasons: [...plan.conversationTurnPlan.attentionReasons, 'user-topic-priority'],
    attentionScore: plan.conversationTurnPlan.attentionScore,
    interactionPlan: { ...plan, userTopicPriority: true },
    targetSlot: plan.targetSlot,
    topicStatus: undefined,
    usedAttentionFallback: plan.conversationTurnPlan.usedAttentionFallback,
  });
}

function resolveGroupMessagePetId(message: ChatMessage) {
  return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

function resolveMessageReplyTargetIds(message: ChatMessage) {
  const replyToPetIds = message.replyToPetIds?.filter(Boolean) ?? [];
  return replyToPetIds.length > 0
    ? replyToPetIds
    : (message.replyToPetId ? [message.replyToPetId] : []);
}

function getGroupModelMessages(messages: ChatMessage[]) {
  return messages.filter((message) => (
    isChatMessageInMode(message, 'group') && message.role === 'model'
  ));
}

function countRecentRepliesToPet(messages: ChatMessage[], petId: string, recentLimit = 6) {
  return getGroupModelMessages(messages)
    .slice(-recentLimit)
    .filter((message) => resolveMessageReplyTargetIds(message).includes(petId))
    .length;
}

function countRecentPetMessages(messages: ChatMessage[], petId: string, recentLimit = 8) {
  return getGroupModelMessages(messages)
    .slice(-recentLimit)
    .filter((message) => resolveGroupMessagePetId(message) === petId)
    .length;
}

function getLatestOtherSpeaker(
  messages: ChatMessage[],
  speakerId: string,
  targetSlots: DesktopPetSlot[],
) {
  const latestOtherMessage = [...getGroupModelMessages(messages)]
    .reverse()
    .find((message) => resolveGroupMessagePetId(message) !== speakerId);
  if (!latestOtherMessage) {
    return null;
  }

  const replyToPetId = resolveGroupMessagePetId(latestOtherMessage);
  const matchedSlot = targetSlots.find((slot) => slot.id === replyToPetId);

  return {
    replyToPetId,
    replyToPetName: latestOtherMessage.petName?.trim() || matchedSlot?.personality.name || null,
  };
}

function getLeastEngagedPet(
  messages: ChatMessage[],
  speakerId: string,
  targetSlots: DesktopPetSlot[],
) {
  const candidates = targetSlots.filter((slot) => slot.id !== speakerId);
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((leastEngaged, slot) => {
    const leastScore = countRecentPetMessages(messages, leastEngaged.id)
      + countRecentRepliesToPet(messages, leastEngaged.id);
    const slotScore = countRecentPetMessages(messages, slot.id)
      + countRecentRepliesToPet(messages, slot.id);

    return slotScore < leastScore ? slot : leastEngaged;
  }, candidates[0]);
}

function createEmptyInteractionPlan(): GroupChatInteractionPlan {
  return {
    groupInteractionKind: 'group',
    pullInPetId: null,
    pullInPetName: null,
    replyToPetId: null,
    replyToPetName: null,
    replyToPetIds: [],
    replyToPetNames: [],
  };
}

function resolveReplyTargets(options: {
  leastEngagedPet: DesktopPetSlot | null;
  latestOtherSpeaker: { replyToPetId: string; replyToPetName: string | null } | null;
  messages: ChatMessage[];
}) {
  const {
    leastEngagedPet,
    latestOtherSpeaker,
    messages,
  } = options;
  if (!latestOtherSpeaker) {
    return [];
  }

  const replyTargetIsOverused = countRecentRepliesToPet(messages, latestOtherSpeaker.replyToPetId) >= 2;
  const primaryTarget = replyTargetIsOverused && leastEngagedPet
    ? {
        id: leastEngagedPet.id,
        name: leastEngagedPet.personality.name,
      }
    : {
        id: latestOtherSpeaker.replyToPetId,
        name: latestOtherSpeaker.replyToPetName || '其他桌宠',
      };

  return [primaryTarget];
}

export function createGroupChatInteractionPlan(options: {
  messages: ChatMessage[];
  targetSlot: DesktopPetSlot;
  targetSlots: DesktopPetSlot[];
}) {
  const { messages, targetSlot, targetSlots } = options;
  if (targetSlots.length <= 1) {
    return createEmptyInteractionPlan();
  }

  const latestOtherSpeaker = getLatestOtherSpeaker(messages, targetSlot.id, targetSlots);
  const leastEngagedPet = getLeastEngagedPet(messages, targetSlot.id, targetSlots);
  const replyTargets = resolveReplyTargets({
    leastEngagedPet,
    latestOtherSpeaker,
    messages,
  });
  const firstReplyTarget = replyTargets[0] ?? null;
  const shouldTalkToWholeGroup = !firstReplyTarget
    || (
      targetSlots.length >= 3
      && getGroupModelMessages(messages).length > 0
      && getGroupModelMessages(messages).length % 5 === 0
    );
  const groupInteractionKind = shouldTalkToWholeGroup
    ? 'group'
    : (replyTargets.length > 1 ? 'bridge' : 'direct');
  const shouldPullInLeastEngaged = Boolean(
    leastEngagedPet
      && groupInteractionKind !== 'group'
      && !replyTargets.some((target) => target.id === leastEngagedPet.id)
      && countRecentPetMessages(messages, leastEngagedPet.id) === 0,
  );

  return {
    groupInteractionKind,
    pullInPetId: shouldPullInLeastEngaged ? leastEngagedPet.id : null,
    pullInPetName: shouldPullInLeastEngaged ? leastEngagedPet.personality.name : null,
    replyToPetId: groupInteractionKind === 'group' ? null : firstReplyTarget?.id ?? null,
    replyToPetName: groupInteractionKind === 'group' ? null : firstReplyTarget?.name ?? null,
    replyToPetIds: groupInteractionKind === 'group' ? [] : replyTargets.map((target) => target.id),
    replyToPetNames: groupInteractionKind === 'group' ? [] : replyTargets.map((target) => target.name),
  } satisfies GroupChatInteractionPlan;
}

export function createGroupChatSpeakerQueue(options: {
  candidateTargetSlots?: DesktopPetSlot[];
  messages: ChatMessage[];
  requiredRoleIds?: string[];
  targetSlots: DesktopPetSlot[];
  topicStatus?: GroupTopicStatus | null;
}) {
  const { candidateTargetSlots, messages, requiredRoleIds, targetSlots, topicStatus } = options;
  const speakerSlots = candidateTargetSlots ?? targetSlots;
  if (speakerSlots.length === 0) {
    return [];
  }

  if (targetSlots.length <= 1 || speakerSlots.length <= 1) {
    return speakerSlots.map((targetSlot) => createGroupChatSpeakerPlan({
      interactionPlan: createGroupChatInteractionPlan({ messages, targetSlot, targetSlots }),
      targetSlot,
      topicStatus,
    }));
  }

  const selection = selectGroupAttentionParticipants({
    candidateSlots: speakerSlots,
    messages,
    requiredRoleIds,
  });

  return selection.selected.map((candidate) => createGroupChatSpeakerPlan({
    attentionReasons: candidate.reasons,
    attentionScore: candidate.score,
    interactionPlan: createGroupChatInteractionPlan({
      messages,
      targetSlot: candidate.slot,
      targetSlots,
    }),
    targetSlot: candidate.slot,
    topicStatus,
    usedAttentionFallback: selection.usedFallback,
  }));
}

export function createSingleRoundGroupChatSpeakerQueue(options: {
  candidateTargetSlots?: DesktopPetSlot[];
  messages: ChatMessage[];
  spokenPetIds: Set<string>;
  targetSlots: DesktopPetSlot[];
  topicStatus?: GroupTopicStatus | null;
}) {
  const { candidateTargetSlots = options.targetSlots, messages, spokenPetIds, targetSlots } = options;
  return createGroupChatSpeakerQueue({
    candidateTargetSlots: candidateTargetSlots.filter(
      (targetSlot) => !spokenPetIds.has(targetSlot.id),
    ),
    messages,
    targetSlots,
    topicStatus: options.topicStatus,
  });
}

export function selectSingleRoundGroupChatParticipants(options: {
  addressedTargetSlots: DesktopPetSlot[];
  candidateTargetSlots?: DesktopPetSlot[];
  messages: ChatMessage[];
  targetSlots: DesktopPetSlot[];
}) {
  return selectGroupAttentionParticipants({
    candidateSlots: options.candidateTargetSlots ?? options.targetSlots,
    messages: options.messages,
    requiredRoleIds: options.addressedTargetSlots.map((slot) => slot.id),
  }).selected.map((candidate) => candidate.slot);
}
