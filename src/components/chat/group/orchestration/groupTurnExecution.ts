import type { ChatMessage } from '../../../../types';
import { buildChatUserPrompt } from '../../multiPetChat';
import { createGroupTurnContext, type GroupTurnContext } from '../../chatGroupTurnContext';
import type { GroupChatInteractionPlan, GroupChatSpeakerPlan } from '../../chatGroupInteractionPlanner';
import type { RunPreparedChatSendRequestOptions } from '../../chatMessageSendFlowTypes';
import { buildStoryTurnPrompt } from '../../story/storyTurnPrompt';
import type { StorySessionState } from '../../story/storyTypes';

type PreparedRequest = RunPreparedChatSendRequestOptions['preparedRequest'];
type TargetSlot = PreparedRequest['targetSlots'][number];
type RunPetResponseTurn = RunPreparedChatSendRequestOptions['runPetResponseTurn'];

function buildTurnPrompt(options: {
  historyMessages: ChatMessage[];
  outgoingText: string;
  participantNames: string[];
  plan: GroupChatInteractionPlan;
  preparedRequest: PreparedRequest;
  storySession?: StorySessionState | null;
  targetSlot: TargetSlot;
  context: GroupTurnContext | null;
}) {
  const basePrompt = buildChatUserPrompt(
    options.outgoingText,
    options.preparedRequest.currentChatState.chatMode,
    options.targetSlot,
    options.participantNames,
    options.historyMessages,
    options.plan,
    options.context ?? undefined,
  );
  const session = options.storySession ?? options.preparedRequest.currentChatState.storySession;
  if (options.preparedRequest.currentChatState.chatMode !== 'story' || !session) return basePrompt;
  return buildStoryTurnPrompt({
    basePrompt,
    participantNames: options.participantNames,
    session,
    targetName: options.targetSlot.personality.name,
  });
}

function createGroupContext(options: {
  activeRoleIds: string[];
  directedRelationshipRepository: PreparedRequest['currentConfig']['directedRelationshipRepository'];
  groupMemoryRepository: PreparedRequest['currentConfig']['groupMemoryRepository'];
  isGroupMode: boolean;
  messages: ChatMessage[];
  outgoingText: string;
  participantNames: string[];
  targetSlot: TargetSlot;
  userMessageId: string;
  plan: GroupChatSpeakerPlan;
}) {
  if (!options.isGroupMode) {
    return null;
  }

  return createGroupTurnContext({
    activeRoleIds: options.activeRoleIds,
    currentUserInput: options.outgoingText,
    directedRelationshipRepository: options.directedRelationshipRepository,
    groupMemoryRepository: options.groupMemoryRepository,
    groupInteractionPlan: options.plan,
    messages: options.messages,
    participantNames: options.participantNames,
    targetSlot: options.targetSlot,
    userMessageId: options.userMessageId,
  });
}

function createTurnOptions(options: {
  browserSearchMode?: PreparedRequest['browserSearchMode'];
  context: GroupTurnContext | null;
  historyMessages: ChatMessage[];
  messages: ChatMessage[];
  outgoingText: string;
  participantNames: string[];
  plan: GroupChatInteractionPlan;
  preparedRequest: PreparedRequest;
  shouldAutoSpeakReply: boolean;
  storySession?: StorySessionState | null;
  targetSlot: TargetSlot;
}) {
  const { preparedRequest } = options;
  return {
    chatMode: preparedRequest.currentChatState.chatMode,
    historyMessages: options.context?.historyMessages ?? options.historyMessages,
    participantNames: options.participantNames,
    promptText: buildTurnPrompt({
      context: options.context,
      historyMessages: preparedRequest.isGroupMode ? options.messages : options.historyMessages,
      outgoingText: options.outgoingText,
      participantNames: options.participantNames,
      plan: options.plan,
      preparedRequest,
      storySession: options.storySession,
      targetSlot: options.targetSlot,
    }),
    shouldAutoSpeakReply: options.shouldAutoSpeakReply,
    playbackToken: preparedRequest.playbackToken,
    requestToken: preparedRequest.requestToken,
    browserSearchMode: options.browserSearchMode,
    userAttachments: preparedRequest.userMessage.attachments ?? [],
    userAnimationIntentText: options.outgoingText,
    groupInteractionPlan: options.plan,
  };
}

export async function executeGroupTurn(options: {
  browserSearchMode?: PreparedRequest['browserSearchMode'];
  historyMessages: ChatMessage[];
  messages: ChatMessage[];
  outgoingText: string;
  participantNames: string[];
  plan: GroupChatSpeakerPlan;
  preparedRequest: PreparedRequest;
  runPetResponseTurn: RunPetResponseTurn;
  shouldAutoSpeakReply: boolean;
  storySession?: StorySessionState | null;
}) {
  const context = createGroupContext({
    activeRoleIds: options.preparedRequest.targetSlots.map((slot) => slot.id),
    directedRelationshipRepository: options.preparedRequest.currentConfig.directedRelationshipRepository,
    groupMemoryRepository: options.preparedRequest.currentConfig.groupMemoryRepository,
    isGroupMode: options.preparedRequest.isGroupMode,
    messages: options.messages,
    outgoingText: options.outgoingText,
    participantNames: options.participantNames,
    targetSlot: options.plan.targetSlot,
    userMessageId: options.preparedRequest.userMessage.id,
    plan: options.plan,
  });
  const turnOptions = createTurnOptions({
    browserSearchMode: options.browserSearchMode,
    context,
    historyMessages: context?.historyMessages ?? options.historyMessages,
    messages: options.messages,
    outgoingText: options.outgoingText,
    participantNames: options.participantNames,
    plan: options.plan,
    preparedRequest: options.preparedRequest,
    shouldAutoSpeakReply: options.shouldAutoSpeakReply,
    storySession: options.storySession,
    targetSlot: options.plan.targetSlot,
  });

  return options.runPetResponseTurn(options.plan.targetSlot, turnOptions);
}
