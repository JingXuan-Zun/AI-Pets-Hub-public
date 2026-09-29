import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import { type AgentRecoveryProposalDecision } from './agentRecoveryController';
import {
  createAgentAutoRecoveryResultMessage,
  createAgentAutoRecoveryRunningMessage,
  createAgentAutoRecoveryStepReason,
  createAgentAutoRecoveryStepSummary,
  createAgentFailedActionRecoveryResultMessage,
  createAgentFailedActionRecoveryRunningMessage,
  createAgentFailedActionRecoveryStepReason,
  createAgentFailedActionRecoveryStepSummary,
} from './agentExecutionProgressSignals';
import {
  type AgentRuntimeProgressEvent,
  type AgentRuntimeStep,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
  type AgentTaskRuntimeRecoveryAuthorizer,
  type AgentTaskRuntimeRecoveryDecision,
  type AgentTaskRuntimeRecoveryKind,
  type AgentTaskRuntimeStateRecord,
} from './agentRuntimeContract';
import {
  runAgentToolTransaction,
  type AgentToolTransactionBudgetPort,
} from './agentToolTransactionExecutor';

export interface AgentRecoveryExecutionStarted {
  progressEvent: Omit<AgentRuntimeProgressEvent, 'continuation'>;
  step: AgentRuntimeStep;
}

export interface AgentRecoveryExecutionCollected {
  entry: AgentRuntimeToolResultEntry;
  progressEvent: Omit<AgentRuntimeProgressEvent, 'continuation'>;
  step: AgentRuntimeStep;
}

export type AgentRecoveryExecutionOutcome =
  | {
      kind: 'not-executed';
      proposal: AgentRecoveryProposalDecision;
      reason: string;
      stage: 'proposal' | 'executor' | 'permission';
    }
  | {
      authorization: AgentTaskRuntimeRecoveryDecision;
      kind: 'authorization-denied';
      proposal: AgentRecoveryProposalDecision;
      reason: string;
    }
  | {
      kind: 'budget-exceeded';
      proposal: AgentRecoveryProposalDecision;
      reason: string;
      stopReason: AgentRuntimeTimingStopReason;
    }
  | {
      kind: 'cancelled';
      proposal: AgentRecoveryProposalDecision;
      reason: string;
    }
  | {
      authorization: AgentTaskRuntimeRecoveryDecision | null;
      collected: AgentRecoveryExecutionCollected;
      kind: 'executed';
      proposal: AgentRecoveryProposalDecision;
      reason: string;
      started: AgentRecoveryExecutionStarted;
    };

