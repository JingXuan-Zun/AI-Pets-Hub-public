import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import {
  createAgentVisualRefinementResultMessage,
  createAgentVisualRefinementRunningMessage,
  createAgentVisualRefinementStepReason,
  createAgentVisualRefinementStepSummary,
} from './agentExecutionProgressSignals';
import {
  type AgentRuntimeProgressEvent,
  type AgentRuntimeStep,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';
import {
  runAgentToolTransaction,
  type AgentToolTransactionBudgetPort,
} from './agentToolTransactionExecutor';

export interface AgentVisualRefinementExecutionStarted {
  progressEvent: Omit<AgentRuntimeProgressEvent, 'continuation'>;
  step: AgentRuntimeStep;
}

export interface AgentVisualRefinementExecutionCollected {
  entry: AgentRuntimeToolResultEntry;
  progressEvent: Omit<AgentRuntimeProgressEvent, 'continuation'>;
  step: AgentRuntimeStep;
}

export type AgentVisualRefinementExecutionOutcome =
  | { kind: 'not-executed'; reason: string; stage: 'selection' | 'executor' | 'permission' }
  | { kind: 'budget-exceeded'; reason: string; stopReason: AgentRuntimeTimingStopReason }
  | { kind: 'cancelled'; reason: string }
  | {
      collected: AgentVisualRefinementExecutionCollected;
      kind: 'executed';
      reason: string;
      started: AgentVisualRefinementExecutionStarted;
    };

export async function runAgentVisualRefinementExecution(options: {
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  command: AgentChatCommand | null;
  executeCommand?: ((command: AgentChatCommand) => Promise<AgentChatCommandResult>) | null;
  getTimingDetail: (command: AgentChatCommand) => string;
  isCancellationRequested: () => boolean;
  onCollected?: (event: AgentVisualRefinementExecutionCollected) => void;
  onStarted?: (event: AgentVisualRefinementExecutionStarted) => void;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  stepIndex: number;
  timingTracker: AgentToolTransactionBudgetPort;
}): Promise<AgentVisualRefinementExecutionOutcome> {
  const command = options.command;
  if (!command) {
    return { kind: 'not-executed', reason: 'No visual refinement command was selected.', stage: 'selection' };
  }
  if (!options.executeCommand) {
    return { kind: 'not-executed', reason: 'No local tool executor is available for visual refinement.', stage: 'executor' };
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
    return { kind: 'not-executed', reason: route.summary, stage: 'permission' };
  }

  const stopReason = options.timingTracker.getBudgetStopReason(1);
  if (stopReason) {
    options.timingTracker.markStopReason(stopReason);
    return {
      kind: 'budget-exceeded',
      reason: `Visual refinement stopped before dispatch because the Runtime budget reached ${stopReason}.`,
      stopReason,
    };
  }

  const started: AgentVisualRefinementExecutionStarted = {
    progressEvent: {
      command,
      message: createAgentVisualRefinementRunningMessage(),
      stepIndex: options.stepIndex,
      taskTransition: { kind: 'target-resolution-started' },
      type: 'tools-running',
    },
    step: {
      action: 'tool_call',
      args: command.toolCall?.input ?? {},
      index: options.stepIndex,
      reason: createAgentVisualRefinementStepReason(),
      summary: createAgentVisualRefinementStepSummary(),
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
    source: 'visual-refinement',
    stepIndex: options.stepIndex,
    timingTracker: options.timingTracker,
  });
  if (options.isCancellationRequested()) {
    return { kind: 'cancelled', reason: 'Visual refinement tool returned after Runtime cancellation.' };
  }

  const entry: AgentRuntimeToolResultEntry = {
    command,
    result: transaction.result,
    timing: transaction.timing,
  };
  const collected: AgentVisualRefinementExecutionCollected = {
    entry,
    progressEvent: {
      command,
      message: createAgentVisualRefinementResultMessage({ ok: transaction.result.ok !== false }),
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
    reason: 'Visual refinement command executed and returned focused evidence.',
    started,
  };
}
