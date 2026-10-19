import { desktopPetChatStore } from '../../../chatStore';
import { type ChatMessage } from '../../../types';
import { createChatMessageId } from '../multiPetChat';
import { createAgentProductionSessionDisplayPlan, createAgentProductionSessionPlaceholderCommand, resolvePreparedAgentTargetSlot } from './sessionMessageProjection';

// The approval card the conversation loop posts when a tool call needs the user's OK. It is
// answered through the shared 允许/拒绝 UI (see agentLoopApprovalRegistry).

type TargetSlot = NonNullable<ReturnType<typeof resolvePreparedAgentTargetSlot>>;

/**
 * Records the user's answer on an approval card. The card stays in the chat history the model
 * reads, so its text must say what happened; otherwise a later turn may redo the action.
 */
export function settleApprovalMessage(messageId: string, approved: boolean) {
  desktopPetChatStore.updateMessage(messageId, (message) => ({
    ...message,
    agentApproval: message.agentApproval ? { ...message.agentApproval, status: approved ? 'approved' : 'denied' } : message.agentApproval,
    text: `${message.agentApproval?.plan.goal || message.text}（${approved ? '用户已同意，已经执行' : '用户没有同意，这一步没有做'}）`,
  }));
}

export function createApprovalMessage(options: {
  chatMode: ChatMessage['chatMode'];
  instruction: string;
  request: { detail: string; title: string };
  sourceText: string;
  targetSlot: TargetSlot;
}): ChatMessage {
  const id = createChatMessageId('agent-loop-approval');
  const plan = { ...createAgentProductionSessionDisplayPlan(options.instruction, options.sourceText), goal: options.request.title, steps: [] };
  return {
    agentApproval: {
      agentRuntime: null,
      approvalSummary: { lines: options.request.detail.split('\n'), title: options.request.title },
      command: createAgentProductionSessionPlaceholderCommand(options.instruction, options.sourceText),
      corePlanSummary: null,
      groupTaskEvent: null,
      id,
      plan,
      stages: [],
      status: 'pending',
      trace: [],
    },
    chatMode: options.chatMode,
    id,
    petId: options.targetSlot.id,
    petName: options.targetSlot.personality.name,
    role: 'model',
    text: options.request.title,
  };
}
