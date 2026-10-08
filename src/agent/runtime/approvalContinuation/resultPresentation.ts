import { type AgentChatCommand, type AgentChatCommandResult } from '../../agentChatCommand';
import { isValidAgentTaskScopeText } from '../../agentPermissionRouter';
import { assessAgentCommandResult } from '../../agentResultAssessment';
import { type AgentRuntimeResult } from '../agentRuntimeContract';
import type { AgentApprovalContinuationStop, AgentApprovalContinuationOutcome } from '../agentApprovalContinuationRuntime';
import { createAgentRuntimeDiagnostic, upsertAgentRuntimeDiagnostic } from '../agentRuntimeDiagnostics';

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

export function createAgentApprovalContinuationOutcome(options: {
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

export function appendAgentApprovalContinuationDiagnostic(
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
