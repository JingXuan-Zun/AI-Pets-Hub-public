import type { ChatMessage } from '../../types';
import {
  createGroupChatSpeakerPlan,
  createSingleRoundGroupChatSpeakerQueue,
  markGroupChatSpeakerPlanUserTopicPriority,
  type GroupChatSpeakerPlan,
} from './chatGroupInteractionPlanner';
import {
  createUserAddressedFollowupGroupInteractionPlan,
  createUserAddressedGroupInteractionPlan,
} from './chatGroupUserAddressing';
import type { RunPreparedChatSendRequestOptions } from './chatMessageSendFlowTypes';
import type { GroupTopicStatus } from './group/topic/topicLifecycle';

type ChatTargetSlots = RunPreparedChatSendRequestOptions['preparedRequest']['targetSlots'];

export type SingleRoundSpeakerPlanOptions = {
  addressedTargetSlots?: ChatTargetSlots;
  messages: ChatMessage[];
  speakerTargetSlots: ChatTargetSlots;
  spokenPetIds: Set<string>;
  targetSlots: ChatTargetSlots;
  topicStatus?: GroupTopicStatus | null;
  userTopicPriority?: boolean;
};

function createAddressedSpeakerPlan(
  options: SingleRoundSpeakerPlanOptions,
): GroupChatSpeakerPlan | null {
  const addressedTargetSlots = options.addressedTargetSlots ?? [];
  const targetSlot = addressedTargetSlots.find((slot) => !options.spokenPetIds.has(slot.id));
  if (!targetSlot) return null;
  return createGroupChatSpeakerPlan({
    interactionPlan: createUserAddressedGroupInteractionPlan(targetSlot, addressedTargetSlots),
    targetSlot,
    topicStatus: options.topicStatus,
  });
}

function addAddressedFollowup(
  fallbackPlan: GroupChatSpeakerPlan,
  options: SingleRoundSpeakerPlanOptions,
) {
  const addressedTargetSlots = options.addressedTargetSlots ?? [];
  if (addressedTargetSlots.length === 0) return fallbackPlan;
  return createGroupChatSpeakerPlan({
    attentionReasons: fallbackPlan.conversationTurnPlan.attentionReasons,
    attentionScore: fallbackPlan.conversationTurnPlan.attentionScore,
    interactionPlan: createUserAddressedFollowupGroupInteractionPlan(
      fallbackPlan,
      addressedTargetSlots,
    ),
    targetSlot: fallbackPlan.targetSlot,
    topicStatus: options.topicStatus,
    usedAttentionFallback: fallbackPlan.conversationTurnPlan.usedAttentionFallback,
  });
}

export function createSingleRoundGroupSpeakerPlan(
  options: SingleRoundSpeakerPlanOptions,
): GroupChatSpeakerPlan | undefined {
  const addressedPlan = createAddressedSpeakerPlan(options);
  if (addressedPlan) return addressedPlan;
  const fallbackPlan = createSingleRoundGroupChatSpeakerQueue({
    candidateTargetSlots: options.speakerTargetSlots,
    messages: options.messages,
    spokenPetIds: options.spokenPetIds,
    targetSlots: options.targetSlots,
    topicStatus: options.topicStatus,
  })[0];
  if (!fallbackPlan) return undefined;
  const prioritizedPlan = options.userTopicPriority
    ? markGroupChatSpeakerPlanUserTopicPriority(fallbackPlan)
    : fallbackPlan;
  return addAddressedFollowup(prioritizedPlan, options);
}
