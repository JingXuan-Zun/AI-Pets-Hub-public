import { releaseAgentCanonicalEventJournal, type AgentProductionSessionResult } from '../../../agent';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { isAgentTaskRuntimeWaitingApproval } from '../agentRuntimeUiStatusProjection';

export function logInitialAgentRuntimeCompletion({ runtimeRoute, result }: { runtimeRoute: string; result: AgentProductionSessionResult }) {
  pushFrontendRuntimeLog('agent-session-v2', 'session completed', {
    runtimeRoute,
    status: result.status,
    stepCount: result.steps.length,
    toolResultCount: result.toolResults.length,
    taskId: result.taskState?.taskId ?? null,
    stateRevision: result.taskState?.revision ?? null,
  });
}

export function completeApprovedAgentRuntimeLifecycle({ sessionResult, messageId }: { sessionResult: AgentProductionSessionResult; messageId: string }) {
  if (!isAgentTaskRuntimeWaitingApproval(sessionResult)) {
    releaseAgentCanonicalEventJournal(messageId);
  }

  pushFrontendRuntimeLog('agent-session-v2', 'approved session continued', {
    status: sessionResult.status,
    stepCount: sessionResult.steps.length,
    toolResultCount: sessionResult.toolResults.length,
    taskId: sessionResult.taskState?.taskId ?? null,
    stateRevision: sessionResult.taskState?.revision ?? null,
  });
}
