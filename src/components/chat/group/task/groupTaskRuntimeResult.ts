import type { AgentProductionSessionResult } from '../../../../agent';
import type { AgentRuntimeImplementation } from '../../../../agent/runtime/agentRuntimeContract';
import type { PreparedChatSendRequest } from '../../chatMessageSendFlowTypes';
import { createGroupTaskConversationEvent } from './groupTaskConversationEvent';
import { createGroupTaskResultReceipt } from './groupTaskResultReceipt';
import { advanceGroupTaskCollaborationPlan, failGroupTaskCollaborationPlan } from './groupTaskCollaborationPlan';

export function applyGroupTaskRuntimeResult(options: {
  implementation: AgentRuntimeImplementation;
  preparedRequest: PreparedChatSendRequest;
  result: AgentProductionSessionResult;
}) {
  const candidate = options.preparedRequest.groupTaskCandidate;
  if (!candidate) {
    return;
  }
  const plan = candidate.collaborationPlan;
  if (plan && options.result.status === 'completed') {
    candidate.collaborationPlan = advanceGroupTaskCollaborationPlan(
      advanceGroupTaskCollaborationPlan(plan),
    );
  } else if (plan && options.result.status !== 'needs-approval') {
    candidate.collaborationPlan = failGroupTaskCollaborationPlan(plan);
  }
  const receipt = createGroupTaskResultReceipt({
    candidate,
    implementation: options.implementation,
    outcome: options.result.status === 'completed'
      ? 'completed'
      : (options.result.status === 'needs-approval' ? 'pending-approval' : 'failed'),
    summary: options.result.finalAnswer,
  });
  options.preparedRequest.groupTaskResultReceipt = receipt;
  options.preparedRequest.groupTaskConversationEvent = createGroupTaskConversationEvent({
    receipt,
    verified: options.result.status === 'completed',
  });
}
