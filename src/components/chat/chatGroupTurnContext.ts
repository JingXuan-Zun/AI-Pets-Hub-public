import { PRIMARY_DESKTOP_PET_SLOT_ID, type DesktopPetSlot } from '../../multiPetRoster';
import { type ChatMessage } from '../../types';
import type { GroupMemoryRepositoryData } from '../../group-memory';
import type { DirectedRelationshipRepositoryData } from '../../character-relationship';
import { type GroupChatInteractionPlan } from './chatGroupInteractionPlanner';
import { isChatMessageInMode } from './chatMessageScopeUtils';
import {
  createGroupRoleRuntimeSnapshot,
  type GroupRoleRuntimeSnapshot,
} from './group/memory/groupRoleRuntimeSnapshot';

const GROUP_TURN_SCENE_MESSAGE_LIMIT = 8;
const GROUP_TURN_SELF_MESSAGE_LIMIT = 2;
const GROUP_TURN_ADDRESSED_EXCHANGE_LIMIT = 4;

export type GroupTurnInteractionMode =
  | 'user-addressed'
  | 'user-addressed-followup'
  | 'direct'
  | 'bridge'
  | 'group';

export interface GroupTurnContext {
  addressedExchangeSummary: string;
  currentUserInput: string;
  historyMessages: ChatMessage[];
  interactionMode: GroupTurnInteractionMode;
  latestOtherPetName: string;
  latestOtherPetText: string;
  latestUserText: string;
  participantNames: string[];
  roleRuntimeSnapshot: GroupRoleRuntimeSnapshot;
  sceneStateSummary: string;
  selfStateSummary: string;
  speakerPetId: string;
  speakerPetName: string;
}

export type CreateGroupTurnContextOptions = {
  activeRoleIds?: string[];
  currentUserInput?: string;
  directedRelationshipRepository?: DirectedRelationshipRepositoryData;
  groupMemoryRepository: GroupMemoryRepositoryData;
  groupInteractionPlan?: GroupChatInteractionPlan;
  messages: ChatMessage[];
  participantNames: string[];
  targetSlot: DesktopPetSlot;
  userMessageId?: string;
};

export function resolveGroupRelationshipBehaviorTargetIds(
  activeRoleIds: string[] | undefined,
  interactionPlan: GroupChatInteractionPlan | undefined,
) {
  if (interactionPlan?.userAddressedPetId) return [];
  const directedTargets = [
    ...(interactionPlan?.replyToPetIds ?? []),
    interactionPlan?.replyToPetId,
    interactionPlan?.pullInPetId,
  ].filter((roleId): roleId is string => Boolean(roleId));
  return directedTargets.length > 0
    ? [...new Set(directedTargets)]
    : activeRoleIds?.filter(Boolean);
}

