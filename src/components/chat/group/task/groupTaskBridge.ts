export type GroupTaskProposal = {
  groupSessionId: string;
  topicId: string | null;
  turnId: string;
  roleId: string;
  summary: string;
  requestedCapability: string;
};

export type GroupTaskCandidate = {
  taskId: string;
  groupSessionId: string;
  topicId: string | null;
  sourceRoleIds: string[];
  summary: string;
  requestedCapability: string;
  status: 'pending-arbitration';
  collaborationPlan?: GroupTaskCollaborationPlan;
};

export function createGroupTaskCandidate(
  proposals: GroupTaskProposal[],
  collaborationPlan?: GroupTaskCollaborationPlan | null,
): GroupTaskCandidate | null {
  const first = proposals[0];
  if (!first) {
    return null;
  }

  const matchingProposals = proposals.filter((proposal) => (
    proposal.groupSessionId === first.groupSessionId
    && proposal.topicId === first.topicId
    && proposal.requestedCapability === first.requestedCapability
  ));

  return {
    taskId: `group-task-${first.groupSessionId}-${first.turnId}`,
    groupSessionId: first.groupSessionId,
    topicId: first.topicId,
    sourceRoleIds: [...new Set(matchingProposals.map((proposal) => proposal.roleId))],
    summary: first.summary,
    requestedCapability: first.requestedCapability,
    status: 'pending-arbitration',
    ...(collaborationPlan ? { collaborationPlan } : {}),
  };
}
import type { GroupTaskCollaborationPlan } from './groupTaskCollaborationPlan';
