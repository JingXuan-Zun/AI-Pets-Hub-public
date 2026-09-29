import {
  resolveAgentCharacterAnimationIntent,
  resolveAgentChatEntryRoute,
  resolveAgentProductionSessionInstruction,
  shouldUseAgentChatEntryRouter,
} from '../../agent';
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
  runPreparedAgentProductionSession,
} from './agentRunController';
import { resolveRoutedGroupTask } from './group/task/groupTaskRouting';
import { applyGroupTaskRuntimeResult } from './group/task/groupTaskRuntimeResult';
import {
  createGroupTaskLifecycleCallbacks,
  continueActiveGroupTaskConversation,
  startPreparedGroupTaskRuntime,
} from './group/task/groupTaskSenderLifecycle';
import type { UsePetChatMessageSenderOptions } from './petChatMessageSenderTypes';
import { getChatTargetOptions } from './multiPetChat';
import { normalizeStoryDefinition } from './story/storyDraftNormalization';
import {
  resolveStoryDefinitionForSend,
  shouldRestoreStorySession,
} from './story/storySessionRecovery';
import { runGroupTaskCollaborationPreflight } from './group/task/groupTaskCollaborationExecution';

export type PetChatMessageSenderContext = UsePetChatMessageSenderOptions & {
  groupTaskLifecycle: ReturnType<typeof createGroupTaskLifecycleCallbacks>;
};

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
  const message = decision ? findLatestPendingAgentApprovalMessage(state.messages, {
    activePetId: state.activePetId,
    chatMode: state.chatMode,
  }) : null;
  if (!decision || !message?.id) {
    return false;
  }
  resetVoiceInputSession(context.voiceInputSessionRef, context.voiceTranscriptRef);
  desktopPetChatStore.setInputValue('');
  desktopPetChatStore.setStatusMessage('');
  pushFrontendRuntimeLog('agent-run', 'text approval resolved pending request', {
    decision,
    messageId: message.id,
    textLength: input.outgoingText.length,
  });
  await resolveAgentApprovalRequest({ ...context, decision, messageId: message.id });
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

function resolveInitialAgentInstruction(input: SendInput) {
  if (input.hasImageAttachments) return '';
  if (input.followUpAction?.kind === 'run-command') {
    const command = input.followUpAction.command;
    return command.toolCall?.goal
      || command.instruction
      || command.sourceText
      || input.outgoingText
      || input.followUpAction.label;
  }
  if (input.options?.agentMode) return input.outgoingText;
  return resolveAgentProductionSessionInstruction(input.outgoingText);
}

function resolveAnimationAgentInstruction(input: SendInput, instruction: string) {
  if (instruction || input.hasImageAttachments) return instruction;
  const animationIntent = resolveAgentCharacterAnimationIntent(input.outgoingText);
  if (!animationIntent) return '';
  pushFrontendRuntimeLog('agent-entry-router', 'route=agent deterministic-character-skill', {
    animationId: animationIntent.animationId,
    reason: animationIntent.reason,
    textLength: input.outgoingText.length,
  });
  return input.outgoingText;
}

async function resolveRoutedAgentInstruction(
  context: PetChatMessageSenderContext,
  input: SendInput,
  preparedRequest: PreparedChatSendRequest,
  instruction: string,
) {
  if (instruction || input.hasImageAttachments) return instruction;

  if (!shouldUseAgentChatEntryRouter({
    historyMessages: preparedRequest.promptHistoryMessages,
    sourceText: input.outgoingText,
  })) {
    pushFrontendRuntimeLog('agent-entry-router', 'skipped for plain chat', {
      textLength: input.outgoingText.length,
    });
    return '';
  }
  try {
    const decision = await resolveAgentChatEntryRoute({
      historyMessages: preparedRequest.promptHistoryMessages,
      settings: preparedRequest.currentConfig.settings,
      sourceText: input.outgoingText,
    });
    pushFrontendRuntimeLog('agent-entry-router', `route=${decision.mode}`, {
      confidence: decision.confidence ?? null,
      reason: decision.reason,
      rewrittenGoal: decision.rewrittenGoal ?? null,
      textLength: input.outgoingText.length,
    });
    if (decision.mode !== 'agent') return '';
    routePreparedGroupTask(context, input, preparedRequest, decision);
    return decision.rewrittenGoal || input.outgoingText;
  } catch (error) {
    pushFrontendRuntimeLog('agent-entry-router', 'router failed; falling back to normal chat', {
      error: error instanceof Error ? error.message : String(error),
      textLength: input.outgoingText.length,
    });
    return '';
  }
}

function routePreparedGroupTask(
  context: PetChatMessageSenderContext,
  input: SendInput,
  preparedRequest: PreparedChatSendRequest,
  decision: Awaited<ReturnType<typeof resolveAgentChatEntryRoute>>,
) {
  if (!preparedRequest.isGroupMode) return;
  preparedRequest.groupTaskCandidate = resolveRoutedGroupTask({
    decision,
    groupSessionId: `group-${preparedRequest.requestToken}`,
    sourceText: input.outgoingText,
    targetSlots: preparedRequest.targetSlots,
    topicId: preparedRequest.userMessage.id,
  }) ?? undefined;
  startPreparedGroupTaskRuntime(context.activeGroupRuntimeRef, preparedRequest);
}

async function executePreparedAgentSession(
  context: PetChatMessageSenderContext,
  input: SendInput,
  preparedRequest: PreparedChatSendRequest,
  instruction: string,
) {
  const collaborationReady = await runGroupTaskCollaborationPreflight({
    request: preparedRequest,
    runPetResponseTurn: context.runPetResponseTurn,
  });
  if (!collaborationReady) return;
  await runPreparedAgentProductionSession({
    ...context,
    instruction,
    onRuntimeResult: preparedRequest.groupTaskCandidate
      ? ({ implementation, result }) => applyGroupTaskRuntimeResult({
          implementation,
          preparedRequest,
          result,
        })
      : undefined,
    preparedRequest,
  });
  await continueActiveGroupTaskConversation(context, preparedRequest);
}

async function executePreparedRequest(
  context: PetChatMessageSenderContext,
  input: SendInput,
  preparedRequest: PreparedChatSendRequest,
) {
  if (preparedRequest.currentChatState.chatMode === 'story') {
    await runPreparedChatSendRequest({ ...context, preparedRequest });
    return;
  }
  const initialInstruction = resolveAnimationAgentInstruction(
    input,
    resolveInitialAgentInstruction(input),
  );
  const instruction = await resolveRoutedAgentInstruction(
    context,
    input,
    preparedRequest,
    initialInstruction,
  );
  if (instruction) {
    await executePreparedAgentSession(context, input, preparedRequest, instruction);
    return;
  }
  await runPreparedChatSendRequest({ ...context, preparedRequest });
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
    await executePreparedRequest(context, input, preparedRequest);
  } finally {
    finalizeChatSendRequest(
      preparedRequest.requestToken,
      context.activeChatRequestTokenRef,
      context.groupChatContinuationEnabledRef,
    );
  }
}
