import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import {
  buildAgentPermissionRoute,
  type AgentPermissionRoute,
} from '../agentPermissionRouter';
import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeProgressEvent,
  type AgentRuntimeDecisionAction,
  type AgentRuntimeStep,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
  type AgentRuntimeUnderstanding,
} from './agentRuntimeContract';
import {
  createAgentRuntimeStaleTargetError,
  validateAgentRuntimeTargetBinding,
} from './agentRuntimeTargetGuard';
import { type AgentTaskRuntimeStateRecord } from './agentRuntimeContract';
import {
  runAgentToolTransaction,
  type AgentToolTransactionBudgetPort,
} from './agentToolTransactionExecutor';

export interface AgentCommandExecutionStarted {
  progressEvent: Omit<AgentRuntimeProgressEvent, 'continuation'>;
  step: AgentRuntimeStep;
}

export interface AgentCommandExecutionCollected {
  entry: AgentRuntimeToolResultEntry;
  progressEvent: Omit<AgentRuntimeProgressEvent, 'continuation'>;
  step: AgentRuntimeStep;
}

export type AgentCommandExecutionOutcome =
  | {
      errorText: string;
      kind: 'permission-blocked';
      route: AgentPermissionRoute;
    }
  | {
      errorText: string;
      kind: 'target-stale';
      route: AgentPermissionRoute;
    }
  | {
      approval: AgentRuntimePendingApproval;
      kind: 'approval-required';
      route: AgentPermissionRoute;
    }
  | {
      errorText: string;
      kind: 'executor-unavailable';
      route: AgentPermissionRoute;
    }
  | {
      kind: 'budget-exceeded';
      route: AgentPermissionRoute;
      stopReason: AgentRuntimeTimingStopReason;
    }
  | {
      kind: 'cancelled';
      route: AgentPermissionRoute;
    }
  | {
      collected: AgentCommandExecutionCollected;
      kind: 'executed';
      route: AgentPermissionRoute;
      started: AgentCommandExecutionStarted;
    };

export async function runAgentCommandExecution(options: {
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  approvalReason: (route: AgentPermissionRoute) => string;
  command: AgentChatCommand;
  executeCommand?: ((command: AgentChatCommand) => Promise<AgentChatCommandResult>) | null;
  getTimingDetail: (command: AgentChatCommand) => string;
  isCancellationRequested: () => boolean;
  onCollected?: (event: AgentCommandExecutionCollected) => void;
  onStarted?: (event: AgentCommandExecutionStarted) => void;
  permissionTraceSummary?: string | null;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  stepIndex: number;
  taskState?: Pick<AgentTaskRuntimeStateRecord, 'surface' | 'targetBinding' | 'runId' | 'taskId'> | null;
  timingTracker: AgentToolTransactionBudgetPort;
  traceAction?: AgentRuntimeDecisionAction | null;
  understanding?: AgentRuntimeUnderstanding | null;
}): Promise<AgentCommandExecutionOutcome> {
  const command = options.command;
  const toolName = command.toolCall?.name ?? command.kind;
  const route = buildAgentPermissionRoute(command);
  options.appendTraceEvent({
    action: options.traceAction ?? null,
    details: {
      requiresApproval: route.requiresApproval,
      routeSummary: route.summary,
    },
    status: route.status,
    stepIndex: options.stepIndex,
    summary: options.permissionTraceSummary?.trim() || `Permission route evaluated ${toolName}.`,
    tool: toolName,
    type: 'permission_routed',
  });

  if (route.blockedStep) {
    const errorText = `Permission blocked tool call: ${route.blockedStep.summary}. ${route.blockedStep.decision.reason}`;
    options.appendTraceEvent({
      action: options.traceAction ?? null,
      details: {
        blockedStep: route.blockedStep.summary,
        reason: route.blockedStep.decision.reason,
        routeSummary: route.summary,
      },
      status: 'permission-blocked',
      stepIndex: options.stepIndex,
      summary: `Permission policy blocked ${toolName}.`,
      tool: toolName,
      type: 'decision_rejected',
    });
    return { errorText, kind: 'permission-blocked', route };
  }

  const targetGuard = validateAgentRuntimeTargetBinding({
    command,
    state: options.taskState,
  });
  if (!targetGuard.allowed && targetGuard.targetBinding) {
    const errorText = createAgentRuntimeStaleTargetError({
      surface: options.taskState?.surface,
      targetBinding: targetGuard.targetBinding,
    });
    options.appendTraceEvent({
      action: options.traceAction ?? null,
      details: {
        currentSurfaceGeneration: options.taskState?.surface?.generation ?? null,
        currentSurfaceId: options.taskState?.surface?.surfaceId ?? null,
        reason: targetGuard.reason,
        targetSurfaceGeneration: targetGuard.targetBinding.surfaceGeneration,
        targetSurfaceId: targetGuard.targetBinding.surfaceId,
      },
      status: 'target-stale',
      stepIndex: options.stepIndex,
      summary: `Runtime rejected ${toolName} because the target binding is stale.`,
      tool: toolName,
      type: 'decision_rejected',
    });
    return { errorText, kind: 'target-stale', route };
  }

  if (route.requiresApproval && route.plan) {
    const reason = options.approvalReason(route);
    return {
      approval: {
        command,
        plan: route.plan,
        reason,
        routeSummary: route.summary,
        runId: options.taskState?.runId ?? null,
        surfaceGeneration: options.taskState?.surface?.generation ?? null,
        surfaceId: options.taskState?.surface?.surfaceId ?? null,
        taskId: options.taskState?.taskId ?? null,
      },
      kind: 'approval-required',
      route,
    };
  }

  if (!options.executeCommand) {
    return {
      errorText: 'No local tool executor is available.',
      kind: 'executor-unavailable',
      route,
    };
  }

  const stopReason = options.timingTracker.getBudgetStopReason(1);
  if (stopReason) {
    options.timingTracker.markStopReason(stopReason);
    return { kind: 'budget-exceeded', route, stopReason };
  }

  const started: AgentCommandExecutionStarted = {
    progressEvent: {
      command,
      message: `Agent is running ${toolName}.`,
      stepIndex: options.stepIndex,
      taskTransition: { kind: 'observation-started' },
      type: 'tools-running',
    },
    step: {
      action: 'tool_call',
      args: command.toolCall?.input ?? {},
      index: options.stepIndex,
      reason: command.instruction,
      summary: `Run ${toolName}`,
      tool: toolName,
      understanding: options.understanding ?? null,
    },
  };
  options.onStarted?.(started);

  const transaction = await runAgentToolTransaction({
    appendTraceEvent: options.appendTraceEvent,
    command,
    executeCommand: options.executeCommand,
    getTimingDetail: options.getTimingDetail,
    resolveTimingStatus: options.resolveTimingStatus,
    stepIndex: options.stepIndex,
    timingTracker: options.timingTracker,
    traceAction: options.traceAction ?? null,
  });
  if (options.isCancellationRequested()) {
    return { kind: 'cancelled', route };
  }

  const entry: AgentRuntimeToolResultEntry = {
    command,
    result: transaction.result,
    timing: transaction.timing,
  };
  const collected: AgentCommandExecutionCollected = {
    entry,
    progressEvent: {
      command,
      message: transaction.result.ok === false
        ? `Agent received a failed result from ${toolName}.`
        : `Agent received a result from ${toolName}.`,
      stepIndex: options.stepIndex + 1,
      taskTransition: { kind: 'observation-collected' },
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
      understanding: options.understanding ?? null,
    },
  };
  options.onCollected?.(collected);
  return { collected, kind: 'executed', route, started };
}
