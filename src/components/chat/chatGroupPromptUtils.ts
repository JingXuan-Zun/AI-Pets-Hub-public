import { PRIMARY_DESKTOP_PET_SLOT_ID, type DesktopPetSlot } from '../../multiPetRoster';
import type { ChatMessage, DesktopPetChatMode } from '../../types';
import { type GroupChatInteractionPlan } from './chatGroupInteractionPlanner';
import { buildConversationTurnPromptLines } from './group/orchestration/conversationTurnPlan';
import { buildGroupInteractionPromptLines } from './group/orchestration/groupInteractionPromptLines';
import { type GroupTurnContext } from './chatGroupTurnContext';
import { buildGroupMemorySnapshotPromptLines } from './group/memory/groupRoleRuntimeSnapshot';
import { buildGroupTopicSignalPromptLines } from './group/role/groupTopicSignalProtocol';
import { buildGroupRelationshipSignalPromptLines } from './group/relationship/groupRelationshipSignalProtocol';
import { buildGroupContributionSignalPromptLines } from './group/role/groupContributionSignalProtocol';
import { isChatMessageInMode } from './chatMessageScopeUtils';

const SCENE_CONTINUITY_MESSAGE_LIMIT = 8;

function findLatestOtherPetMessage(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return [...messages]
    .reverse()
    .find((message) => (
      isChatMessageInMode(message, 'group')
      && message.role === 'model'
      && (message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID) !== targetSlot.id
    ));
}

function findLatestUserMessage(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => isChatMessageInMode(message, 'group') && message.role === 'user');
}

function findRecentSelfPetMessages(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return messages
    .filter((message) => (
      isChatMessageInMode(message, 'group')
      && message.role === 'model'
      && (message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID) === targetSlot.id
      && message.text.trim()
    ))
    .slice(-2);
}

function formatTargetNames(names: string[]) {
  return names.filter(Boolean).join('、');
}

function buildRecentGroupSceneSummary(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return messages
    .filter((message) => isChatMessageInMode(message, 'group') && message.text.trim())
    .slice(-SCENE_CONTINUITY_MESSAGE_LIMIT)
    .map((message) => {
      if (message.role === 'user') {
        return `用户：${message.text.trim()}`;
      }

      const messagePetId = message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
      const petName = message.petName?.trim() || (
        messagePetId === targetSlot.id ? targetSlot.personality.name : '其他桌宠'
      );
      const selfMarker = messagePetId === targetSlot.id ? '（你）' : '';
      return `${petName}${selfMarker}：${message.text.trim()}`;
    })
    .join('\n');
}

function buildSceneContinuityPromptLines(
  messages: ChatMessage[],
  targetSlot: DesktopPetSlot,
  groupTurnContext?: GroupTurnContext,
) {
  const sceneSummary = groupTurnContext?.sceneStateSummary || buildRecentGroupSceneSummary(messages, targetSlot);
  const baseLines = [
    '现场连续性规则：前文已经出现的位置、距离、姿势、动作、表情、情绪、人物关系和群体状态，都是当前群聊现场的一部分。',
    '不要无解释地把最近明确的现场事实改成相反内容；例如已经在身边/围在一起，就不要突然写成离得很远，除非本轮明确发生了移动或变化。',
  ];

  if (!sceneSummary) {
    return baseLines;
  }

  return [
    ...baseLines,
    `最近现场参考（只用于保持状态连续，不要求延续旧话题）：\n${sceneSummary}`,
  ];
}

function buildRecentGroupMessageSummary(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return messages
    .filter((message) => (
      isChatMessageInMode(message, 'group')
      && message.role === 'model'
      && (message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID) !== targetSlot.id
      && message.text.trim()
    ))
    .slice(-3)
    .map((message) => {
      const petName = message.petName?.trim() || '其他桌宠';
      return `${petName}：${message.text.trim()}`;
    })
    .join('\n');
}

function buildUserAddressedExchangeSummary(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  return messages
    .filter((message) => (
      isChatMessageInMode(message, 'group')
      && (
        message.role === 'user'
        || (
          message.role === 'model'
          && (message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID) !== targetSlot.id
          && message.text.trim()
        )
      )
    ))
    .slice(-4)
    .map((message) => {
      if (message.role === 'user') {
        return `用户：${message.text.trim()}`;
      }

      const petName = message.petName?.trim() || '其他桌宠';
      return `${petName}：${message.text.trim()}`;
    })
    .join('\n');
}

