import { createAgentApprovalContinuationOutcome, appendAgentApprovalContinuationDiagnostic } from './approvalContinuation/resultPresentation';
export { createAgentStaleOuterApprovalSkippedResult, createAgentDuplicateApprovalBlockedResult } from './approvalContinuation/resultPresentation';

import {
  diagnoseAgentTaskScopedApprovalContinuation,
  type AgentTaskScopedApprovalContinuationDecision,
} from '../agentPermissionRouter';

import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';

import { type AgentExecutionPlan } from '../agentOrchestrator';

import {
  type AgentRuntimeContinuation,
  type AgentRuntimePendingApproval,
  type AgentRuntimeResult,
} from './agentRuntimeContract';

import {
  type ApprovedDispatchResolutionResult,
} from './agentApprovedDispatchResolution';

import { canSkipAgentStaleOuterApprovalAfterTaskEvidence } from './agentStaleApprovalCompatibility';

import { validateAgentRuntimeApprovalContext } from './agentRuntimeTargetGuard';

import {
  advanceAgentTaskRuntimeLifecycle,
  updateAgentTaskRuntimeSubgoal,
} from './agentTaskRuntime';

import {
  hasAgentRuntimeCommittedDesktopDispatch,
} from './agentDispatchEvidence';

export const AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT = 6;

export interface AgentApprovalContinuationIterationContext {
  count: number;
  decision: AgentTaskScopedApprovalContinuationDecision;
  pendingCommand: AgentChatCommand;
  pendingPlan: AgentExecutionPlan;
  result: AgentRuntimeResult;
  staleDuplicateSkipCount: number;
}

export type AgentApprovedDispatchResolver = (
  command: AgentChatCommand,
  continuation: AgentRuntimeContinuation,
) => Promise<ApprovedDispatchResolutionResult>;

export interface AgentApprovalContinuationStop {
  decision: AgentTaskScopedApprovalContinuationDecision | null;
  pendingTool: string;
  reason: AgentTaskScopedApprovalContinuationDecision['reason'] | 'continuation-limit' | 'stale-context' | 'unknown';
  staleContextReason?: 'approval-stale-identity' | 'approval-stale-surface';
}

export interface AgentApprovalContinuationRunResult {
  count: number;
  outcome: AgentApprovalContinuationOutcome;
  result: AgentRuntimeResult;
  staleDuplicateSkipCount: number;
  stop: AgentApprovalContinuationStop | null;
}

export type AgentApprovalContinuationOutcome =
  | { count: number; kind: 'cancelled' }
  | { count: number; kind: 'consumed' }
  | {
      count: number;
      decision: AgentTaskScopedApprovalContinuationDecision;
      kind: 'duplicate-blocked';
      pendingTool: string;
    }
  | {
      count: number;
      decision: AgentTaskScopedApprovalContinuationDecision;
      kind: 'limit-reached';
      pendingTool: string;
    }
  | {
      count: number;
      decision: AgentTaskScopedApprovalContinuationDecision;
      kind: 'pending-user-approval';
      pendingTool: string;
      reason: AgentTaskScopedApprovalContinuationDecision['reason'] | 'unknown';
    }
  | {
      count: number;
      decision: AgentTaskScopedApprovalContinuationDecision;
      kind: 'stale-context';
      pendingTool: string;
      reason: 'approval-stale-identity' | 'approval-stale-surface';
    }
  | { count: number; kind: 'stale-outer-skipped'; skippedCount: number };

export function createAgentRuntimeWaitingApprovalSnapshot(options: {
  command: AgentChatCommand;
  continuation: AgentRuntimeContinuation;
  plan: AgentExecutionPlan;
  reason?: string | null;
  routeSummary?: string | null;
}): AgentRuntimeResult {
  return {
    finalAnswer: 'Approval is required before execution can continue.',
    pendingApproval: {
      command: options.command,
      plan: options.plan,
      reason: options.reason ?? 'Waiting for user approval.',
      routeSummary: options.routeSummary ?? 'Approval required.',
      runId: options.continuation.taskTransaction?.taskState?.runId ?? null,
      surfaceGeneration: options.continuation.taskTransaction?.taskState?.surface?.generation ?? null,
      surfaceId: options.continuation.taskTransaction?.taskState?.surface?.surfaceId ?? null,
      taskId: options.continuation.taskTransaction?.taskState?.taskId ?? null,
    },
    sourceText: options.continuation.sourceText,
    status: 'needs-approval',
    steps: options.continuation.steps,
    taskState: options.continuation.taskState ?? null,
    continuation: {
      ...options.continuation,
      taskTransaction: options.continuation.taskTransaction ?? null,
    },
    traceEvents: options.continuation.traceEvents,
    toolResults: options.continuation.toolResults,
  };
}

