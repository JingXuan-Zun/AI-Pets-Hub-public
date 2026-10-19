import { createConversationChatRuntime, createConversationToolActorGate } from './runController/conversationChatRuntime';
import { beginDelegatedScope, resolveDelegatedSlotId } from './runController/chatDelegation';
import { resolveChatTargetSlots } from './chatTargetResolutionUtils';
import { latestPendingAgentLoopApprovalId } from './runController/agentLoopApprovalRegistry';
import { desktopPetChatStore } from '../../chatStore';
import type { DesktopPetChatSendOptions } from '../../chatState';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { finalizeChatSendRequest, resetVoiceInputSession, resolveChatSendPrecheck } from './chatMessageSendUtils';
import { resolveChatResetScope } from './chatSessionControlUtils';
import { prepareChatSendRequest, runPreparedChatSendRequest } from './chatMessageSendFlowUtils';
import type { PreparedChatSendRequest } from './chatMessageSendFlowTypes';
import {
  findLatestPendingAgentApprovalMessage,
  resolveAgentApprovalDecisionFromText,
  resolveAgentApprovalRequest,
} from './agentRunController';
import type { UsePetChatMessageSenderOptions } from './petChatMessageSenderTypes';
import { getChatTargetOptions } from './multiPetChat';
import { normalizeStoryDefinition } from './story/storyDraftNormalization';
import {
  resolveStoryDefinitionForSend,
  shouldRestoreStorySession,
} from './story/storySessionRecovery';

export type PetChatMessageSenderContext = UsePetChatMessageSenderOptions;

type SendInput = {
  followUpAction: DesktopPetChatSendOptions['agentFollowUpAction'];
  hasImageAttachments: boolean;
  options?: DesktopPetChatSendOptions;
  outgoingAttachments: NonNullable<DesktopPetChatSendOptions['attachments']>;
  outgoingText: string;
};

function resolveSendInput(textOverride?: string, options?: DesktopPetChatSendOptions): SendInput {
  const state = desktopPetChatStore.getState();
  const followUpAction = options?.agentFollowUpAction;
  const outgoingAttachments = Array.isArray(options?.attachments) ? options.attachments : [];
  const outgoingText = (textOverride ?? (followUpAction
    ? `继续：${followUpAction.label}`
    : state.inputValue)).trim();
  return {
    followUpAction,
    hasImageAttachments: outgoingAttachments.length > 0,
    options,
    outgoingAttachments,
    outgoingText,
  };
}

async function tryResolveTextApproval(context: PetChatMessageSenderContext, input: SendInput) {
  if (input.hasImageAttachments) {
    return false;
  }
  const state = desktopPetChatStore.getState();
  const decision = resolveAgentApprovalDecisionFromText(input.outgoingText);
  // A task card waiting on a question is answered first (its question has its own id).
  const loopApprovalId = decision ? latestPendingAgentLoopApprovalId() : null;
  const message = decision && !loopApprovalId ? findLatestPendingAgentApprovalMessage(state.messages, {
    activePetId: state.activePetId,
    chatMode: state.chatMode,
  }) : null;
  const approvalId = loopApprovalId ?? message?.id ?? null;
  if (!decision || !approvalId) {
    return false;
  }
  resetVoiceInputSession(context.voiceInputSessionRef, context.voiceTranscriptRef);
  desktopPetChatStore.setInputValue('');
  desktopPetChatStore.setStatusMessage('');
  pushFrontendRuntimeLog('agent-run', 'text approval resolved pending request', {
    decision,
    messageId: approvalId,
    textLength: input.outgoingText.length,
  });
  await resolveAgentApprovalRequest({ ...context, decision, messageId: approvalId });
  return true;
}

async function prepareSendRequest(context: PetChatMessageSenderContext, input: SendInput) {
  let currentChatState = desktopPetChatStore.getState();
  const precheck = resolveChatSendPrecheck(
    currentChatState,
    input.outgoingText,
    input.outgoingAttachments,
  );
  if (precheck.kind === 'empty') return null;
  if (precheck.kind === 'reset') {
    desktopPetChatStore.setInputValue('');
    const resetScope = resolveChatResetScope(input.outgoingText, currentChatState.chatMode);
    if (resetScope) context.resetChatSession(resetScope);
    return null;
  }
  if (precheck.kind === 'stop-group') {
    desktopPetChatStore.setInputValue('');
    context.stopGroupChat({ immediate: true, announce: true });
    return null;
  }
  if (await tryResolveTextApproval(context, input)) return null;
  const storyDefinitionSource = currentChatState.chatMode === 'story'
    ? resolveStoryDefinitionForSend(currentChatState.messages, input.options?.storyDefinition)
    : null;
  if (currentChatState.chatMode === 'story' && storyDefinitionSource && shouldRestoreStorySession(
    currentChatState.storySession,
    storyDefinitionSource,
    Boolean(input.options?.storyDefinition),
  )) {
    const definition = normalizeStoryDefinition(
      storyDefinitionSource,
      getChatTargetOptions(context.configRef.current).map((option) => ({
        id: option.id,
        name: option.name,
      })),
      storyDefinitionSource?.source ?? 'manual',
    );
    desktopPetChatStore.startStorySession(definition);
    currentChatState = desktopPetChatStore.getState();
  }
  return prepareChatSendRequest({
    ...context,
    browserSearchMode: input.options?.browserSearchMode,
    currentChatState,
    isGroupMode: precheck.isGroupMode,
    outgoingAttachments: input.outgoingAttachments,
    outgoingText: input.outgoingText,
    storyDefinition: input.options?.storyDefinition,
  });
}