function buildAntiRepetitionPromptLines(messages: ChatMessage[], targetSlot: DesktopPetSlot) {
  const recentSummary = buildRecentGroupMessageSummary(messages, targetSlot);
  const baseLines = [
    '避免半重复：不要复写最近几句已经出现过的动作、称呼组合、句式开头或情绪表达。',
    '必须给出一个新的反应点、补充信息、追问或转折，让话题往前走一点。',
  ];

  if (!recentSummary) {
    return baseLines;
  }

  return [
    ...baseLines,
    `最近几句参考如下，只用来避重复，不要照抄：\n${recentSummary}`,
  ];
}

function buildSelfContinuityPromptLines(
  messages: ChatMessage[],
  targetSlot: DesktopPetSlot,
  groupTurnContext?: GroupTurnContext,
) {
  const memoryLines = buildGroupMemorySnapshotPromptLines(
    groupTurnContext?.roleRuntimeSnapshot,
  );
  if (groupTurnContext?.selfStateSummary) {
    return [
      ...memoryLines,
      `你自己最近的发言/动作如下，本轮必须把它们当成你的连续状态：\n${groupTurnContext.selfStateSummary}`,
      '不要突然重置自己的姿势、动作、情绪、称呼、承诺或事实立场；如果确实要变化，请在回复里自然过渡。',
      '可以换一个新反应点，但不能否认、忘记或无解释地改写你自己上一句已经说过/做过的内容。',
    ];
  }

  const selfMessages = findRecentSelfPetMessages(messages, targetSlot);
  if (selfMessages.length === 0) {
    return [
      ...memoryLines,
      '如果你之前已经在群里发过言，本轮要自然承接自己的动作、情绪、称呼、立场和已经说过的事实。',
    ];
  }

  const selfSummary = selfMessages
    .map((message, index) => {
      const label = index === selfMessages.length - 1 ? '上一句' : '更早一句';
      return `${label}：${message.text.trim()}`;
    })
    .join('\n');

  return [
    ...memoryLines,
    `你自己最近的发言/动作如下，本轮必须把它们当成你的连续状态：\n${selfSummary}`,
    '不要突然重置自己的姿势、动作、情绪、称呼、承诺或事实立场；如果确实要变化，请在回复里自然过渡。',
    '可以换一个新反应点，但不能否认、忘记或无解释地改写你自己上一句已经说过/做过的内容。',
  ];
}