export async function runAgentApprovedActionLifecycle(options: {
  command: AgentChatCommand;
  execute: (
    command: AgentChatCommand,
    executingResult: AgentRuntimeResult,
  ) => Promise<AgentChatCommandResult>;
  waitingResult: AgentRuntimeResult;
}): Promise<{
  commandResult: AgentChatCommandResult;
  runtimeResult: AgentRuntimeResult;
}> {
  let runtimeResult = advanceAgentTaskRuntimeLifecycle({
    kind: 'approval-granted',
    result: options.waitingResult,
  });
  runtimeResult = advanceAgentTaskRuntimeLifecycle({
    kind: 'execution-started',
    result: runtimeResult,
  });
  runtimeResult = updateAgentTaskRuntimeSubgoal({
    actionScope: options.command.toolCall?.actionScope,
    result: runtimeResult,
    status: 'in_progress',
  });
  const commandResult = await options.execute(options.command, runtimeResult);
  const wasSkippedWithoutDispatch = commandResult.receipt?.evidenceLines?.some((line) => (
    line === 'staleOuterApprovalSkipped=true'
  )) ?? false;
  const wasCommittedDispatch = hasAgentRuntimeCommittedDesktopDispatch(
    options.command,
    commandResult,
  );
  if (wasCommittedDispatch && !wasSkippedWithoutDispatch) {
    runtimeResult = advanceAgentTaskRuntimeLifecycle({
      kind: 'action-dispatched',
      result: runtimeResult,
    });
    runtimeResult = updateAgentTaskRuntimeSubgoal({
      actionScope: options.command.toolCall?.actionScope,
      result: runtimeResult,
      status: 'dispatched',
    });
  } else if (wasSkippedWithoutDispatch) {
    runtimeResult = updateAgentTaskRuntimeSubgoal({
      actionScope: options.command.toolCall?.actionScope,
      result: runtimeResult,
      status: 'in_progress',
    });
  } else {
    runtimeResult = updateAgentTaskRuntimeSubgoal({
      actionScope: options.command.toolCall?.actionScope,
      result: runtimeResult,
      status: 'blocked',
    });
  }
  return { commandResult, runtimeResult };
}

function isAgentRuntimeWaitingApproval(result: AgentRuntimeResult) {
  return result.taskState
    ? result.taskState.state === 'waiting_approval'
    : result.status === 'needs-approval';
}