/**
 * A private-chat message handed to another character ("让小玲去把文件夹挪到副屏"): that character
 * replies and does the work with its own voice, task card and questions, while everything stays
 * in the conversation the user is in. Returns false when the message is not a hand-off.
 */
async function runDelegatedRequest(context: PetChatMessageSenderContext, preparedRequest: PreparedChatSendRequest) {
  if (preparedRequest.isGroupMode || preparedRequest.currentChatState.chatMode !== 'single') return false;
  const chatting = preparedRequest.targetSlots[0];
  if (!chatting) return false;
  const others = resolveChatTargetSlots(context.configRef.current, 'group', null);
  const helperId = resolveDelegatedSlotId(preparedRequest.outgoingText, others, chatting.id);
  const helper = helperId ? others.find((slot) => slot.id === helperId) : null;
  if (!helper) return false;
  pushFrontendRuntimeLog('chat', 'message handed to another character', { from: chatting.id, to: helper.id });
  const endScope = beginDelegatedScope(helper.id, chatting.id);
  try {
    await runPreparedChatSendRequest({
      ...context,
      preparedRequest: { ...preparedRequest, targetSlots: [helper] },
      runPetResponseTurn: (targetSlot, turnOptions) => context.runPetResponseTurn(targetSlot, {
        ...turnOptions,
        conversationTools: createConversationChatRuntime({
          configRef: context.configRef, executeAgentCommand: context.onAgentChatCommand, onUpdateConfig: context.onUpdateConfig, preparedRequest, targetSlot,
        }),
      }),
    });
  } finally {
    endScope();
  }
  return true;
}

async function executePreparedRequest(
  context: PetChatMessageSenderContext,
  preparedRequest: PreparedChatSendRequest,
) {
  // Story mode keeps its own narrator and uses no tools.
  if (preparedRequest.currentChatState.chatMode === 'story') {
    await runPreparedChatSendRequest({ ...context, preparedRequest });
    return;
  }
  // "让小玲去…" in a private chat: 小玲 answers and does it, inside this conversation.
  if (await runDelegatedRequest(context, preparedRequest)) return;
  // Every other message goes through the conversation loop: the reply itself may call
  // tools. In a group only one character gets them (see createConversationToolActorGate).
  const mayUseTools = createConversationToolActorGate(preparedRequest);
  await runPreparedChatSendRequest({
    ...context,
    preparedRequest,
    runPetResponseTurn: (targetSlot, turnOptions) => (mayUseTools(targetSlot.id)
      ? context.runPetResponseTurn(targetSlot, {
        ...turnOptions,
        conversationTools: createConversationChatRuntime({
          configRef: context.configRef, executeAgentCommand: context.onAgentChatCommand, onUpdateConfig: context.onUpdateConfig, preparedRequest, targetSlot,
        }),
      })
      : context.runPetResponseTurn(targetSlot, turnOptions)),
  });
}

export async function executePetChatMessageSend(
  context: PetChatMessageSenderContext,
  textOverride?: string,
  options?: DesktopPetChatSendOptions,
) {
  const input = resolveSendInput(textOverride, options);
  const initialState = desktopPetChatStore.getState();
  const isResetCommand = /^\/reset$/iu.test(input.outgoingText.trim());
  if (
    initialState.chatMode === 'group'
    && initialState.groupChatContinuationMode === 'infinite'
    && initialState.isTyping
    && !isResetCommand
  ) {
    // Queue user interjections at the next role boundary. This keeps the
    // currently streaming character reply intact while still giving the new
    // user message priority before another autonomous turn starts.
    await new Promise<void>((resolve) => {
      const unsubscribe = desktopPetChatStore.subscribe(() => {
        if (!desktopPetChatStore.getState().isTyping) {
          unsubscribe();
          resolve();
        }
      });
    });
  }
  const preparedRequest = await prepareSendRequest(context, input);
  if (!preparedRequest) return;
  try {
    await executePreparedRequest(context, preparedRequest);
  } finally {
    finalizeChatSendRequest(
      preparedRequest.requestToken,
      context.activeChatRequestTokenRef,
      context.groupChatContinuationEnabledRef,
    );
  }
}
