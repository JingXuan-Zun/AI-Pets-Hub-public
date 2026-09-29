import {
  diagnoseAgentTaskScopedApprovalContinuation,
  isValidAgentTaskScopeText,
  type AgentTaskScopedApprovalContinuationDecision,
} from '../agentPermissionRouter';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import { type AgentExecutionPlan } from '../agentOrchestrator';
import { assessAgentCommandResult } from '../agentResultAssessment';
import {
  type AgentRuntimeContinuation,
  type AgentRuntimePendingApproval,
  type AgentRuntimeResult,
} from './agentRuntimeContract';
import {
  type ApprovedDispatchResolutionResult,
} from './agentApprovedDispatchResolution';
import {
  createAgentRuntimeDiagnostic,
  upsertAgentRuntimeDiagnostic,
} from './agentRuntimeDiagnostics';
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

function resolveAgentStaleOuterObservationQuery(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const genericTargets = new Set(['app', 'browser', 'resource', 'window']);
  const candidates = [
    input.target,
    input.query,
    input.appName,
    input.name,
    input.title,
    input.processName,
    input.windowTitle,
    input.sourceQuery,
    input.postVerifyQuery,
    input.verifyQuery,
    command.toolCall?.goal,
    command.instruction,
    command.sourceText,
  ];

  for (const candidate of candidates) {
    if (
      isValidAgentTaskScopeText(candidate)
      && !genericTargets.has(candidate.trim().toLowerCase())
    ) {
      return candidate.trim();
    }
  }

  return '';
}

export function createAgentStaleOuterApprovalSkippedResult(options: {
  command: AgentChatCommand;
  responseText: string;
}): AgentChatCommandResult {
  const { command, responseText } = options;
  const toolName = command.toolCall?.name ?? command.kind;
  const observationQuery = resolveAgentStaleOuterObservationQuery(command);
  const followUpCommand: AgentChatCommand = {
    capabilityId: 'desktop-observation',
    instruction: command.instruction,
    kind: 'tool-call',
    sourceText: command.sourceText,
    toolCall: {
      goal: command.toolCall?.goal ?? command.instruction,
      input: {
        action: 'wait_and_observe',
        forceRefresh: true,
        includeWindows: true,
        ...(observationQuery ? { query: observationQuery } : {}),
        waitMs: 800,
      },
      name: 'execute_desktop_observation',
    },
  };
  const followUpAction = {
    command: followUpCommand,
    kind: 'run-command' as const,
    label: 'Observe current window state',
    requiresApproval: false,
  };

  return assessAgentCommandResult(command, {
    assessment: {
      evidence: [
        'staleOuterApprovalSkipped=true',
        'next=wait_and_observe',
      ],
      nextStep: 'Silently observe the desktop/window state before deciding the next action.',
      status: 'unverified',
      summary: 'Skipped stale duplicate outer desktop action; current window state still needs observation.',
    },
    followUp: 'Observe current desktop/window state after skipping stale duplicate outer action.',
    followUpAction,
    followUpActions: [followUpAction],
    ok: true,
    observations: [
      'Skipped stale outer desktop approval after task-scoped desktop evidence.',
      `Skipped tool: ${toolName}`,
    ],
    receipt: {
      evidenceLines: [
        'staleOuterApprovalSkipped=true',
        'reason=desktop evidence already exists in the same approved task continuation',
      ],
      status: 'unverified',
      summaryLines: [
        'Skipped stale duplicate outer desktop action.',
        'Continuing from latest desktop evidence without repeating the approval-required primitive.',
      ],
      title: 'Execution receipt',
      toolName,
      verification: 'Stale outer desktop approval was consumed without re-executing; follow-up observation should verify the current window state.',
    },
    responseText,
    verification: 'Skipped stale duplicate outer desktop action and continued with existing evidence.',
  });
}

