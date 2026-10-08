import type { AgentChatCommand, AgentExecutionPlan } from '../../../agent';
import type { ChatMessage } from '../../../types';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import { createAgentApprovalMessage } from './approvalMessage';
import { attachAgentRunPendingApproval, attachAgentPendingApproval } from './pendingApprovalAttachment';
import { createAgentPendingApprovalVisibleText, createAgentApprovalNextStepVisibleText } from './sessionVisibleText';

interface PendingApprovalStageOptions {
  agentRuntime: NonNullable<ChatMessage['agentApproval']>['agentRuntime'];
  pendingApproval: { command: AgentChatCommand; plan: AgentExecutionPlan };
  preparedRequest: PreparedChatSendRequest;
  initial: boolean;
}

function createPendingApprovalStageMessage({ agentRuntime, pendingApproval, preparedRequest, initial }: PendingApprovalStageOptions) {
  return createAgentApprovalMessage({
    agentRuntime,
    command: pendingApproval.command,
    plan: pendingApproval.plan,
    preparedRequest,
    text: initial
      ? createAgentPendingApprovalVisibleText(pendingApproval.plan.goal)
      : createAgentApprovalNextStepVisibleText(pendingApproval.plan.goal),
  });
}

export async function presentAgentRunPendingApproval(options: PendingApprovalStageOptions & { messageId: string | null }) {
  const { messageId } = options;
  const approvalMessage = await createPendingApprovalStageMessage(options);
  attachAgentRunPendingApproval(messageId, approvalMessage);
}

export async function presentAgentPendingApproval(options: PendingApprovalStageOptions & { messageId: string }) {
  const { messageId } = options;
  const approvalMessage = await createPendingApprovalStageMessage(options);
  attachAgentPendingApproval(messageId, approvalMessage);
}
