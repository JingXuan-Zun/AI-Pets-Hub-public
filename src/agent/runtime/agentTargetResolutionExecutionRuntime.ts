import { type AgentChatCommandResult } from '../agentChatCommand';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import { type AgentActionCoverageDependencies } from './agentActionCoverage';
import {
  type AgentRuntimeProgressEvent,
  type AgentRuntimeStep,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';
import { type AgentTaskRuntimeTransitionState } from './agentTaskRuntime';
import {
  resolveAgentTargetResolution,
  type AgentTargetResolutionOutcome,
} from './agentTargetResolutionRuntime';
import {
  runAgentToolTransaction,
  type AgentToolTransactionBudgetPort,
} from './agentToolTransactionExecutor';

export type AgentTargetResolutionBudgetPort = AgentToolTransactionBudgetPort;

export type AgentTargetResolutionProgressEvent = Omit<
  AgentRuntimeProgressEvent,
  'continuation'
>;

export interface AgentTargetResolutionExecutionStarted {
  progressEvent: AgentTargetResolutionProgressEvent;
  step: AgentRuntimeStep;
}

export interface AgentTargetResolutionExecutionCollected {
  entry: AgentRuntimeToolResultEntry;
  progressEvent: AgentTargetResolutionProgressEvent;
  step: AgentRuntimeStep;
}

export type AgentTargetResolutionExecutionOutcome =
  | {
      kind: 'not-executed';
      reason: string;
      resolution: AgentTargetResolutionOutcome;
      stage: 'selection' | 'permission';
    }
  | {
      kind: 'budget-exceeded';
      reason: string;
      resolution: AgentTargetResolutionOutcome;
      stopReason: AgentRuntimeTimingStopReason;
    }
  | {
      kind: 'cancelled';
      reason: string;
      resolution: AgentTargetResolutionOutcome;
    }
  | {
      collected: AgentTargetResolutionExecutionCollected;
      kind: 'executed';
      reason: string;
      resolution: AgentTargetResolutionOutcome;
      started: AgentTargetResolutionExecutionStarted;
    };

export async function runAgentTargetResolutionExecution(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  executeCommand: (command: NonNullable<AgentTargetResolutionOutcome['command']>) => Promise<AgentChatCommandResult>;
  getTimingDetail: (command: NonNullable<AgentTargetResolutionOutcome['command']>) => string;
  isCancellationRequested: () => boolean;
  latestEntry: AgentRuntimeToolResultEntry | null;
  onCollected?: (event: AgentTargetResolutionExecutionCollected) => void;
  onStarted?: (event: AgentTargetResolutionExecutionStarted) => void;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  sourceText: string;
  stepIndex: number;
  taskState?: AgentTaskRuntimeTransitionState | null;
  timingTracker: AgentTargetResolutionBudgetPort;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): Promise<AgentTargetResolutionExecutionOutcome> {
  const resolution = resolveAgentTargetResolution({
    actionCoverageDependencies: options.actionCoverageDependencies,
    latestEntry: options.latestEntry,
    sourceText: options.sourceText,
    taskState: options.taskState,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });
  const command = resolution.command;
  if (!command) {
    return {
      kind: 'not-executed',
      reason: resolution.reason,
      resolution,
      stage: 'selection',
    };
  }

  const permissionRoute = buildAgentPermissionRoute(command);
  if (permissionRoute.blockedStep || permissionRoute.requiresApproval) {
    return {
      kind: 'not-executed',
      reason: permissionRoute.summary,
      resolution,
      stage: 'permission',
    };
  }

  const stopReason = options.timingTracker.getBudgetStopReason(1);
  if (stopReason) {
    options.timingTracker.markStopReason(stopReason);
    return {
      kind: 'budget-exceeded',
      reason: `Target resolution stopped before dispatch because the Runtime budget reached ${stopReason}.`,
      resolution,
      stopReason,
    };
  }

  const toolName = command.toolCall?.name ?? command.kind;
  const started: AgentTargetResolutionExecutionStarted = {
    progressEvent: {
      command,
      message: 'Locating the requested in-app target...',
      stepIndex: options.stepIndex,
      taskTransition: { kind: 'target-resolution-started' },
      type: 'tools-running',
    },
    step: {
      action: 'tool_call',
      args: command.toolCall?.input ?? {},
      index: options.stepIndex,
      reason: 'Locate the requested target inside the already-open app before continuing.',
      summary: 'Locate in-app target',
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
    source: 'in-app-target-locate',
    stepIndex: options.stepIndex,
    timingTracker: options.timingTracker,
  });

  if (options.isCancellationRequested()) {
    return {
      kind: 'cancelled',
      reason: 'Target resolution tool returned after Runtime cancellation.',
      resolution,
    };
  }

  const entry: AgentRuntimeToolResultEntry = {
    command,
    result: transaction.result,
    timing: transaction.timing,
  };
  const collected: AgentTargetResolutionExecutionCollected = {
    entry,
    progressEvent: {
      command,
      message: transaction.result.ok === false
        ? 'In-app target locate failed.'
        : 'In-app target locate returned evidence.',
      stepIndex: options.stepIndex + 1,
      taskTransition: { kind: 'target-resolution-collected' },
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
    collected,
    kind: 'executed',
    reason: 'Target resolution command executed and returned evidence.',
    resolution,
    started,
  };
}
