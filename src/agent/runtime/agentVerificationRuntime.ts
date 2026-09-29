import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentToolCallName,
} from '../agentChatCommand';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import {
  createAgentPostApprovalVerificationResultMessage,
  createAgentPostApprovalVerificationRunningMessage,
  createAgentPostApprovalVerificationStepReason,
  createAgentPostApprovalVerificationStepSummary,
} from './agentExecutionProgressSignals';
import {
  createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage,
  hasAgentDirectActionIntent,
  isAgentActionKindCovered,
  type AgentActionCoverageDependencies,
} from './agentActionCoverage';
import {
  resolveAgentEvidencePostActionState,
} from './agentEvidenceEngine';
import {
  inferAgentSelectionPostActionStateFromStructuredEvidence,
} from './agentPostActionStateResolver';
import {
  type AgentRuntimeProgressEvent,
  type AgentRuntimeStep,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';
import {
  selectAgentTaskRuntimeNextTransition,
  type AgentTaskRuntimeTransitionState,
} from './agentTaskRuntime';
import {
  runAgentToolTransaction,
  type AgentToolTransactionBudgetPort,
} from './agentToolTransactionExecutor';

export const AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER = 'AgentRuntime post-action verification';

const AGENT_VERIFICATION_ACTION_TOOLS = new Set<AgentToolCallName>([
  'execute_desktop_action',
  'execute_desktop_input',
  'execute_desktop_sequence',
]);

function normalizeToolAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function getInputString(command: AgentChatCommand, key: string) {
  const value = command.toolCall?.input?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getDesktopSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return [];
  }
  const stepsJson = getInputString(command, 'stepsJson');
  if (!stepsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(stepsJson) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasDisplayTarget(args: Record<string, unknown>) {
  return ['targetDisplay', 'displayId', 'display', 'displayTarget', 'screen', 'screenTarget']
    .some((key) => typeof args[key] === 'string' && Boolean((args[key] as string).trim()));
}

function isMoveWindowSequenceStep(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const step = value as Record<string, unknown>;
  if (step.tool !== 'execute_desktop_action') {
    return false;
  }
  const rawArgs = step.args ?? step.input;
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    return false;
  }
  const args = rawArgs as Record<string, unknown>;
  const action = normalizeToolAction(args.action);
  if (action === 'control_window') {
    return hasDisplayTarget(args);
  }
  return [
    'move_window',
    'open_or_focus_then_control_window',
    'open_then_control_window',
    'launch_then_control_window',
    'focus_then_control_window',
    'open_or_focus_then_move_window_to_display',
    'open_then_move_window_to_display',
    'launch_then_move_window_to_display',
    'move_window_to_display',
    'move_window_to_screen',
    'move_window_to_monitor',
  ].includes(action);
}

function isMoveWindowToDisplayCommand(command: AgentChatCommand) {
  if (getDesktopSequenceSteps(command).some(isMoveWindowSequenceStep)) {
    return true;
  }
  if (command.toolCall?.name !== 'execute_desktop_action') {
    return false;
  }
  const input = command.toolCall.input ?? {};
  const action = normalizeToolAction(input.action);
  if (action === 'control_window' || action === 'open_or_focus_then_control_window') {
    return hasDisplayTarget(input);
  }
  return [
    'move_window',
    'open_or_focus_then_control_window',
    'open_then_control_window',
    'launch_then_control_window',
    'focus_then_control_window',
    'open_or_focus_then_move_window_to_display',
    'open_then_move_window_to_display',
    'launch_then_move_window_to_display',
    'move_window_to_display',
    'move_window_to_screen',
    'move_window_to_monitor',
  ].includes(action);
}

function resolveVerificationQuery(
  command: AgentChatCommand,
  sourceText: string,
  userGoal: string,
) {
  const input = command.toolCall?.input ?? {};
  const candidates = [
    input.postVerifyVisualQuery,
    input.visualVerifyQuery,
    input.visualQuery,
    input.postVerifyQuery,
    input.verifyQuery,
    input.query,
    input.target,
    input.name,
    input.title,
    sourceText,
    userGoal,
  ];
  return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.toString().trim() ?? '';
}

function hasRecommendedRecoveryTool(
  entry: AgentRuntimeToolResultEntry,
  toolName: AgentToolCallName,
) {
  const recoveryItems = [
    ...(entry.result.stateSummary?.recommendedRecovery ?? []),
    ...(entry.result.receipt?.stateSummary?.recommendedRecovery ?? []),
  ];
  return recoveryItems.some((item) => (
    normalizeToolAction(item.replace(/^tool:/iu, '')) === toolName
  ));
}

function shouldUseWindowObservation(entry: AgentRuntimeToolResultEntry) {
  if (isMoveWindowToDisplayCommand(entry.command)) {
    return true;
  }
  const toolName = entry.command.toolCall?.name ?? null;
  if (toolName !== 'execute_desktop_action' && toolName !== 'execute_desktop_sequence') {
    return false;
  }
  const action = normalizeToolAction(entry.command.toolCall?.input.action);
  if (toolName === 'execute_desktop_sequence' && !action) {
    return false;
  }
  return [
    'launch_local_app',
    'open_app',
    'start_app',
    'open_resource',
    'focus_window',
    'control_window',
    'move_window',
    'move_window_to_display',
    'move_window_to_screen',
    'move_window_to_monitor',
  ].includes(action)
    || (
      toolName === 'execute_desktop_action'
      && hasRecommendedRecoveryTool(entry, 'observe_windows_and_apps')
    );
}

export function isAgentRuntimePostActionVerificationCommand(command: AgentChatCommand) {
  if (command.toolCall?.name === 'observe_windows_and_apps') {
    const reason = command.toolCall.input.recoveryReason;
    return typeof reason === 'string'
      && reason.includes(AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER);
  }
  if (command.toolCall?.name === 'execute_desktop_observation') {
    const question = command.toolCall.input.question;
    return normalizeToolAction(command.toolCall.input.action) === 'summarize_visual_snapshot'
      && typeof question === 'string'
      && question.includes(AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER);
  }
  return false;
}

function hasPostActionVerificationRun(toolResults: AgentRuntimeToolResultEntry[]) {
  return toolResults.some((entry) => isAgentRuntimePostActionVerificationCommand(entry.command));
}

export type AgentVerificationCommandOutcome =
  | { command: AgentChatCommand; kind: 'command'; reason: string }
  | { command: null; kind: 'not-selected'; reason: string };

export function resolveAgentVerificationCommand(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  taskState?: AgentTaskRuntimeTransitionState | null;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentVerificationCommandOutcome {
  const transition = selectAgentTaskRuntimeNextTransition({ taskState: options.taskState });
  if (transition.kind !== 'compatibility' && transition.kind !== 'verification') {
    return {
      command: null,
      kind: 'not-selected',
      reason: `${transition.reason} Verification was not selected.`,
    };
  }

  const latestEntry = options.latestEntry;
  if (!latestEntry || latestEntry.result.ok === false) {
    return { command: null, kind: 'not-selected', reason: 'No successful action result is available to verify.' };
  }
  if (!hasAgentDirectActionIntent(options.sourceText, options.userGoal)) {
    return { command: null, kind: 'not-selected', reason: 'The task does not request a direct action.' };
  }
  const toolName = latestEntry.command.toolCall?.name;
  if (!toolName || !AGENT_VERIFICATION_ACTION_TOOLS.has(toolName)) {
    return { command: null, kind: 'not-selected', reason: 'The latest result is not a verifiable desktop action.' };
  }

  const requestedCoverage = createAgentRequestedActionCoverage({
    dependencies: options.actionCoverageDependencies,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const attemptedCoverage = createAgentAttemptedActionCoverage({
    dependencies: options.actionCoverageDependencies,
    toolResults: options.toolResults,
  });
  const hasMissingCoverage = [...requestedCoverage].some((kind) => (
    !isAgentActionKindCovered(kind, attemptedCoverage)
  ));
  if (
    options.actionCoverageDependencies.isVerifiedTargetWindowObservation(latestEntry)
    && !hasMissingCoverage
  ) {
    return { command: null, kind: 'not-selected', reason: 'The target window is already verified with complete coverage.' };
  }
  if (
    resolveAgentEvidencePostActionState(latestEntry)
    || inferAgentSelectionPostActionStateFromStructuredEvidence(latestEntry)
  ) {
    return { command: null, kind: 'not-selected', reason: 'Existing structured evidence already classifies the post-action state.' };
  }
  if (
    isAgentRuntimePostActionVerificationCommand(latestEntry.command)
    || hasPostActionVerificationRun(options.toolResults)
  ) {
    return { command: null, kind: 'not-selected', reason: 'Post-action verification already ran in this cycle.' };
  }

  const query = resolveVerificationQuery(latestEntry.command, options.sourceText, options.userGoal);
  if (shouldUseWindowObservation(latestEntry)) {
    return {
      command: {
        capabilityId: 'desktop-observation',
        instruction: options.userGoal,
        kind: 'tool-call',
        sourceText: options.sourceText,
        toolCall: {
          goal: options.userGoal,
          input: {
            forceRefresh: true,
            includeActiveWindow: true,
            includeDisplays: true,
            includeRunningApps: true,
            includeInstalledApps: false,
            includeTaskbarPinned: false,
            limit: 30,
            ...(query ? { query } : {}),
            recoveryReason: [
              AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER,
              'After the approved desktop action, read current app/window/display state before deciding whether the user-level goal is verified.',
            ].join(' '),
          },
          name: 'observe_windows_and_apps',
        },
      },
      kind: 'command',
      reason: 'The approved action requires a fresh window/app state verification.',
    };
  }

  return {
    command: {
      capabilityId: 'desktop-observation',
      instruction: options.userGoal,
      kind: 'tool-call',
      sourceText: options.sourceText,
      toolCall: {
        goal: options.userGoal,
        input: {
          action: 'summarize_visual_snapshot',
          allowScreenFallback: true,
          forceRefresh: true,
          includeCaptureThumbnails: true,
          question: [
            AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER,
            'After the approved desktop action, inspect the current visible UI state.',
            query ? `Expected target/content: ${query}.` : '',
            'Classify whether the user-level target appears launched/opened, loading, login_required, updating/downloading, error, unchanged, blocked, or unknown.',
            'Return structuredEvidence.postActionState when possible and include visible recovery clues. Do not mark launched unless the expected target/content is visibly open or running.',
          ].filter(Boolean).join(' '),
          ...(query ? { query } : {}),
          sourceType: 'all',
        },
        name: 'execute_desktop_observation',
      },
    },
    kind: 'command',
    reason: 'The approved action requires fresh visual post-action verification.',
  };
}

export type AgentVerificationProgressEvent = Omit<AgentRuntimeProgressEvent, 'continuation'>;

export interface AgentVerificationExecutionStarted {
  progressEvent: AgentVerificationProgressEvent;
  step: AgentRuntimeStep;
}

export interface AgentVerificationExecutionCollected {
  entry: AgentRuntimeToolResultEntry;
  progressEvent: AgentVerificationProgressEvent;
  step: AgentRuntimeStep;
}

export type AgentVerificationExecutionOutcome =
  | { kind: 'not-executed'; reason: string; stage: 'selection' | 'permission' }
  | { kind: 'budget-exceeded'; reason: string; stopReason: AgentRuntimeTimingStopReason }
  | { kind: 'cancelled'; reason: string }
  | { collected: AgentVerificationExecutionCollected; kind: 'executed'; reason: string };

export async function runAgentVerificationExecution(options: {
  actionCoverageDependencies: AgentActionCoverageDependencies;
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  executeCommand: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
  getTimingDetail: (command: AgentChatCommand) => string;
  isCancellationRequested: () => boolean;
  latestEntry: AgentRuntimeToolResultEntry | null;
  onCollected?: (event: AgentVerificationExecutionCollected) => void;
  onStarted?: (event: AgentVerificationExecutionStarted) => void;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  sourceText: string;
  stepIndex: number;
  taskState?: AgentTaskRuntimeTransitionState | null;
  timingTracker: AgentToolTransactionBudgetPort;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): Promise<AgentVerificationExecutionOutcome> {
  const resolution = resolveAgentVerificationCommand(options);
  const command = resolution.command;
  if (!command) {
    return { kind: 'not-executed', reason: resolution.reason, stage: 'selection' };
  }

  const permissionRoute = buildAgentPermissionRoute(command);
  const toolName = command.toolCall?.name ?? command.kind;
  options.appendTraceEvent({
    details: {
      requiresApproval: permissionRoute.requiresApproval,
      routeSummary: permissionRoute.summary,
    },
    status: permissionRoute.status,
    stepIndex: options.stepIndex,
    summary: `Permission route evaluated ${toolName}.`,
    tool: toolName,
    type: 'permission_routed',
  });
  if (permissionRoute.blockedStep || permissionRoute.requiresApproval) {
    return { kind: 'not-executed', reason: permissionRoute.summary, stage: 'permission' };
  }

  const stopReason = options.timingTracker.getBudgetStopReason(1);
  if (stopReason) {
    options.timingTracker.markStopReason(stopReason);
    return {
      kind: 'budget-exceeded',
      reason: `Verification stopped before dispatch because the Runtime budget reached ${stopReason}.`,
      stopReason,
    };
  }

  const started: AgentVerificationExecutionStarted = {
    progressEvent: {
      command,
      message: createAgentPostApprovalVerificationRunningMessage(),
      stepIndex: options.stepIndex,
      taskTransition: { kind: 'verification-started' },
      type: 'tools-running',
    },
    step: {
      action: 'tool_call',
      args: command.toolCall?.input ?? {},
      index: options.stepIndex,
      reason: createAgentPostApprovalVerificationStepReason(),
      summary: createAgentPostApprovalVerificationStepSummary(),
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
    source: 'post-approval-verification',
    stepIndex: options.stepIndex,
    timingTracker: options.timingTracker,
  });
  if (options.isCancellationRequested()) {
    return { kind: 'cancelled', reason: 'Verification tool returned after Runtime cancellation.' };
  }

  const entry: AgentRuntimeToolResultEntry = {
    command,
    result: transaction.result,
    timing: transaction.timing,
  };
  const collected: AgentVerificationExecutionCollected = {
    entry,
    progressEvent: {
      command,
      message: createAgentPostApprovalVerificationResultMessage({ ok: transaction.result.ok !== false }),
      stepIndex: options.stepIndex + 1,
      taskTransition: { kind: 'verification-collected' },
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
    reason: 'Verification command executed and returned post-action evidence.',
  };
}