export async function runAgentTaskScopedApprovalContinuations(options: {
  approvedCommand: AgentChatCommand;
  approvedPlan: AgentExecutionPlan;
  createSkippedResult: (command: AgentChatCommand) => AgentChatCommandResult;
  execute: (
    command: AgentChatCommand,
    context: AgentApprovalContinuationIterationContext,
  ) => Promise<AgentChatCommandResult>;
  initialPendingApproval?: AgentRuntimePendingApproval | null;
  initialResult: AgentRuntimeResult;
  isCancelled?: (() => boolean) | null;
  maxContinuations?: number | null;
  onIteration?: ((
    context: AgentApprovalContinuationIterationContext & { skipped: boolean },
  ) => void) | null;
  resolveApprovedDispatch?: AgentApprovedDispatchResolver | null;
  resume: (options: {
    command: AgentChatCommand;
    previousResult: AgentRuntimeResult;
    result: AgentChatCommandResult;
  }) => Promise<AgentRuntimeResult>;
}): Promise<AgentApprovalContinuationRunResult> {
  const maxContinuations = Math.max(
    0,
    Math.floor(options.maxContinuations ?? AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT),
  );
  let result = options.initialResult;
  let count = 0;
  let staleDuplicateSkipCount = 0;
  let staleApprovalContext: 'approval-stale-identity' | 'approval-stale-surface' | null = null;
  let pendingApproval = options.initialPendingApproval
    ?? (isAgentRuntimeWaitingApproval(result) ? result.pendingApproval ?? null : null);

  let cancelled = false;
  while (pendingApproval && count < maxContinuations) {
    if (options.isCancelled?.()) {
      cancelled = true;
      break;
    }
    const approvalGuard = validateAgentRuntimeApprovalContext({
      approval: pendingApproval,
      state: result.taskState ?? result.continuation.taskState ?? null,
    });
    if (!approvalGuard.allowed) {
      staleApprovalContext = approvalGuard.reason === 'approval-stale-identity'
        ? 'approval-stale-identity'
        : 'approval-stale-surface';
      break;
    }
    const decision = diagnoseAgentTaskScopedApprovalContinuation({
      approvedCommand: options.approvedCommand,
      approvedPlan: options.approvedPlan,
      pendingCommand: pendingApproval.command,
      pendingPlan: pendingApproval.plan,
    });
    const context: AgentApprovalContinuationIterationContext = {
      count,
      decision,
      pendingCommand: pendingApproval.command,
      pendingPlan: pendingApproval.plan,
      result,
      staleDuplicateSkipCount,
    };
    const skipped = !decision.allowed && canSkipAgentStaleOuterApprovalAfterTaskEvidence({
      approvedCommand: options.approvedCommand,
      continuationCount: context.count,
      decision: context.decision,
      pendingCommand: context.pendingCommand,
      result: context.result,
      staleDuplicateSkipCount: context.staleDuplicateSkipCount,
    });
    if (!decision.allowed && !skipped) {
      break;
    }

    count += 1;
    let executionResult: AgentChatCommandResult;
    let executionCommand = pendingApproval.command;
    let executionContinuation = result.continuation;
    if (skipped) {
      const iterationContext = { ...context, count, result, skipped };
      options.onIteration?.(iterationContext);
      executionResult = options.createSkippedResult(pendingApproval.command);
    } else {
      const resolvedDispatch = options.resolveApprovedDispatch
        ? await options.resolveApprovedDispatch(pendingApproval.command, result.continuation)
        : {
            command: pendingApproval.command,
            continuation: result.continuation,
            blockedResult: null,
          } satisfies ApprovedDispatchResolutionResult;
      executionCommand = resolvedDispatch.command;
      executionContinuation = resolvedDispatch.continuation;
      const executionPlan = resolvedDispatch.plan ?? pendingApproval.plan;
      if (resolvedDispatch.blockedResult) {
        executionResult = resolvedDispatch.blockedResult;
        result = {
          ...result,
          continuation: executionContinuation,
          taskState: executionContinuation.taskState ?? result.taskState,
          toolResults: executionContinuation.toolResults,
        };
        result = await options.resume({
          command: executionCommand,
          previousResult: result,
          result: executionResult,
        });
        pendingApproval = isAgentRuntimeWaitingApproval(result)
          ? result.pendingApproval ?? null
          : null;
        continue;
      }
      const approvedAction = await runAgentApprovedActionLifecycle({
        command: executionCommand,
        execute: (command, executingResult) => {
          const iterationContext = { ...context, count, result: executingResult, skipped };
          options.onIteration?.(iterationContext);
          return options.execute(command, iterationContext);
        },
        waitingResult: {
          ...result,
          continuation: executionContinuation,
          taskState: executionContinuation.taskState ?? result.taskState,
          toolResults: executionContinuation.toolResults,
        },
      });
      executionResult = approvedAction.commandResult;
      result = approvedAction.runtimeResult;
      pendingApproval = {
        ...pendingApproval,
        command: executionCommand,
        plan: executionPlan,
      };
    }
    if (skipped) {
      staleDuplicateSkipCount += 1;
    }
    if (options.isCancelled?.()) {
      cancelled = true;
      break;
    }
    result = await options.resume({
      command: executionCommand,
      previousResult: result,
      result: executionResult,
    });
    pendingApproval = isAgentRuntimeWaitingApproval(result)
      ? result.pendingApproval ?? null
      : null;
  }

  let stop: AgentApprovalContinuationStop | null = null;
  if (pendingApproval) {
    const decision = diagnoseAgentTaskScopedApprovalContinuation({
      approvedCommand: options.approvedCommand,
      approvedPlan: options.approvedPlan,
      pendingCommand: pendingApproval.command,
      pendingPlan: pendingApproval.plan,
    });
    stop = {
      decision,
      pendingTool: decision.pendingTool,
      reason: staleApprovalContext
        ? 'stale-context'
        : count >= maxContinuations ? 'continuation-limit' : decision.reason,
      ...(staleApprovalContext ? { staleContextReason: staleApprovalContext } : {}),
    };
  }

  const outcome = createAgentApprovalContinuationOutcome({
    cancelled,
    count,
    staleDuplicateSkipCount,
    stop,
  });
  result = appendAgentApprovalContinuationDiagnostic(result, outcome, maxContinuations);

  return {
    count,
    outcome,
    result,
    staleDuplicateSkipCount,
    stop,
  };
}
