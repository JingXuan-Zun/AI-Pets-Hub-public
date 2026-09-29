import {
  AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT,
  runAgentProductionApprovalContinuations,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentExecutionPlan,
  type AgentProductionSessionResult,
  type AgentRuntimeProgressHandler,
  type AgentRuntimeToolExecutor,
} from '../../agent';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import type { PetConfig } from '../../types';

export async function runChatAgentApprovalContinuations(options: {
  approvedCommand: AgentChatCommand;
  approvedPlan: AgentExecutionPlan;
  cancellationSignal: AbortSignal;
  createSkippedResult: (command: AgentChatCommand) => AgentChatCommandResult;
  executeApprovedCommand: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
  initialResult: AgentProductionSessionResult;
  isCancelled: () => boolean;
  logLabel: string;
  onProgress: AgentRuntimeProgressHandler;
  settings: PetConfig['settings'];
  toolExecutor: AgentRuntimeToolExecutor;
}) {
  const run = await runAgentProductionApprovalContinuations({
    ...options,
    onIteration: (context) => {
      pushFrontendRuntimeLog('agent-run', context.skipped
        ? 'task-scoped stale outer approval skipped after in-app dispatch'
        : options.logLabel, {
        count: context.count,
        decision: context.decision,
        goal: context.pendingPlan.goal,
        staleDuplicateSkipCount: context.staleDuplicateSkipCount,
        tool: context.pendingCommand.toolCall?.name ?? context.pendingCommand.kind,
      });
    },
  });
  if (
    run.outcome.kind === 'duplicate-blocked'
    || run.outcome.kind === 'limit-reached'
    || run.outcome.kind === 'pending-user-approval'
  ) {
    pushFrontendRuntimeLog('agent-run', 'task-scoped approval continuation not consumed', {
      count: run.count,
      decision: run.outcome.decision,
      limit: AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT,
    });
  }
  return run;
}