function resolveGroupMessagePetId(message: ChatMessage) {
  return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

function getGroupMessages(messages: ChatMessage[]) {
  return messages.filter((message) => (
    isChatMessageInMode(message, 'group') && message.text.trim()
  ));
}

function resolveInteractionMode(groupInteractionPlan?: GroupChatInteractionPlan): GroupTurnInteractionMode {
  if (groupInteractionPlan?.userAddressedPetId) {
    return 'user-addressed';
  }

  if (groupInteractionPlan?.followsUserAddressedExchange) {
    return 'user-addressed-followup';
  }

  return groupInteractionPlan?.groupInteractionKind ?? 'group';
}

function formatGroupSceneMessage(message: ChatMessage, targetSlot: DesktopPetSlot) {
  if (message.role === 'user') {
    return `用户：${message.text.trim()}`;
  }

  const messagePetId = resolveGroupMessagePetId(message);
  const petName = message.petName?.trim() || (
    messagePetId === targetSlot.id ? targetSlot.personality.name : '其他桌宠'
  );
  const selfMarker = messagePetId === targetSlot.id ? '（你）' : '';

  return `${petName}${selfMarker}：${message.text.trim()}`;
}

function buildSceneStateSummary(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return getGroupMessages(messages)
    .slice(-GROUP_TURN_SCENE_MESSAGE_LIMIT)
    .map((message) => formatGroupSceneMessage(message, targetSlot))
    .join('\n');
}

function buildSelfStateSummary(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  const selfMessages = getGroupMessages(messages)
    .filter((message) => (
      message.role === 'model'
      && resolveGroupMessagePetId(message) === targetSlot.id
    ))
    .slice(-GROUP_TURN_SELF_MESSAGE_LIMIT);

  return selfMessages
    .map((message, index) => {
      const label = index === selfMessages.length - 1 ? '上一句' : '更早一句';
      return `${label}：${message.text.trim()}`;
    })
    .join('\n');
}

function buildAddressedExchangeSummary(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return getGroupMessages(messages)
    .filter((message) => (
      message.role === 'user'
      || (
        message.role === 'model'
        && resolveGroupMessagePetId(message) !== targetSlot.id
      )
    ))
    .slice(-GROUP_TURN_ADDRESSED_EXCHANGE_LIMIT)
    .map((message) => {
      if (message.role === 'user') {
        return `用户：${message.text.trim()}`;
      }

      const petName = message.petName?.trim() || '其他桌宠';
      return `${petName}：${message.text.trim()}`;
    })
    .join('\n');
}

function findLatestOtherPetMessage(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return [...getGroupMessages(messages)]
    .reverse()
    .find((message) => (
      message.role === 'model'
      && resolveGroupMessagePetId(message) !== targetSlot.id
    ));
}

function findLatestUserMessage(messages: ChatMessage[]) {
  return [...getGroupMessages(messages)]
    .reverse()
    .find((message) => message.role === 'user');
}

function buildGroupTurnHistory(options: {
  interactionMode: GroupTurnInteractionMode;
  messages: ChatMessage[];
  targetPetId: string;
  userMessageId?: string;
}) {
  const {
    interactionMode,
    messages,
    targetPetId,
    userMessageId,
  } = options;

  if (!userMessageId) {
    return messages;
  }

  if (interactionMode === 'user-addressed') {
    const recentSceneMessages = messages
      .filter((message) => message.id !== userMessageId)
      .slice(-GROUP_TURN_SCENE_MESSAGE_LIMIT);
    const selfContinuityMessages = messages.filter((message) => (
      message.id !== userMessageId
      && message.role === 'model'
      && resolveGroupMessagePetId(message) === targetPetId
    )).slice(-GROUP_TURN_SELF_MESSAGE_LIMIT);
    const selectedMessages = new Set([...recentSceneMessages, ...selfContinuityMessages]);

    return messages.filter((message) => selectedMessages.has(message));
  }

  const userMessageIndex = messages.findIndex((message) => message.id === userMessageId);
  if (userMessageIndex < 0) {
    return messages.filter((message) => message.id !== userMessageId);
  }

  return messages.slice(userMessageIndex + 1);
}

export function createGroupTurnContext(options: CreateGroupTurnContextOptions) {
  const {
    currentUserInput = '',
    groupInteractionPlan,
    messages,
    participantNames,
    targetSlot,
    userMessageId,
  } = options;
  const interactionMode = resolveInteractionMode(groupInteractionPlan);
  const latestOtherPetMessage = findLatestOtherPetMessage(messages, targetSlot);
  const latestUserMessage = findLatestUserMessage(messages);

  return {
    addressedExchangeSummary: groupInteractionPlan?.followsUserAddressedExchange
      ? buildAddressedExchangeSummary(messages, targetSlot)
      : '',
    currentUserInput,
    historyMessages: buildGroupTurnHistory({
      interactionMode,
      messages,
      targetPetId: targetSlot.id,
      userMessageId,
    }),
    interactionMode,
    latestOtherPetName: latestOtherPetMessage?.petName?.trim() || '其他桌宠',
    latestOtherPetText: latestOtherPetMessage?.text.trim() || '',
    latestUserText: latestUserMessage?.text.trim() || '',
    participantNames,
    roleRuntimeSnapshot: createGroupRoleRuntimeSnapshot(targetSlot, {
      activeRoleIds: options.activeRoleIds,
      behaviorTargetRoleIds: resolveGroupRelationshipBehaviorTargetIds(
        options.activeRoleIds,
        groupInteractionPlan,
      ),
      query: [currentUserInput, latestUserMessage?.text, latestOtherPetMessage?.text]
        .filter(Boolean).join(' '),
      repository: options.groupMemoryRepository,
      relationshipRepository: options.directedRelationshipRepository,
    }),
    sceneStateSummary: buildSceneStateSummary(messages, targetSlot),
    selfStateSummary: buildSelfStateSummary(messages, targetSlot),
    speakerPetId: targetSlot.id,
    speakerPetName: targetSlot.personality.name,
  } satisfies GroupTurnContext;
}