export function buildChatUserPrompt(
  userInput: string,
  chatMode: DesktopPetChatMode,
  targetSlot: DesktopPetSlot,
  participantNames: string[],
  messages: ChatMessage[] = [],
  groupInteractionPlan?: GroupChatInteractionPlan,
  groupTurnContext?: GroupTurnContext,
) {
  if (chatMode !== 'group') {
    return userInput;
  }

  const turnUserInput = groupTurnContext?.currentUserInput || userInput;
  const turnParticipantNames = groupTurnContext?.participantNames ?? participantNames;
  const speakerPetName = groupTurnContext?.speakerPetName ?? targetSlot.personality.name;

  if (groupInteractionPlan?.userAddressedPetId) {
    return [
      `这是桌宠群聊，参与角色：${turnParticipantNames.join('、')}。`,
      `你是「${speakerPetName}」，用户这一轮明确点名了你。`,
      ...buildSelfContinuityPromptLines(messages, targetSlot, groupTurnContext),
      ...buildSceneContinuityPromptLines(messages, targetSlot, groupTurnContext),
      ...buildConversationTurnPromptLines(groupInteractionPlan.conversationTurnPlan),
      ...buildGroupInteractionPromptLines(groupInteractionPlan),
      '上面的现场参考只用来保持位置、动作、关系和气氛连续；不要拿旧话题、旧结论或旧角色发言来抢占本轮回答。',
      '只根据本轮用户消息直接回复用户；回复保持简短自然，只说你自己的这一句。',
      `本轮用户消息：${turnUserInput}`,
      ...buildGroupTopicSignalPromptLines(),
      ...buildGroupRelationshipSignalPromptLines(),
    ].join('\n');
  }

  const latestOtherPetMessage = findLatestOtherPetMessage(messages, targetSlot);
  const latestSpeakerName = groupTurnContext?.latestOtherPetName
    || latestOtherPetMessage?.petName?.trim()
    || '其他桌宠';
  const latestSpeakerText = groupTurnContext?.latestOtherPetText
    || latestOtherPetMessage?.text?.trim()
    || '';
  const addressedExchangeSummary = groupInteractionPlan?.followsUserAddressedExchange
    ? (groupTurnContext?.addressedExchangeSummary || buildUserAddressedExchangeSummary(messages, targetSlot))
    : '';

  return [
    `这是桌宠群聊，参与角色：${turnParticipantNames.join('、')}。`,
    `你是「${speakerPetName}」，现在轮到你在群里接话。`,
    ...buildSelfContinuityPromptLines(messages, targetSlot, groupTurnContext),
    ...buildSceneContinuityPromptLines(messages, targetSlot, groupTurnContext),
    addressedExchangeSummary
      ? `用户与被点名角色刚刚的新对话：\n${addressedExchangeSummary}`
      : latestSpeakerText
      ? `群里上一句是 ${latestSpeakerName}：${latestSpeakerText}`
      : '你是这一轮较早接话的角色，可以先回应用户，再给其他桌宠留下继续接话的空间。',
    ...buildConversationTurnPromptLines(groupInteractionPlan?.conversationTurnPlan),
    ...buildGroupInteractionPromptLines(groupInteractionPlan),
    ...(groupInteractionPlan?.followsUserAddressedExchange ? [] : buildAntiRepetitionPromptLines(messages, targetSlot)),
    '只说你自己的这一句。不要代替其他角色发言，不要写旁白，不要总结全场。',
    '回复保持简短自然，像群里实时互相聊天。不要每次都以用户为唯一对象。',
    `本轮用户消息：${turnUserInput}`,
    ...buildGroupTopicSignalPromptLines(),
    ...buildGroupRelationshipSignalPromptLines(),
    ...buildGroupContributionSignalPromptLines(),
  ].join('\n');
}

export function buildAutonomousGroupChatPrompt(
  targetSlot: DesktopPetSlot,
  participantNames: string[],
  messages: ChatMessage[] = [],
  groupInteractionPlan?: GroupChatInteractionPlan,
  groupTurnContext?: GroupTurnContext,
) {
  const latestOtherPetMessage = findLatestOtherPetMessage(messages, targetSlot);
  const latestUserMessage = findLatestUserMessage(messages);
  const latestSpeakerName = groupTurnContext?.latestOtherPetName
    || latestOtherPetMessage?.petName?.trim()
    || '其他桌宠';
  const latestSpeakerText = groupTurnContext?.latestOtherPetText
    || latestOtherPetMessage?.text?.trim()
    || '';
  const latestUserText = groupTurnContext?.latestUserText || latestUserMessage?.text?.trim() || '';
  const turnParticipantNames = groupTurnContext?.participantNames ?? participantNames;
  const speakerPetName = groupTurnContext?.speakerPetName ?? targetSlot.personality.name;

  return [
    `这是持续进行中的桌宠群聊，参与角色：${turnParticipantNames.join('、')}。`,
    `你是「${speakerPetName}」，现在轮到你自然接话。`,
    ...buildSelfContinuityPromptLines(messages, targetSlot, groupTurnContext),
    ...buildSceneContinuityPromptLines(messages, targetSlot, groupTurnContext),
    latestSpeakerText
      ? `群里上一句是 ${latestSpeakerName}：${latestSpeakerText}`
      : '前面已经有一些群聊内容，请顺着当前话题自然往下聊。',
    latestUserText
      ? `用户最近一次的话题是：${latestUserText}`
      : '当前这一轮没有新的用户消息。',
    ...buildConversationTurnPromptLines(groupInteractionPlan?.conversationTurnPlan),
    ...buildGroupInteractionPromptLines(groupInteractionPlan),
    ...buildAntiRepetitionPromptLines(messages, targetSlot),
    '只说你自己的这一句，保持简短自然，给下一位角色留下继续接话的空间。',
    '可以回应其他桌宠，也可以顺着当前话题继续聊，但不要代替其他角色发言，不要写旁白，不要总结全场。',
    ...buildGroupTopicSignalPromptLines(),
    ...buildGroupRelationshipSignalPromptLines(),
    ...buildGroupContributionSignalPromptLines(),
  ].join('\n');
}
