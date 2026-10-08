import { type ChatMessage, type ChatAgentCorePlanSummary } from '../../../types';
import { type AgentChatCommand, type AgentExecutionPlan } from '../../../agent';
import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import { resolvePreparedAgentTargetSlot } from './sessionMessageProjection';
import { createChatMessageId } from '../multiPetChat';
import { createAgentApprovalSummary } from './approvalSummary';
import { createAgentWorkStages } from './workStageCreation';
import { createAgentRunTrace } from './runTraceCreation';

export async function createAgentApprovalMessage(options: {
  agentRuntime?: NonNullable<ChatMessage['agentApproval']>['agentRuntime'];
  command: AgentChatCommand;
  corePlanSummary?: ChatAgentCorePlanSummary | null;
  plan: AgentExecutionPlan;
  preparedRequest: PreparedChatSendRequest;
  text?: string;
}): Promise<ChatMessage> {
  const { agentRuntime = null, command, corePlanSummary = null, plan, preparedRequest, text } = options;
  const targetSlot = resolvePreparedAgentTargetSlot(preparedRequest);
  const messageId = createChatMessageId('agent-approval');
  const approvalSummary = await createAgentApprovalSummary(command, plan, preparedRequest);

  return {
    id: messageId,
    role: 'model',
    text: text ?? 'I need your approval before taking this Agent action.',
    agentApproval: {
      approvalSummary,
      agentRuntime,
      command,
      corePlanSummary,
      groupTaskEvent: preparedRequest.groupTaskConversationEvent ?? null,
      id: messageId,
      plan,
      stages: createAgentWorkStages(plan, {
        needsApproval: true,
      }),
      status: 'pending',
      trace: createAgentRunTrace(plan, {
        needsApproval: true,
      }),
    },
    chatMode: preparedRequest.currentChatState.chatMode,
    groupTaskEvent: preparedRequest.groupTaskConversationEvent ?? null,
    petId: targetSlot?.id ?? null,
    petName: targetSlot?.personality.name ?? null,
  };
}
