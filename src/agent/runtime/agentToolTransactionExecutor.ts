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
import {
  createAgentToolOutcomeContract,
  type AgentToolEffectState,
  type AgentToolOutcomeContract,
  type AgentToolVerificationState,
} from './agentToolOutcomeContract.ts';

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
  outcome?: AgentToolOutcomeContract;
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

const AGENT_READ_ONLY_TOOL_NAMES = new Set([
  'analyze_game_screen', 'browser_search', 'execute_desktop_observation',
  'get_active_window_info', 'get_cursor_position', 'get_default_app_for_uri',
  'get_display_info', 'get_path_info', 'get_system_info', 'list_capture_sources',
  'list_directory', 'list_mcp_tools', 'list_running_apps', 'locate_screen_elements',
  'observe_windows_and_apps', 'read_text_file', 'search_files', 'search_web',
  'summarize_visual_snapshot',
]);

const AGENT_NON_IDEMPOTENT_TOOL_NAMES = new Set([
  'call_mcp_tool', 'close_window', 'control_browser', 'execute_desktop_action',
  'execute_desktop_input', 'execute_desktop_sequence', 'execute_file_management_action',
  'execute_local_file_action', 'launch_local_app', 'open_resource',
  'organize_desktop_icons', 'place_desktop_icon', 'run_controlled_command',
  'run_local_project_action', 'update_pet_settings',
]);

function resolveOutcomeStates(toolName: string, result: AgentChatCommandResult) {
  const evidence = result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? null;
  const verification: AgentToolVerificationState = result.receipt?.status === 'blocked'
    ? 'blocked'
    : result.receipt?.status === 'success'
      ? 'satisfied'
      : result.receipt?.status === 'unverified'
        ? 'unknown'
          : result.receipt?.status === 'failed'
          ? 'blocked'
          : result.verification
            ? 'partial'
            : 'unknown';
  const effect: AgentToolEffectState = evidence?.outcome === 'changed'
    ? 'changed'
    : evidence?.outcome === 'no-op'
      ? 'no-op'
      : evidence?.outcome === 'blocked'
        ? 'none'
        : evidence?.outcome === 'uncertain'
          ? 'uncertain'
            : result.receipt?.status === 'success'
              ? 'none'
          : AGENT_READ_ONLY_TOOL_NAMES.has(toolName)
            ? 'none'
            : 'uncertain';
  return { effect, verification };
}

function createTransactionOutcome(command: AgentChatCommand, result: AgentChatCommandResult) {
  const toolName = getAgentToolTransactionToolName(command);
  if (result.receipt?.status === 'blocked') {
    return createAgentToolOutcomeContract({ execution: 'blocked', effect: 'none', verification: 'blocked' });
  }
  const { effect: evidenceEffect, verification } = resolveOutcomeStates(toolName, result);
  const effect = AGENT_READ_ONLY_TOOL_NAMES.has(toolName) && !result.stateSummary?.actionEvidence
    ? 'none'
    : evidenceEffect;
  return createAgentToolOutcomeContract({
    effect,
    execution: 'executed',
    nonIdempotentSideEffect: AGENT_NON_IDEMPOTENT_TOOL_NAMES.has(toolName),
    verification,
  });
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
  const outcome = extra?.outcome as AgentToolOutcomeContract | undefined;
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
    outcomeClass: outcome?.classification,
    outcomeEffect: outcome?.effect,
    outcomeExecution: outcome?.execution,
    retryPolicy: outcome?.retryPolicy,
    uncertainEffects: outcome?.uncertainEffects,
    outcomeVerification: outcome?.verification,
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
  const outcome = createTransactionOutcome(options.command, result);
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
        outcome,
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
    outcome,
    result,
    timing: finishedTiming,
  };
}
