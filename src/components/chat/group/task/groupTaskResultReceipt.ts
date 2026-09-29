import type { AgentRuntimeImplementation } from '../../../../agent/runtime/agentRuntimeContract';
import type { GroupTaskCandidate } from './groupTaskBridge';

export type GroupTaskResultReceipt = {
  groupSessionId: string;
  topicId: string | null;
  taskId: string;
  sourceRoleIds: string[];
  implementation: AgentRuntimeImplementation;
  outcome: 'completed' | 'pending-approval' | 'failed';
  summary: string;
  collaborationPlan?: GroupTaskCandidate['collaborationPlan'];
  candidateRequestedCapability: string;
};

export function createGroupTaskResultReceipt(options: {
  candidate: GroupTaskCandidate;
  implementation: AgentRuntimeImplementation;
  outcome: GroupTaskResultReceipt['outcome'];
  summary: string;
}): GroupTaskResultReceipt {
  return {
    groupSessionId: options.candidate.groupSessionId,
    topicId: options.candidate.topicId,
    taskId: options.candidate.taskId,
    sourceRoleIds: [...options.candidate.sourceRoleIds],
    implementation: options.implementation,
    outcome: options.outcome,
    summary: options.summary,
    ...(options.candidate.collaborationPlan ? { collaborationPlan: options.candidate.collaborationPlan } : {}),
    candidateRequestedCapability: options.candidate.requestedCapability,
  };
}
