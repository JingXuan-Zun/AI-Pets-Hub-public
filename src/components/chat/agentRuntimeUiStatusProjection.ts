import type { AgentProductionSessionResult } from '../../agent';
import type { ChatAgentApprovalStatus, ChatAgentRunStatus } from '../../types';

export function isAgentTaskRuntimeWaitingApproval(result: AgentProductionSessionResult) {
  return result.taskState
    ? result.taskState.state === 'waiting_approval'
    : result.status === 'needs-approval';
}

export function getAgentTaskRuntimeRunStatus(
  result: AgentProductionSessionResult,
): ChatAgentRunStatus {
  if (!result.taskState) return resolveLegacyAgentRunStatus(result.status);
  switch (result.taskState.state) {
    case 'active': return 'running';
    case 'waiting_approval': return 'awaiting-approval';
    case 'succeeded': return 'completed';
    case 'failed': return 'failed';
    default: return 'blocked';
  }
}

function resolveLegacyAgentRunStatus(
  status: AgentProductionSessionResult['status'],
): ChatAgentRunStatus {
  switch (status) {
    case 'completed': return 'completed';
    case 'needs-approval': return 'awaiting-approval';
    case 'cancelled':
    case 'needs-user':
    case 'budget-exceeded':
      return 'blocked';
    default: return 'failed';
  }
}

export function resolveAgentApprovalUiStatus(
  runStatus: ChatAgentRunStatus,
): ChatAgentApprovalStatus {
  switch (runStatus) {
    case 'completed': return 'completed';
    case 'awaiting-approval': return 'awaiting-approval';
    case 'blocked': return 'blocked';
    default: return 'failed';
  }
}