export function createAgentDuplicateApprovalBlockedResult(options: {
  command: AgentChatCommand;
  previousExecutionResult?: AgentChatCommandResult | null;
  previousExecutionSummary?: string | null;
  responseText: string;
}): AgentChatCommandResult {
  const {
    command,
    previousExecutionResult,
    previousExecutionSummary,
    responseText,
  } = options;
  const toolName = command.toolCall?.name ?? command.kind;
  const previousStepObservations = (previousExecutionResult?.observations ?? [])
    .filter((line) => /^Step \d+\//u.test(line))
    .slice(0, 6);
  const previousStepEvidence = (previousExecutionResult?.receipt?.evidenceLines ?? [])
    .filter((line) => /^Step \d+\//u.test(line))
    .slice(0, 6);

  return assessAgentCommandResult(command, {
    errorText: responseText,
    observations: [
      `Repeated approval loop blocked for ${toolName}.`,
      'The approved command fingerprint matched the next pending approval command.',
      ...previousStepObservations,
    ],
    ok: false,
    receipt: {
      evidenceLines: [
        `tool=${toolName}`,
        'duplicateApproval=true',
        ...previousStepEvidence,
      ],
      status: 'blocked',
      summaryLines: [
        'Stopped duplicate approval request for the same command in one approval continuation.',
        ...(previousExecutionSummary ? [`Previous execution: ${previousExecutionSummary}`] : []),
      ],
      title: 'Repeated approval stopped',
      toolName,
      verification: 'The same approved command was requested again; previous execution evidence should be inspected instead of asking for another approval.',
    },
    responseText,
    verification: 'Duplicate approval loop was stopped.',
  });
}

function createAgentApprovalContinuationOutcome(options: {
  cancelled: boolean;
  count: number;
  staleDuplicateSkipCount: number;
  stop: AgentApprovalContinuationStop | null;
}): AgentApprovalContinuationOutcome {
  if (options.cancelled) {
    return { count: options.count, kind: 'cancelled' };
  }
  if (options.stop?.decision) {
    if (options.stop.reason === 'continuation-limit') {
      return {
        count: options.count,
        decision: options.stop.decision,
        kind: 'limit-reached',
        pendingTool: options.stop.pendingTool,
      };
    }
    if (options.stop.reason === 'duplicate-command') {
      return {
        count: options.count,
        decision: options.stop.decision,
        kind: 'duplicate-blocked',
        pendingTool: options.stop.pendingTool,
      };
    }
    if (options.stop.reason === 'stale-context') {
      return {
        count: options.count,
        decision: options.stop.decision,
        kind: 'stale-context',
        pendingTool: options.stop.pendingTool,
        reason: options.stop.staleContextReason ?? 'approval-stale-surface',
      };
    }
    return {
      count: options.count,
      decision: options.stop.decision,
      kind: 'pending-user-approval',
      pendingTool: options.stop.pendingTool,
      reason: options.stop.reason,
    };
  }
  if (options.staleDuplicateSkipCount > 0) {
    return {
      count: options.count,
      kind: 'stale-outer-skipped',
      skippedCount: options.staleDuplicateSkipCount,
    };
  }
  return { count: options.count, kind: 'consumed' };
}

function appendAgentApprovalContinuationDiagnostic(
  result: AgentRuntimeResult,
  outcome: AgentApprovalContinuationOutcome,
  continuationLimit: number,
) {
  if (outcome.kind === 'consumed' || outcome.kind === 'cancelled') {
    return result;
  }
  const decision = 'decision' in outcome ? outcome.decision : null;
  const pendingTool = 'pendingTool' in outcome ? outcome.pendingTool : null;
  const diagnostics = upsertAgentRuntimeDiagnostic(result.diagnostics, createAgentRuntimeDiagnostic({
    category: 'approval-continuation',
    details: {
      approvalContinuationAllowed: false,
      approvalContinuationCount: outcome.count,
      approvalContinuationLimit: continuationLimit,
      approvalContinuationReason: outcome.kind,
      approvalContinuationTool: pendingTool,
      desktopSafe: decision?.desktopSafe ?? null,
      eligibleTool: decision?.eligibleTool ?? null,
      hardGate: decision?.hardGate ?? null,
      pendingActionKinds: decision?.pendingActionKinds ?? [],
      pendingGoal: decision?.pendingGoal ?? null,
      pendingRouteSummary: decision?.pendingRouteSummary ?? null,
      prohibitedActionKinds: decision?.prohibitedActionKinds ?? [],
      prohibitionConflict: decision?.prohibitionConflict ?? null,
      scopeMatched: decision?.scopeMatched ?? null,
      staleApprovalContext: outcome.kind === 'stale-context'
        ? outcome.reason
        : null,
      staleDuplicateOuterApprovalSkipped: outcome.kind === 'stale-outer-skipped'
        ? outcome.skippedCount
        : 0,
      withinRiskCeiling: decision?.withinRiskCeiling ?? null,
    },
    source: 'agent-approval-continuation-runtime',
    status: outcome.kind,
    summary: `Approval continuation outcome: ${outcome.kind}.`,
    tool: pendingTool,
  }));
  return {
    ...result,
    continuation: {
      ...result.continuation,
      diagnostics,
    },
    diagnostics,
  };
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
