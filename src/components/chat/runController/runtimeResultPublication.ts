import type { AgentProductionSessionResult } from '../../../agent';
import type { AgentRuntimeImplementation } from '../../../agent/runtime/agentRuntimeContract';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import type { RunPreparedAgentProductionSessionOptions } from './controllerOptions';
import { publishAgentRuntimeWorldResult } from '../../../runtime-world/agentRuntimeWorldBridge';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { updateAgentRunMessage } from '../agentApprovalMessageStore';
import { publishPreparedGroupTaskEvent, type GroupTaskLifecycleCallbacks } from '../group/task/groupTaskApprovalLifecycle';

function persistAgentRunGroupTaskEvent(preparedRequest: PreparedChatSendRequest, runMessageId: string | null) {
  const event = preparedRequest.groupTaskConversationEvent;
  if (!event || !runMessageId) return;
  updateAgentRunMessage(runMessageId, (message) => ({ ...message, groupTaskEvent: event }));
}

export function publishInitialAgentRuntimeResult({ result, runtimeRoute, onRuntimeResult, preparedRequest, runMessageId, groupTaskLifecycle }: {
  result: AgentProductionSessionResult;
  runtimeRoute: string;
  onRuntimeResult?: RunPreparedAgentProductionSessionOptions['onRuntimeResult'];
  preparedRequest: PreparedChatSendRequest;
  runMessageId: string | null;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
}) {
  publishAgentRuntimeWorldResult(result);
  onRuntimeResult?.({ implementation: runtimeRoute as AgentRuntimeImplementation, result });
  persistAgentRunGroupTaskEvent(preparedRequest, runMessageId);
  publishPreparedGroupTaskEvent(groupTaskLifecycle, preparedRequest);
}

export function publishApprovedAgentRuntimeResult({ sessionResult, routedResult, taskScopedApprovedContinuation }: {
  sessionResult: AgentProductionSessionResult;
  routedResult: { implementation: string };
  taskScopedApprovedContinuation: { count: number };
}) {
  publishAgentRuntimeWorldResult(sessionResult);
  pushFrontendRuntimeLog('agent-session-v2', 'approved session routed continuation', {
    runtimeRoute: routedResult.implementation,
    status: sessionResult.status,
    stepCount: sessionResult.steps.length,
    toolResultCount: sessionResult.toolResults.length,
    taskScopedApprovedContinuationCount: taskScopedApprovedContinuation.count,
    taskId: sessionResult.taskState?.taskId ?? null,
    stateRevision: sessionResult.taskState?.revision ?? null,
  });
}
