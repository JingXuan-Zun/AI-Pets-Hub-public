import { type AgentChatCommandResult, type AgentChatFollowUpAction } from './agentChatCommand';
export { resolveAgentResultFollowUpActions } from './resultAssessment/resultEvidenceAssessment';

export function createAgentDecisionSummary(result: AgentChatCommandResult, followUpActions: AgentChatFollowUpAction[]) {
  const status = result.assessment?.status ?? 'unverified';
  if (status === 'completed') {
    return 'Result verified; ready for character reply';
  }

  if (status === 'can-continue') {
    return followUpActions.length
      ? `Can continue: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Result can continue, but no direct action was prepared';
  }

  if (status === 'needs-user') {
    return followUpActions.length
      ? `Needs user input: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Needs user input before continuing';
  }

  if (status === 'failed') {
    return followUpActions.length
      ? `Execution failed; recovery options: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Execution failed; no reliable recovery action is available';
  }

  return followUpActions.length
    ? `Result is not fully verified; recovery options: ${followUpActions.map((action) => action.label).join(', ')}`
    : 'Result is not fully verified; waiting for whether to continue';
}