function normalizeAction(command: AgentChatCommand) {
  const value = command.toolCall?.input.action;
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function createRecoveryPresentation(
  kind: AgentTaskRuntimeRecoveryKind,
  command: AgentChatCommand,
) {
  if (kind === 'failed-action') {
    return {
      resultMessage: (ok: boolean) => createAgentFailedActionRecoveryResultMessage({ ok }),
      runningMessage: createAgentFailedActionRecoveryRunningMessage(),
      stepReason: createAgentFailedActionRecoveryStepReason(),
      stepSummary: createAgentFailedActionRecoveryStepSummary(),
    };
  }

  const input = command.toolCall?.input ?? {};
  const recoveryAttemptText = typeof input.recoveryAttempt === 'number'
    && typeof input.recoveryMaxAttempts === 'number'
    ? ` (${input.recoveryAttempt}/${input.recoveryMaxAttempts})`
    : '';
  return {
    resultMessage: (ok: boolean) => createAgentAutoRecoveryResultMessage({ ok }),
    runningMessage: createAgentAutoRecoveryRunningMessage({
      isWaitAndObserve: normalizeAction(command) === 'wait_and_observe',
      recoveryAttemptText,
    }),
    stepReason: createAgentAutoRecoveryStepReason(),
    stepSummary: createAgentAutoRecoveryStepSummary(),
  };
}

export async function runAgentRecoveryExecution(options: {
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  authorizeRecovery?: AgentTaskRuntimeRecoveryAuthorizer | null;
  executeCommand?: ((command: AgentChatCommand) => Promise<AgentChatCommandResult>) | null;
  getTimingDetail: (command: AgentChatCommand) => string;
  isCancellationRequested: () => boolean;
  kind: AgentTaskRuntimeRecoveryKind;
  onAuthorization?: (decision: AgentTaskRuntimeRecoveryDecision) => void;
  onCollected?: (event: AgentRecoveryExecutionCollected) => void;
  onStarted?: (event: AgentRecoveryExecutionStarted) => void;
  postActionState?: string | null;
  proposal: AgentRecoveryProposalDecision;
  reason: string;
  requestedLimit: number;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  sourceText: string;
  stepIndex: number;
  taskState?: AgentTaskRuntimeStateRecord | null;
  timingTracker: AgentToolTransactionBudgetPort;
  traceSource: string;
  userGoal: string;
}): Promise<AgentRecoveryExecutionOutcome> {
  const proposal = options.proposal;
  const command = proposal.command;
  if (!command) {
    return {
      kind: 'not-executed',
      proposal,
      reason: proposal.reason,
      stage: 'proposal',
    };
  }
  if (!options.executeCommand) {
    return {
      kind: 'not-executed',
      proposal,
      reason: 'No local tool executor is available for recovery.',
      stage: 'executor',
    };
  }

  const route = buildAgentPermissionRoute(command);
  const toolName = command.toolCall?.name ?? command.kind;
  options.appendTraceEvent({
    details: {
      requiresApproval: route.requiresApproval,
      routeSummary: route.summary,
    },
    status: route.status,
    stepIndex: options.stepIndex,
    summary: `Permission route evaluated ${toolName}.`,
    tool: toolName,
    type: 'permission_routed',
  });
  if (route.blockedStep || route.requiresApproval) {
    return {
      kind: 'not-executed',
      proposal,
      reason: route.summary,
      stage: 'permission',
    };
  }

  const authorization = options.authorizeRecovery?.({
    kind: options.kind,
    reason: options.reason,
    requestedLimit: options.requestedLimit,
    sourceText: options.sourceText,
    taskState: options.taskState ?? null,
    userGoal: options.userGoal,
  }) ?? null;
  if (authorization) {
    options.onAuthorization?.(authorization);
    if (!authorization.allowed) {
      return {
        authorization,
        kind: 'authorization-denied',
        proposal,
        reason: authorization.reason,
      };
    }
  }

  const stopReason = options.timingTracker.getBudgetStopReason(1);
  if (stopReason) {
    options.timingTracker.markStopReason(stopReason);
    return {
      kind: 'budget-exceeded',
      proposal,
      reason: `Recovery stopped before dispatch because the Runtime budget reached ${stopReason}.`,
      stopReason,
    };
  }

  const presentation = createRecoveryPresentation(options.kind, command);
  const started: AgentRecoveryExecutionStarted = {
    progressEvent: {
      command,
      message: presentation.runningMessage,
      stepIndex: options.stepIndex,
      taskTransition: { kind: 'recovery-started' },
      type: 'tools-running',
    },
    step: {
      action: 'tool_call',
      args: command.toolCall?.input ?? {},
      index: options.stepIndex,
      reason: presentation.stepReason,
      summary: presentation.stepSummary,
      tool: toolName,
    },
  };
  options.onStarted?.(started);

  const transaction = await runAgentToolTransaction({
    appendTraceEvent: options.appendTraceEvent,
    command,
    executeCommand: options.executeCommand,
    getTimingDetail: options.getTimingDetail,
    resolveTimingStatus: options.resolveTimingStatus,
    source: options.traceSource,
    stepIndex: options.stepIndex,
    timingTracker: options.timingTracker,
    traceDetails: options.postActionState
      ? { postActionState: options.postActionState }
      : undefined,
  });
  if (options.isCancellationRequested()) {
    return {
      kind: 'cancelled',
      proposal,
      reason: 'Recovery tool returned after Runtime cancellation.',
    };
  }

  const entry: AgentRuntimeToolResultEntry = {
    command,
    result: transaction.result,
    timing: transaction.timing,
  };
  const collected: AgentRecoveryExecutionCollected = {
    entry,
    progressEvent: {
      command,
      message: presentation.resultMessage(transaction.result.ok !== false),
      stepIndex: options.stepIndex + 1,
      taskTransition: { kind: 'recovery-collected' },
      type: 'tool-result',
    },
    step: {
      action: 'tool_result',
      errorText: transaction.result.errorText ?? null,
      index: options.stepIndex + 1,
      ok: transaction.result.ok !== false,
      summary: transaction.result.responseText,
      timing: transaction.timing,
      tool: toolName,
    },
  };
  options.onCollected?.(collected);
  return {
    authorization,
    collected,
    kind: 'executed',
    proposal,
    reason: 'Recovery command executed and returned read-only evidence.',
    started,
  };
}
