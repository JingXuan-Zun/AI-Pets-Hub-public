import { AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT, type AgentProductionSessionResult } from '../../../agent';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { updateAgentRunMessage } from '../agentApprovalMessageStore';
import { projectAgentRunContinuationResult } from './runResultProjection';
import type { runInitialAgentApprovalContinuations } from './approvalContinuationDispatch';

type InitialContinuation = Awaited<ReturnType<typeof runInitialAgentApprovalContinuations>>;
type PendingApproval = Parameters<typeof runInitialAgentApprovalContinuations>[0]['initialPendingApproval'];

export function logUnconsumedInitialAgentApproval({ continuationRun, pendingRunFollowUpApproval }: {
  continuationRun: InitialContinuation;
  pendingRunFollowUpApproval: PendingApproval;
}) {
  pushFrontendRuntimeLog('agent-run', 'initial task-scoped follow-up approval continuation not consumed', {
    decision: continuationRun.stop?.decision ?? null,
    goal: pendingRunFollowUpApproval.plan.goal,
    tool: pendingRunFollowUpApproval.command.toolCall?.name ?? pendingRunFollowUpApproval.command.kind,
  });
}

export function updateInitialAgentContinuationPresentation({ continuationRun, result, runMessageId }: {
  continuationRun: InitialContinuation;
  result: AgentProductionSessionResult;
  runMessageId: string | null;
}) {
  if (
    continuationRun.outcome.kind === 'duplicate-blocked'
    || continuationRun.outcome.kind === 'limit-reached'
    || continuationRun.outcome.kind === 'pending-user-approval'
    || continuationRun.outcome.kind === 'stale-context'
  ) {
    pushFrontendRuntimeLog('agent-run', 'initial task-scoped approval continuation stopped', {
      count: continuationRun.count,
      decision: continuationRun.outcome.decision,
      limit: AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT,
    });
  }

  updateAgentRunMessage(runMessageId, (message) => projectAgentRunContinuationResult(message, { result }));
}

export function logMissingInitialAgentApprovalExecutor({ pendingRunFollowUpApproval }: { pendingRunFollowUpApproval: PendingApproval }) {
  pushFrontendRuntimeLog('agent-run', 'initial task-scoped follow-up approval continuation not consumed', {
    decision: null,
    reason: 'missing-executor',
    goal: pendingRunFollowUpApproval.plan.goal,
    tool: pendingRunFollowUpApproval.command.toolCall?.name ?? pendingRunFollowUpApproval.command.kind,
  });
}
