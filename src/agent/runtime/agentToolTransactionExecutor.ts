import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import {
  type AgentRuntimeDecisionAction,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';

export interface AgentToolTransactionTimingPort {
  beginEntry: (
    kind: 'tool',
    label: string,
    stepIndex: number,
    detail?: string | null,
  ) => AgentRuntimeTimingEntry;
  finishEntry: (
    entry: AgentRuntimeTimingEntry,
    status: AgentRuntimeTimingEntryStatus,
    detail?: string | null,
  ) => AgentRuntimeTimingEntry;
}

export interface AgentToolTransactionBudgetPort extends AgentToolTransactionTimingPort {
  getBudgetStopReason: (extraToolCalls?: number) => AgentRuntimeTimingStopReason | null;
  markStopReason: (reason: AgentRuntimeTimingStopReason) => void;
}

export interface AgentToolTransactionResult {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  timing: AgentRuntimeTimingEntry;
}

export interface RunAgentToolTransactionOptions {
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  command: AgentChatCommand;
  executeCommand: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
  getTimingDetail: (command: AgentChatCommand) => string;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  source?: string | null;
  stepIndex: number;
  timingTracker: AgentToolTransactionTimingPort;
  traceAction?: AgentRuntimeDecisionAction | null;
  traceDetails?: Record<string, unknown> | null;
}

function getAgentToolTransactionToolName(command: AgentChatCommand) {
  return command.toolCall?.name ?? command.kind;
}

function isAgentRuntimeCachedToolResult(result: AgentChatCommandResult) {
  const lines = [
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.stateSummary?.observedState ?? []),
  ];
  return lines.some((line) => /cache hit/iu.test(line));
}

function createAgentRuntimeVisualActionBlocker(value: unknown) {
  const readiness = typeof value === 'string' ? value.trim() : '';
  switch (readiness) {
    case 'needs-target-selection':
      return 'target-visible-but-not-selected-or-current';
    case 'needs-primary-action':
      return 'primary-open-start-play-action-not-identified';
    case 'needs-coordinate':
      return 'native-screen-coordinate-not-resolved';
    case 'needs-relation':
      return 'target-action-ownership-not-proven';
    case 'low-confidence':
      return 'visual-confidence-too-low';
    case 'not-actionable':
      return 'visible-evidence-not-actionable';
    default:
      return '';
  }
}

export function createAgentToolTransactionFinishedTraceDetails(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
  timing?: AgentRuntimeTimingEntry | null,
  extra?: Record<string, unknown>,
) {
  const stateSummary = result.stateSummary ?? result.receipt?.stateSummary ?? null;
  const actionEvidence = stateSummary?.actionEvidence ?? null;
  const structuredEvidence = stateSummary?.structuredEvidence ?? null;
  const visualActionReadiness = structuredEvidence?.visualActionReadiness ?? null;
  return {
    actionDiff: actionEvidence?.diff?.summary,
    actionOutcome: actionEvidence?.outcome,
    actionTarget: actionEvidence?.targetRef?.label,
    actionTool: actionEvidence?.tool,
    args: command.toolCall?.input ?? {},
    cacheHit: isAgentRuntimeCachedToolResult(result),
    durationMs: timing?.durationMs,
    errorText: result.errorText,
    ok: result.ok !== false,
    receiptStatus: result.receipt?.status,
    responseText: result.responseText,
    timingDetail: timing?.detail,
    timingStatus: timing?.status,
    verification: result.verification,
    visualActionBlocker: createAgentRuntimeVisualActionBlocker(visualActionReadiness),
    visualActionReadiness,
    launcherReason: structuredEvidence?.launcherVerification?.reason,
    ...extra,
  };
}

export async function runAgentToolTransaction(
  options: RunAgentToolTransactionOptions,
): Promise<AgentToolTransactionResult> {
  const toolName = getAgentToolTransactionToolName(options.command);
  const traceSource = options.source ?? null;
  const traceDetails = {
    args: options.command.toolCall?.input ?? {},
    ...(options.traceDetails ?? {}),
    ...(traceSource ? { source: traceSource } : {}),
  };

  options.appendTraceEvent({
    action: options.traceAction ?? null,
    details: traceDetails,
    status: 'running',
    stepIndex: options.stepIndex,
    summary: `Starting tool ${toolName}.`,
    tool: toolName,
    type: 'tool_started',
  });

  const timing = options.timingTracker.beginEntry(
    'tool',
    toolName,
    options.stepIndex,
    options.getTimingDetail(options.command),
  );
  let result: AgentChatCommandResult;
  try {
    result = await options.executeCommand(options.command);
  } catch (error) {
    result = {
      errorText: error instanceof Error ? error.message : String(error),
      ok: false,
      receipt: null,
      responseText: '',
    } as AgentChatCommandResult;
  }
  const timingStatus = options.resolveTimingStatus(result);
  const finishedTiming = options.timingTracker.finishEntry(
    {
      ...timing,
      label: toolName,
    },
    timingStatus,
    options.getTimingDetail(options.command),
  );

  options.appendTraceEvent({
    action: options.traceAction ?? null,
    details: createAgentToolTransactionFinishedTraceDetails(
      options.command,
      result,
      finishedTiming,
      {
        ...(options.traceDetails ?? {}),
        ...(traceSource ? { source: traceSource } : {}),
      },
    ),
    status: timingStatus,
    stepIndex: options.stepIndex,
    summary: `Finished tool ${toolName}.`,
    tool: toolName,
    type: 'tool_finished',
  });

  return {
    command: options.command,
    result,
    timing: finishedTiming,
  };
}
