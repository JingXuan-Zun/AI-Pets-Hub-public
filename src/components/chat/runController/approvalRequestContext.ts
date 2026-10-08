import type { ChatMessage } from '../../../types';
import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import { type PetConfig } from '../../../types';
import { desktopPetChatStore } from '../../../chatStore';
import type { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { type resolveActiveChatSlot, resolveChatTargetSlots } from '../multiPetChat';
import { type GroupTaskCandidate } from '../group/task/groupTaskBridge';

export function createAgentApprovalPreparedRequest({ currentChatState, configRef, approval, approvalMessage, approvalRuntime, targetSlot, requestToken, getPlaybackToken }: {
  currentChatState: ReturnType<typeof desktopPetChatStore.getState>;
  configRef: {
    current: PetConfig;
  };
  approval: NonNullable<ChatMessage['agentApproval']>;
  approvalMessage: ChatMessage;
  approvalRuntime: NonNullable<ReturnType<typeof resolveChatAgentRuntimeContinuation>>;
  targetSlot: ReturnType<typeof resolveActiveChatSlot>;
  requestToken: number;
  getPlaybackToken: () => number;
}): PreparedChatSendRequest {
  const chatMode = approvalMessage.chatMode ?? currentChatState.chatMode;
  const preparedRequest: PreparedChatSendRequest = {
    browserSearchMode: 'block',
    currentChatState: {
      ...currentChatState,
      chatMode,
    },
    currentConfig: configRef.current,
    groupTaskConversationEvent: approval.groupTaskEvent ?? approvalMessage.groupTaskEvent ?? undefined,
    isGroupMode: chatMode === 'group',
    outgoingText: approvalRuntime.sourceText,
    playbackToken: getPlaybackToken(),
    promptHistoryMessages: desktopPetChatStore.getState().messages,
    requestToken,
    targetSlots: chatMode === 'group'
      ? resolveChatTargetSlots(configRef.current, chatMode, currentChatState.activePetId)
      : (targetSlot ? [targetSlot] : []),
    userMessage: approvalMessage,
  };
  const taskEvent = approval.groupTaskEvent ?? approvalMessage.groupTaskEvent;
  if (taskEvent?.collaborationPlan && taskEvent.requestedCapability && taskEvent.summary) {
    preparedRequest.groupTaskCandidate = {
      taskId: taskEvent.taskId,
      groupSessionId: taskEvent.groupSessionId,
      topicId: taskEvent.topicId,
      sourceRoleIds: taskEvent.sourceRoleIds ?? [approvalMessage.petId ?? 'primary'],
      summary: taskEvent.summary,
      requestedCapability: taskEvent.requestedCapability,
      status: 'pending-arbitration',
      collaborationPlan: taskEvent.collaborationPlan,
    } satisfies GroupTaskCandidate;
  }
  return preparedRequest;
}
