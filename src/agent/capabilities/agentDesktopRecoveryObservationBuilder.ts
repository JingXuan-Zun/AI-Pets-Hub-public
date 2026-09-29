import {
  type AgentChatCommand,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry as AgentDesktopToolResultEntry,
} from '../runtime/agentRuntimeContract';
import {
  getAgentPostActionState as getAgentDesktopPostActionState,
  getAgentStructuredEvidence as getAgentDesktopStructuredEvidence,
} from '../runtime/agentToolEvidence';
import {
  countAgentRecoveryStrategyRuns as countAgentDesktopRecoveryStrategyRuns,
  getAgentRecoveryStrategyBudget as getAgentDesktopRecoveryStrategyBudget,
} from '../runtime/agentRecoveryStrategyBudget';
import { resolveAgentDesktopAutoRecoveryQuery } from './agentDesktopRecoveryCommandBuilder';
import { createAgentToolCommand as createAgentDesktopToolCommand } from '../runtime/agentToolCommandFactory';

export const AGENT_DESKTOP_AUTO_RECOVERY_MARKER = 'AgentSessionV2 auto recovery observation';

const AGENT_DESKTOP_AUTO_RECOVERY_LOADING_MAX_WAITS = 3;
const AGENT_DESKTOP_AUTO_RECOVERY_UPDATING_MAX_WAITS = 2;
const AGENT_DESKTOP_AUTO_RECOVERY_UNKNOWN_MAX_WAITS = 1;
const AGENT_DESKTOP_AUTO_RECOVERY_WAITING_WINDOW_MAX_WAITS = 2;
const AGENT_DESKTOP_AUTO_RECOVERY_WAITING_TARGET_MAX_WAITS = 5;
const AGENT_DESKTOP_AUTO_RECOVERY_PROGRESS_EXTRA_WAITS_BY_STATE: Record<string, number> = {
  loading: 1,
  updating: 2,
  waiting_target: 1,
};
const AGENT_DESKTOP_AUTO_RECOVERY_READ_MAX_RUNS = 1;
const AGENT_DESKTOP_AUTO_RECOVERY_WAIT_MS_BY_STATE: Record<string, number[]> = {
  loading: [2500, 4000, 6500],
  unknown: [1000],
  updating: [5000, 8000],
  waiting_target: [3000, 5000, 7000, 8000, 8000],
  waiting_window: [600, 1200],
};

export interface AgentDesktopAutoRecoveryObservationBuilderDependencies {
  resolvePostActionState: (options: {
    entry: AgentDesktopToolResultEntry | null;
    sourceText: string;
    userGoal: string;
  }) => string;
}

type AgentDesktopAutoRecoveryProgressSnapshot = {
  numericSignals: string[];
  phaseSignals: string[];
};

function getAgentDesktopToolInputAction(command: AgentChatCommand) {
  const action = command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
}

function normalizeAgentDesktopToolActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
}

function createAgentDesktopVisualTimeoutRecoveryCommand(options: {
  latestEntry: AgentDesktopToolResultEntry;
  sourceText: string;
  userGoal: string;
}) {
  const command = options.latestEntry.command;
  if (
    command.toolCall?.name !== 'execute_desktop_observation'
    || getAgentDesktopToolInputAction(command) !== 'wait_and_observe'
  ) {
    return null;
  }

  const evidence = getAgentDesktopStructuredEvidence(options.latestEntry);
  const text = [
    options.latestEntry.result.responseText,
    options.latestEntry.result.verification,
    ...(options.latestEntry.result.observations ?? []),
    ...(options.latestEntry.result.stateSummary?.observedState ?? []),
    ...(options.latestEntry.result.stateSummary?.verificationEvidence ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
  if (!/(?:supplemental\s+visual\s+observation\s+timed\s+out|visual\s+(?:observation|capture)\s+timed\s+out|视觉(?:补充|观察|捕获).{0,12}超时)/iu.test(text)) {
    return null;
  }

  const finalWindow = evidence?.finalWindow;
  const hwnd = Number(finalWindow?.hwnd ?? command.toolCall.input.hwnd);
  if (!Number.isFinite(hwnd) || hwnd <= 0) {
    return null;
  }
  const sourceQuery = finalWindow?.title?.trim()
    || finalWindow?.processName?.trim()
    || (typeof command.toolCall.input.query === 'string' ? command.toolCall.input.query.trim() : '')
    || options.userGoal.trim()
    || '';
  if (!sourceQuery) {
    return null;
  }

  return createAgentDesktopToolCommand({
    args: {
      action: 'locate_element',
      allowScreenFallback: false,
      forceRefresh: true,
      hwnd: Math.round(hwnd),
      question: [
        AGENT_DESKTOP_AUTO_RECOVERY_MARKER,
        'The window/process is present, but the supplemental visual observation timed out.',
        `Use a fresh window-level capture for ${sourceQuery}; do not repeat wait_and_observe.` ,
        `Locate the current task target or the next safe actionable control for: ${options.userGoal}.`,
        'Return window bounds, target/action candidates, coordinates, confidence, and any login/loading/blocker state. Do not click.',
      ].join(' '),
      recoveryReason: `${AGENT_DESKTOP_AUTO_RECOVERY_MARKER}: visual timeout with live window evidence`,
      sourceQuery,
      sourceType: 'window',
      targetDescription: options.userGoal,
      targetText: options.userGoal,
    },
    sourceText: options.sourceText,
    toolName: 'locate_screen_elements',
    userGoal: options.userGoal,
  });
}

export function isAgentDesktopAutoRecoveryWaitCommand(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_observation') {
    return false;
  }

  const input = command.toolCall.input ?? {};
  return getAgentDesktopToolInputAction(command) === 'wait_and_observe'
    && typeof input.question === 'string'
    && input.question.includes(AGENT_DESKTOP_AUTO_RECOVERY_MARKER);
}

export function isAgentDesktopAutoRecoveryReadCommand(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'locate_screen_elements' && command.toolCall?.name !== 'observe_windows_and_apps') {
    return false;
  }

  const input = command.toolCall.input ?? {};
  return (
    typeof input.question === 'string'
    && input.question.includes(AGENT_DESKTOP_AUTO_RECOVERY_MARKER)
  ) || (
    typeof input.recoveryReason === 'string'
    && input.recoveryReason.includes(AGENT_DESKTOP_AUTO_RECOVERY_MARKER)
  ) || (
    typeof input.recoveryReadPurpose === 'string'
    && input.recoveryReadPurpose.trim().length > 0
  );
}

export function isAgentDesktopAutoRecoveryWaitCapReadCommand(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'locate_screen_elements' && command.toolCall?.name !== 'observe_windows_and_apps') {
    return false;
  }

  const input = command.toolCall.input ?? {};
  return (
    typeof input.question === 'string'
    && input.question.includes(AGENT_DESKTOP_AUTO_RECOVERY_MARKER)
    && input.question.includes('Automatic wait budget for this state is exhausted')
  ) || (
    typeof input.recoveryReadPurpose === 'string'
    && input.recoveryReadPurpose.trim().toLowerCase().startsWith('wait-cap:')
  );
}

export function isAgentDesktopAutoRecoveryCommand(command: AgentChatCommand) {
  return isAgentDesktopAutoRecoveryWaitCommand(command)
    || isAgentDesktopAutoRecoveryReadCommand(command);
}

function getAgentDesktopAutoRecoveryQuestionState(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const explicitState = typeof input.recoveryPostActionState === 'string'
    ? input.recoveryPostActionState.trim().toLowerCase()
    : '';
  if (explicitState) {
    return explicitState;
  }

  const question = typeof input.question === 'string' ? input.question : '';
  const match = question.match(/Post-action state is\s+([a-z_]+)/iu);
  return match?.[1]?.trim().toLowerCase() ?? '';
}

export function countAgentDesktopAutoRecoveryWaits(
  toolResults: AgentDesktopToolResultEntry[],
  postActionState?: string,
) {
  const normalizedState = postActionState?.trim().toLowerCase() ?? '';
  return toolResults.filter((entry) => {
    if (!isAgentDesktopAutoRecoveryWaitCommand(entry.command)) {
      return false;
    }

    if (!normalizedState) {
      return true;
    }

    const commandState = getAgentDesktopAutoRecoveryQuestionState(entry.command);
    return !commandState || commandState === normalizedState;
  }).length;
}

function normalizeAgentDesktopAutoRecoveryReadPurpose(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/gu, '-')
    : '';
}

function isAgentDesktopSelectionRecoveryState(postActionState: string) {
  return postActionState === 'selection_mismatch'
    || postActionState === 'visible_only';
}

function inferAgentDesktopAutoRecoveryReadPurpose(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const explicitPurpose = normalizeAgentDesktopAutoRecoveryReadPurpose(input.recoveryReadPurpose);
  if (explicitPurpose) {
    return explicitPurpose;
  }

  const state = getAgentDesktopAutoRecoveryQuestionState(command);
  const question = typeof input.question === 'string'
    ? input.question.normalize('NFKC').toLowerCase()
    : '';
  if (
    /already\s+(?:confirmed\s+)?selected\/current|selected\s+target\s+detail|primary\s+(?:open|start|play|launch)\s+action/iu.test(question)
  ) {
    return 'selected-target-primary-action';
  }

  if (
    isAgentDesktopSelectionRecoveryState(state)
    || (
      /current\s+selected\/detail\s+item|selection\s+state|selected\/current/iu.test(question)
      && /do\s+not\s+(?:click|look\s+for\s+the\s+primary)/iu.test(question)
    )
  ) {
    return 'target-selection-state';
  }

  if (isAgentDesktopAutoRecoveryWaitCapReadCommand(command)) {
    return `wait-cap:${state || 'unknown'}`;
  }

  return `post-action-state:${state || 'unknown'}`;
}

function countAgentDesktopAutoRecoveryReads(
  toolResults: AgentDesktopToolResultEntry[],
  purpose?: string | null,
) {
  const normalizedPurpose = normalizeAgentDesktopAutoRecoveryReadPurpose(purpose);
  return toolResults.filter((entry) => (
    isAgentDesktopAutoRecoveryReadCommand(entry.command)
    && (
      !normalizedPurpose
      || inferAgentDesktopAutoRecoveryReadPurpose(entry.command) === normalizedPurpose
    )
  )).length;
}

function hasAgentDesktopAutoRecoveryReadBudget(
  toolResults: AgentDesktopToolResultEntry[],
  purpose: string,
) {
  return countAgentDesktopAutoRecoveryReads(toolResults, purpose) < AGENT_DESKTOP_AUTO_RECOVERY_READ_MAX_RUNS;
}

export function collectAgentDesktopAutoRecoveryEvidenceText(
  entry: AgentDesktopToolResultEntry | null | undefined,
) {
  if (!entry) {
    return '';
  }

  return [
    entry.result.responseText,
    entry.result.verification,
    entry.result.errorText,
    ...(entry.result.observations ?? []),
    ...(entry.result.stateSummary?.observedState ?? []),
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
    ...(entry.result.receipt?.summaryLines ?? []),
  ].filter(Boolean).join('\n');
}

function normalizeAgentDesktopAutoRecoveryProgressNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)).toString() : '';
}

function normalizeAgentDesktopAutoRecoverySizeToMb(value: string, unit: string) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  const multiplierByUnit: Record<string, number> = {
    gb: 1024,
    kb: 1 / 1024,
    mb: 1,
    tb: 1024 * 1024,
  };
  const multiplier = multiplierByUnit[unit.toLowerCase()] ?? 1;
  return Number((parsed * multiplier).toFixed(3)).toString();
}

function extractAgentDesktopAutoRecoveryPhaseSignals(text: string) {
  const phasePattern = /\b(?:checking|connecting|downloading|extracting|initializing|installing|launching|loading|patching|preparing|queued|starting|updating|verifying|waiting)\b|[\u6b63\u5728\u5df2]?\u4e0b\u8f7d|\u4e0b\u8f7d\u4e2d|[\u6b63\u5728]?\u5b89\u88c5|\u5b89\u88c5\u4e2d|\u4fee\u8865|\u8865\u4e01|\u6821\u9a8c|\u9a8c\u8bc1\u4e2d|\u89e3\u538b|[\u6b63\u5728]?\u51c6\u5907|\u6392\u961f|\u8fde\u63a5|\u542f\u52a8|\u52a0\u8f7d|\u66f4\u65b0/iu;
  const negatedProgressPattern = /(?:\b(?:no|without|missing|absent|unavailable)\b[^\n.]{0,48}\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b|\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b[^\n.]{0,48}\b(?:not\s+visible|not\s+shown|missing|absent|unavailable)\b|\b(?:cannot|can't|unable\s+to)\s+see[^\n.]{0,48}\b(?:progress|percentage|percent)\b|\u6ca1\u6709[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u65e0[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u770b\u4e0d\u5230[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u672a\u663e\u793a[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4))/iu;
  return text
    .split(/[\n\r.!?;閵嗗偊绱掗敍鐕傜幢]+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => phasePattern.test(line))
    .filter((line) => !negatedProgressPattern.test(line))
    .filter((line) => !/(?:post-action visual state|structuredevidence|summarylines|call:|state:\s*(?:loading|updating|unknown|launched))/iu.test(line))
    .map((line) => line
      .replace(/\b\d{1,3}(?:\.\d+)?\s*%/giu, ' percent ')
      .replace(/\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\s*\/\s*\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\b/giu, ' size-ratio ')
      .replace(/\s+/gu, ' ')
      .trim())
    .filter(Boolean);
}

function createAgentDesktopAutoRecoveryProgressSnapshot(
  entry: AgentDesktopToolResultEntry | null | undefined,
): AgentDesktopAutoRecoveryProgressSnapshot {
  const text = collectAgentDesktopAutoRecoveryEvidenceText(entry).normalize('NFKC').toLowerCase();
  if (!text) {
    return { numericSignals: [], phaseSignals: [] };
  }

  const numericSignals = [
    ...Array.from(text.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%/giu))
      .map((match) => `percent:${normalizeAgentDesktopAutoRecoveryProgressNumber(match[1] ?? '')}`),
    ...Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)\s*\/\s*(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)\b/giu))
      .map((match) => {
        const used = normalizeAgentDesktopAutoRecoverySizeToMb(match[1] ?? '', match[2] ?? 'mb');
        const total = normalizeAgentDesktopAutoRecoverySizeToMb(match[3] ?? '', match[4] ?? 'mb');
        return used && total ? `size:${used}/${total}` : '';
      }),
  ].filter(Boolean);

  return {
    numericSignals,
    phaseSignals: extractAgentDesktopAutoRecoveryPhaseSignals(text),
  };
}

function getLatestAgentDesktopAutoRecoveryComparableProgressSnapshot(options: {
  latestEntry?: AgentDesktopToolResultEntry | null;
  postActionState: string;
  toolResults?: AgentDesktopToolResultEntry[];
}) {
  const normalizedState = options.postActionState.trim();
  const entries = options.toolResults ?? [];
  const latestEntryIndex = options.latestEntry ? entries.lastIndexOf(options.latestEntry) : -1;
  const startIndex = latestEntryIndex >= 0 ? latestEntryIndex - 1 : entries.length - 1;
  for (let index = startIndex; index >= 0; index -= 1) {
    const entry = entries[index];
    const entryState = getAgentDesktopPostActionState(entry)
      || getAgentDesktopAutoRecoveryQuestionState(entry.command);
    if (normalizedState && entryState && entryState !== normalizedState) {
      continue;
    }

    const snapshot = createAgentDesktopAutoRecoveryProgressSnapshot(entry);
    if (snapshot.numericSignals.length || snapshot.phaseSignals.length) {
      return snapshot;
    }
  }

  return null;
}

function getLastAgentDesktopAutoRecoverySignal(signals: string[]) {
  return signals.length ? signals[signals.length - 1] : '';
}

function getLastAgentDesktopAutoRecoverySignalByType(signals: string[], type: string) {
  const prefix = `${type}:`;
  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index];
    if (signal.startsWith(prefix)) {
      return signal;
    }
  }

  return '';
}

function hasAgentDesktopAutoRecoveryProgressEvidence(entry: AgentDesktopToolResultEntry | null | undefined) {
  const text = collectAgentDesktopAutoRecoveryEvidenceText(entry).normalize('NFKC').toLowerCase();
  if (!text) {
    return false;
  }

  const hasStrongProgressSignal = /(?:\b\d{1,3}\s*%|\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\s*\/\s*\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)|\b(?:eta|remaining)\b\s*:?\s*\d+|[\u5269\u4f59\u9884\u8ba1][^\n.]{0,12}\d+)/iu.test(text);
  if (hasStrongProgressSignal) {
    return true;
  }

  const hasProgressVerbSignal = /(?:\b(?:progressing|downloading|downloaded|installing|installed|patching|verifying|extracting|preparing|queued)\b|[\u6b63\u5728\u5df2]?\u4e0b\u8f7d|\u4e0b\u8f7d\u4e2d|[\u6b63\u5728]?\u5b89\u88c5|\u5b89\u88c5\u4e2d|\u4fee\u8865|\u8865\u4e01|\u6821\u9a8c|\u9a8c\u8bc1\u4e2d|\u89e3\u538b|[\u6b63\u5728]?\u51c6\u5907|\u6392\u961f)/iu.test(text);
  if (hasProgressVerbSignal) {
    return true;
  }

  const hasNegatedProgressSignal = /(?:\b(?:no|without|missing|absent|unavailable)\b[^\n.]{0,48}\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b|\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b[^\n.]{0,48}\b(?:not\s+visible|not\s+shown|missing|absent|unavailable)\b|\b(?:cannot|can't|unable\s+to)\s+see[^\n.]{0,48}\b(?:progress|percentage|percent)\b|\u6ca1\u6709[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u65e0[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u770b\u4e0d\u5230[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u672a\u663e\u793a[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4))/iu.test(text);
  if (hasNegatedProgressSignal) {
    return false;
  }

  return /(?:\b(?:progress|percentage|percent|progress\s+bar)\b|\u8fdb\u5ea6|\u767e\u5206\u6bd4)/iu.test(text);
}

function hasAgentDesktopAutoRecoveryAdvancingProgressEvidence(options: {
  latestEntry?: AgentDesktopToolResultEntry | null;
  postActionState: string;
  toolResults?: AgentDesktopToolResultEntry[];
}) {
  const latestSnapshot = createAgentDesktopAutoRecoveryProgressSnapshot(options.latestEntry);
  const latestNumericSignal = getLastAgentDesktopAutoRecoverySignal(latestSnapshot.numericSignals);
  const latestPhaseSignal = getLastAgentDesktopAutoRecoverySignal(latestSnapshot.phaseSignals);
  if (!latestNumericSignal && !latestPhaseSignal) {
    return hasAgentDesktopAutoRecoveryProgressEvidence(options.latestEntry);
  }

  const previousSnapshot = getLatestAgentDesktopAutoRecoveryComparableProgressSnapshot(options);
  if (!previousSnapshot) {
    return Boolean(latestNumericSignal);
  }

  const latestPercentSignal = getLastAgentDesktopAutoRecoverySignalByType(latestSnapshot.numericSignals, 'percent');
  const previousPercentSignal = getLastAgentDesktopAutoRecoverySignalByType(previousSnapshot.numericSignals, 'percent');
  if (latestPercentSignal && previousPercentSignal) {
    return latestPercentSignal !== previousPercentSignal;
  }

  const latestSizeSignal = getLastAgentDesktopAutoRecoverySignalByType(latestSnapshot.numericSignals, 'size');
  const previousSizeSignal = getLastAgentDesktopAutoRecoverySignalByType(previousSnapshot.numericSignals, 'size');
  if (latestSizeSignal && previousSizeSignal) {
    return latestSizeSignal !== previousSizeSignal;
  }

  if (latestNumericSignal) {
    const previousNumericSignal = getLastAgentDesktopAutoRecoverySignal(previousSnapshot.numericSignals);
    return Boolean(previousNumericSignal && latestNumericSignal !== previousNumericSignal);
  }

  const previousPhaseSignal = getLastAgentDesktopAutoRecoverySignal(previousSnapshot.phaseSignals);
  return Boolean(
    latestPhaseSignal
    && previousPhaseSignal
    && !previousSnapshot.numericSignals.length
    && latestPhaseSignal !== previousPhaseSignal,
  );
}

function resolveAgentDesktopAutoRecoveryBaseMaxWaits(postActionState: string) {
  if (postActionState === 'loading') {
    return AGENT_DESKTOP_AUTO_RECOVERY_LOADING_MAX_WAITS;
  }

  if (postActionState === 'updating') {
    return AGENT_DESKTOP_AUTO_RECOVERY_UPDATING_MAX_WAITS;
  }

  if (postActionState === 'unknown') {
    return AGENT_DESKTOP_AUTO_RECOVERY_UNKNOWN_MAX_WAITS;
  }

  if (postActionState === 'waiting_window') {
    return AGENT_DESKTOP_AUTO_RECOVERY_WAITING_WINDOW_MAX_WAITS;
  }

  if (postActionState === 'waiting_target') {
    return AGENT_DESKTOP_AUTO_RECOVERY_WAITING_TARGET_MAX_WAITS;
  }

  return 0;
}

export function resolveAgentDesktopAutoRecoveryMaxWaits(
  postActionState: string,
  latestEntry?: AgentDesktopToolResultEntry | null,
  toolResults?: AgentDesktopToolResultEntry[],
) {
  const baseMaxWaits = resolveAgentDesktopAutoRecoveryBaseMaxWaits(postActionState);
  if (baseMaxWaits <= 0) {
    return 0;
  }

  const extraWaits = hasAgentDesktopAutoRecoveryAdvancingProgressEvidence({
    latestEntry,
    postActionState,
    toolResults,
  })
    ? AGENT_DESKTOP_AUTO_RECOVERY_PROGRESS_EXTRA_WAITS_BY_STATE[postActionState] ?? 0
    : 0;
  return baseMaxWaits + extraWaits;
}

function resolveAgentDesktopAutoRecoveryFallbackWaitMs(postActionState: string, waitAttempt: number) {
  const schedule = AGENT_DESKTOP_AUTO_RECOVERY_WAIT_MS_BY_STATE[postActionState]
    ?? AGENT_DESKTOP_AUTO_RECOVERY_WAIT_MS_BY_STATE.loading;
  const index = Math.max(0, waitAttempt - 1);
  return schedule[Math.min(index, schedule.length - 1)] ?? 2500;
}

function normalizeAgentDesktopAutoRecoveryWaitMs(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(500, Math.min(10_000, Math.round(numberValue)));
}

function resolveAgentDesktopAutoRecoveryWaitMs(value: unknown, fallback: number) {
  return Math.max(normalizeAgentDesktopAutoRecoveryWaitMs(value, fallback), fallback);
}

function createAgentDesktopAutoRecoveryFallbackInstruction(options: {
  maxWaits?: number;
  postActionState: string;
  waitAttempt?: number;
}) {
  if (!options.waitAttempt || !options.maxWaits) {
    return '';
  }

  if (options.waitAttempt < options.maxWaits) {
    return 'If the UI is still transitional after this observation, keep the task alive and decide whether another wait, a focused element read, or a safer retry is needed.';
  }

  if (options.postActionState === 'loading' || options.postActionState === 'updating') {
    return 'This is the last automatic wait for this state. If the UI is still transitional, do not keep waiting forever; read visible blocker/error/recovery controls or report blocked with concrete evidence.';
  }

  return 'This is the last automatic wait for this state. If evidence is still unclear, refresh focused evidence, ask one short necessary question, or report blocked with concrete evidence.';
}

function createAgentDesktopAutoRecoveryQuestion(options: {
  maxWaits?: number;
  postActionState: string;
  query?: string | null;
  reason?: string | null;
  waitAttempt?: number;
}) {
  return [
    AGENT_DESKTOP_AUTO_RECOVERY_MARKER,
    `Post-action state is ${options.postActionState}.`,
    options.waitAttempt && options.maxWaits
      ? `Automatic wait attempt ${options.waitAttempt}/${options.maxWaits} for this state.`
      : '',
    options.query ? `Expected target/content: ${options.query}.` : '',
    options.reason ? `Reason: ${options.reason}` : '',
    'After this safe recovery observation, summarize current window/visual evidence and whether the user-level target is now launched, still loading/updating, blocked, unchanged, or failed.',
    'If the target is not launched, include visible blocker/error text, actionable controls, candidates, coordinates, or missing evidence needed for the next safe step.',
    createAgentDesktopAutoRecoveryFallbackInstruction({
      maxWaits: options.maxWaits,
      postActionState: options.postActionState,
      waitAttempt: options.waitAttempt,
    }),
  ].filter(Boolean).join(' ');
}

function resolveAgentDesktopAutoRecoveryReadAction(postActionState: string, value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return normalizeAgentDesktopToolActionName(value);
  }

  if (postActionState === 'unchanged') {
    return 'locate_element';
  }

  return 'describe_elements';
}

function createAgentDesktopSelectionRecoveryReadInstruction() {
  return 'The previous step only made the target visible or selected the wrong/current item. Read the current selected/detail item, the requested target item, whether the requested target is selected/current, and the best safe coordinate or UIA candidate for selecting the requested target item. Do not click anything, and do not look for the primary start/open/play button until selection is confirmed.';
}

function shouldUseAgentDesktopSelectedTargetPrimaryActionRecovery(
  entry: AgentDesktopToolResultEntry,
  recovery: AgentStructuredToolEvidence['postActionRecovery'] | null | undefined,
) {
  const evidence = getAgentDesktopStructuredEvidence(entry);
  return Boolean(
    recovery?.nextTool === 'locate_screen_elements'
      && evidence?.selectionVerificationStatus === 'selected'
      && evidence?.visualActionReadiness === 'needs-primary-action',
  );
}

function createAgentDesktopSelectedTargetPrimaryActionReadInstruction() {
  return 'The requested target is already confirmed selected/current. Read only the selected target detail area and locate the associated primary open/start/play/launch action. Return primaryAction, relation, actionCandidates, elementCenter or elementCenterRatio, confidence, coordinateConfidence, and visualActionReadiness. Do not click anything.';
}

function createAgentDesktopAutoRecoveryReadCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry;
  recovery: NonNullable<AgentStructuredToolEvidence['postActionRecovery']>;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}) {
  const { dependencies, latestEntry, recovery, sourceText, toolResults, userGoal } = options;
  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const readPurpose = shouldUseAgentDesktopSelectedTargetPrimaryActionRecovery(latestEntry, recovery)
    ? 'selected-target-primary-action'
    : isAgentDesktopSelectionRecoveryState(postActionState)
      ? 'target-selection-state'
      : `post-action-state:${postActionState || 'unknown'}`;
  if (
    recovery.nextTool !== 'locate_screen_elements'
    || !hasAgentDesktopAutoRecoveryReadBudget(toolResults, readPurpose)
  ) {
    return null;
  }

  const recoveryArgs = recovery.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const originalQuestion = typeof recoveryArgs.question === 'string' && recoveryArgs.question.trim()
    ? recoveryArgs.question.trim()
    : '';
  const targetQuery = typeof recoveryArgs.targetDescription === 'string' && recoveryArgs.targetDescription.trim()
    ? recoveryArgs.targetDescription.trim()
    : typeof recoveryArgs.query === 'string' && recoveryArgs.query.trim()
      ? recoveryArgs.query.trim()
      : '';
  const selectionRecoveryReadInstruction = isAgentDesktopSelectionRecoveryState(postActionState)
    ? createAgentDesktopSelectionRecoveryReadInstruction()
    : '';
  const selectedTargetPrimaryActionInstruction = shouldUseAgentDesktopSelectedTargetPrimaryActionRecovery(
    latestEntry,
    recovery,
  )
    ? createAgentDesktopSelectedTargetPrimaryActionReadInstruction()
    : '';

  return createAgentDesktopToolCommand({
    args: {
      ...recoveryArgs,
      action: resolveAgentDesktopAutoRecoveryReadAction(postActionState, recoveryArgs.action),
      forceRefresh: true,
      question: [
        createAgentDesktopAutoRecoveryQuestion({
          postActionState,
          query: targetQuery,
          reason: recovery.reason ?? null,
        }),
        selectionRecoveryReadInstruction,
        selectedTargetPrimaryActionInstruction,
        originalQuestion,
      ].filter(Boolean).join(' '),
      ...(targetQuery && !recoveryArgs.targetDescription ? { targetDescription: targetQuery } : {}),
      recoveryReadPurpose: readPurpose,
    },
    sourceText,
    toolName: 'locate_screen_elements',
    userGoal,
  });
}

function shouldReadAgentDesktopAutoRecoveryAfterWaitCap(postActionState: string) {
  return postActionState === 'loading'
    || postActionState === 'updating'
    || postActionState === 'unknown'
    || postActionState === 'waiting_target'
    || postActionState === 'waiting_window';
}

function shouldContinueAgentDesktopAfterWaitCapRead(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry | null;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}) {
  if (
    !options.latestEntry
    || !isAgentDesktopAutoRecoveryWaitCapReadCommand(options.latestEntry.command)
  ) {
    return false;
  }

  const postActionState = options.dependencies.resolvePostActionState({
    entry: options.latestEntry,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  if (!shouldReadAgentDesktopAutoRecoveryAfterWaitCap(postActionState)) {
    return false;
  }

  const sourcePostActionState = getAgentDesktopAutoRecoveryQuestionState(options.latestEntry.command);
  const latestProgressSnapshot = createAgentDesktopAutoRecoveryProgressSnapshot(options.latestEntry);
  const hasTransitionProgressSignal = Boolean(
    latestProgressSnapshot.numericSignals.length
    || latestProgressSnapshot.phaseSignals.length,
  );
  const hasNumericProgressSignal = latestProgressSnapshot.numericSignals.length > 0;
  const hasTransitionalStateChange = Boolean(
    sourcePostActionState
    && postActionState
    && sourcePostActionState !== postActionState
    && shouldReadAgentDesktopAutoRecoveryAfterWaitCap(sourcePostActionState)
    && shouldReadAgentDesktopAutoRecoveryAfterWaitCap(postActionState),
  );
  const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(
    postActionState,
    options.latestEntry,
    options.toolResults,
  );
  const previousWaits = countAgentDesktopAutoRecoveryWaits(
    options.toolResults,
    postActionState,
  );

  return previousWaits < maxWaits
    && (
      (
        hasNumericProgressSignal
        && hasAgentDesktopAutoRecoveryAdvancingProgressEvidence({
          latestEntry: options.latestEntry,
          postActionState,
          toolResults: options.toolResults,
        })
      )
      || (hasTransitionalStateChange && hasTransitionProgressSignal)
    );
}

function createAgentDesktopAutoRecoveryWaitCapReadCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry;
  recovery: AgentStructuredToolEvidence['postActionRecovery'] | null | undefined;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { dependencies, latestEntry, recovery, sourceText, toolResults, userGoal } = options;
  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const readPurpose = `wait-cap:${postActionState || 'unknown'}`;
  if (
    !shouldReadAgentDesktopAutoRecoveryAfterWaitCap(postActionState)
    || !hasAgentDesktopAutoRecoveryReadBudget(toolResults, readPurpose)
  ) {
    return null;
  }

  const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const query = resolveAgentDesktopAutoRecoveryQuery({
    latestEntry,
    recoveryArgs,
    sourceText,
    userGoal,
  });
  const targetDescription = query
    ? `visible progress, blocker, error text, recovery controls, and launch state for ${query}`
    : 'visible progress, blocker, error text, recovery controls, and launch state';
  const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, latestEntry, toolResults);

  if (postActionState === 'waiting_window' || postActionState === 'waiting_target') {
    return createAgentDesktopToolCommand({
      args: {
        forceRefresh: true,
        includeActiveWindow: true,
        includeDisplays: true,
        includeInstalledApps: false,
        includeRunningApps: true,
        includeTaskbarPinned: false,
        limit: 20,
        ...(query ? { query } : {}),
        recoveryPostActionState: postActionState,
        recoveryReadPurpose: readPurpose,
        recoveryReason: [
          AGENT_DESKTOP_AUTO_RECOVERY_MARKER,
          postActionState === 'waiting_target'
            ? 'The start/open/play action appears sent, but the requested target process/window has not appeared after the wait budget.'
            : 'Launch request was accepted, but no matching window was verified after the short wait budget.',
          'Read only active/running window/process evidence before retrying, inspecting UI, or asking the user.',
        ].join(' '),
      },
      sourceText,
      toolName: 'observe_windows_and_apps',
      userGoal,
    });
  }

  return createAgentDesktopToolCommand({
    args: {
      action: 'describe_elements',
      forceRefresh: true,
      question: [
        createAgentDesktopAutoRecoveryQuestion({
          maxWaits,
          postActionState,
          query,
          reason: recovery?.reason ?? 'Automatic wait budget for this transitional state has been reached.',
          waitAttempt: maxWaits,
        }),
        'Automatic wait budget for this state is exhausted. Read the visible progress state, blocker/error text, modal/permission gate, retry/continue/start/open controls, and whether the requested target actually launched. Do not click anything.',
      ].filter(Boolean).join(' '),
      targetDescription,
      ...(query ? { query, targetText: query } : {}),
      recoveryReadPurpose: readPurpose,
    },
    sourceText,
    toolName: 'locate_screen_elements',
    userGoal,
  });
}

function shouldReadAgentDesktopAutoRecoveryState(postActionState: string) {
  return postActionState === 'blocked'
    || postActionState === 'error'
    || postActionState === 'login_required'
    || postActionState === 'selection_mismatch'
    || postActionState === 'visible_only'
    || postActionState === 'unchanged';
}

function createAgentDesktopAutoRecoveryStateReadCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry;
  recovery: AgentStructuredToolEvidence['postActionRecovery'] | null | undefined;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { dependencies, latestEntry, recovery, sourceText, toolResults, userGoal } = options;
  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const readPurpose = isAgentDesktopSelectionRecoveryState(postActionState)
    ? 'target-selection-state'
    : `post-action-state:${postActionState || 'unknown'}`;
  if (
    !shouldReadAgentDesktopAutoRecoveryState(postActionState)
    || !hasAgentDesktopAutoRecoveryReadBudget(toolResults, readPurpose)
  ) {
    return null;
  }

  const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const query = resolveAgentDesktopAutoRecoveryQuery({
    latestEntry,
    recoveryArgs,
    sourceText,
    userGoal,
  });
  const action = isAgentDesktopSelectionRecoveryState(postActionState)
    ? 'locate_element'
    : resolveAgentDesktopAutoRecoveryReadAction(postActionState, recoveryArgs.action);
  const targetDescription = isAgentDesktopSelectionRecoveryState(postActionState)
    ? `the requested target item, current selected/detail item, selection state, and safe target-selection coordinates for ${query}`
    : postActionState === 'login_required'
      ? `safe login continuation controls and non-automatable verification gates for ${query}`
      : postActionState === 'unchanged'
      ? `the requested target/action and any alternate clickable controls for ${query}`
      : `visible ${postActionState} text, modal/gate, recovery controls, target/action candidates, and coordinates for ${query}`;
  const stateSpecificQuestion = isAgentDesktopSelectionRecoveryState(postActionState)
    ? createAgentDesktopSelectionRecoveryReadInstruction()
    : postActionState === 'login_required'
      ? 'The UI appears to be on a login/account page. Locate safe login continuation controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered. Also report captcha, QR-code scan, SMS code, two-factor verification, empty required input, or admin/UAC gates. Do not click anything.'
      : postActionState === 'unchanged'
      ? 'The previous action did not visibly advance the UI. Re-locate the intended target/action, include alternate candidates and reliable coordinates if available, and do not click anything.'
      : 'Read the visible blocker/error/modal text and any safe retry/continue/start/open controls with coordinates if available. Do not click anything.';

  return createAgentDesktopToolCommand({
    args: {
      action,
      forceRefresh: true,
      question: [
        createAgentDesktopAutoRecoveryQuestion({
          postActionState,
          query,
          reason: recovery?.reason ?? `Post-action state is ${postActionState}, but no explicit recovery read tool was provided.`,
        }),
        stateSpecificQuestion,
      ].filter(Boolean).join(' '),
      query,
      recoveryPostActionState: postActionState,
      recoveryReadPurpose: readPurpose,
      targetDescription,
      targetText: postActionState === 'login_required'
        ? '登录 快速登录 安全登录 Sign in Log in Continue Confirm OK'
        : query,
    },
    sourceText,
    toolName: 'locate_screen_elements',
    userGoal,
  });
}

function createAgentDesktopAutoRecoveryWindowObservationCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry;
  recovery: AgentStructuredToolEvidence['postActionRecovery'] | null | undefined;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { dependencies, latestEntry, recovery, sourceText, toolResults, userGoal } = options;
  const budget = getAgentDesktopRecoveryStrategyBudget('observe_window_or_capture_source');
  if (
    countAgentDesktopRecoveryStrategyRuns(toolResults, 'observe_window_or_capture_source') >= budget.max
  ) {
    return null;
  }

  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const evidence = getAgentDesktopStructuredEvidence(latestEntry);
  const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const queryCandidates = [
    recoveryArgs.query,
    recoveryArgs.target,
    recoveryArgs.name,
    recoveryArgs.title,
    recoveryArgs.processName,
    evidence?.targetMatched,
    evidence?.finalWindow?.title,
    evidence?.finalWindow?.processName,
    userGoal,
    sourceText,
  ];
  const query = queryCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim());

  return createAgentDesktopToolCommand({
    args: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeDisplays: true,
      includeRunningApps: true,
      includeInstalledApps: false,
      includeTaskbarPinned: false,
      limit: 30,
      ...(typeof query === 'string' && query.trim() ? { query: query.trim() } : {}),
      recoveryPostActionState: postActionState,
      recoveryReason: recovery?.reason ?? 'Post-action recovery needs current app/window/display ownership evidence.',
    },
    sourceText,
    toolName: 'observe_windows_and_apps',
    userGoal,
  });
}

function createAgentDesktopAutoRecoveryWindowUiInspectionCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry;
  recovery: AgentStructuredToolEvidence['postActionRecovery'] | null | undefined;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { dependencies, latestEntry, recovery, sourceText, toolResults, userGoal } = options;
  if (recovery?.nextTool !== 'execute_desktop_observation') {
    return null;
  }

  const recoveryArgs = recovery.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const action = typeof recoveryArgs.action === 'string'
    ? normalizeAgentDesktopToolActionName(recoveryArgs.action)
    : '';
  if (action !== 'inspect_window_ui') {
    return null;
  }

  const budget = getAgentDesktopRecoveryStrategyBudget('observe_window_or_capture_source');
  if (
    countAgentDesktopRecoveryStrategyRuns(toolResults, 'observe_window_or_capture_source') >= budget.max
  ) {
    return null;
  }

  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const query = resolveAgentDesktopAutoRecoveryQuery({
    latestEntry,
    recoveryArgs,
    sourceText,
    userGoal,
  });
  const originalQuestion = typeof recoveryArgs.question === 'string' && recoveryArgs.question.trim()
    ? recoveryArgs.question.trim()
    : '';

  return createAgentDesktopToolCommand({
    args: {
      ...recoveryArgs,
      action: 'inspect_window_ui',
      forceRefresh: true,
      question: [
        createAgentDesktopAutoRecoveryQuestion({
          postActionState,
          query,
          reason: recovery.reason ?? 'Post-action recovery requested a read-only UI Automation refresh.',
        }),
        originalQuestion,
        'This is read-only recovery. Do not click or invoke anything. Do not type or change the UI.',
      ].filter(Boolean).join(' '),
      ...(query && !recoveryArgs.query ? { query } : {}),
      recoveryPostActionState: postActionState,
    },
    sourceText,
    toolName: 'execute_desktop_observation',
    userGoal,
  });
}

export function createAgentDesktopAutoRecoveryObservationCommand(options: {
  dependencies: AgentDesktopAutoRecoveryObservationBuilderDependencies;
  latestEntry: AgentDesktopToolResultEntry | null;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { dependencies, latestEntry, sourceText, toolResults, userGoal } = options;
  if (!latestEntry) {
    return null;
  }

  // A wait can return valid window/process evidence while its optional visual
  // supplement times out. That is a different state from "window missing":
  // switch to one fresh window-level locate before applying repeat-read caps.
  const visualTimeoutRecovery = createAgentDesktopVisualTimeoutRecoveryCommand({
    latestEntry,
    sourceText,
    userGoal,
  });
  if (visualTimeoutRecovery) {
    return visualTimeoutRecovery;
  }

  const continueAfterWaitCapRead = shouldContinueAgentDesktopAfterWaitCapRead({
    dependencies,
    latestEntry,
    sourceText,
    toolResults,
    userGoal,
  });

  if (
    isAgentDesktopAutoRecoveryWaitCapReadCommand(latestEntry.command)
    && !continueAfterWaitCapRead
  ) {
    return null;
  }

  if (
    isAgentDesktopAutoRecoveryReadCommand(latestEntry.command)
    && !continueAfterWaitCapRead
  ) {
    return null;
  }

  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });
  const recovery = getAgentDesktopStructuredEvidence(latestEntry)?.postActionRecovery;
  if (postActionState === 'waiting_window' || postActionState === 'waiting_target') {
    const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, latestEntry, toolResults);
    const previousWaits = countAgentDesktopAutoRecoveryWaits(toolResults, postActionState);
    if (maxWaits <= 0 || previousWaits >= maxWaits) {
      return createAgentDesktopAutoRecoveryWaitCapReadCommand({
        dependencies,
        latestEntry,
        recovery,
        sourceText,
        toolResults,
        userGoal,
      });
    }

    const fallbackWaitMs = resolveAgentDesktopAutoRecoveryFallbackWaitMs(postActionState, previousWaits + 1);
    const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
      ? recovery.nextArgs
      : {};
    const query = resolveAgentDesktopAutoRecoveryQuery({
      latestEntry,
      recoveryArgs,
      sourceText,
      userGoal,
    });
    return createAgentDesktopToolCommand({
      args: {
        action: 'wait_and_observe',
        forceRefresh: true,
        includeVisual: false,
        limit: 12,
        ...(query ? { query } : {}),
        question: createAgentDesktopAutoRecoveryQuestion({
          maxWaits,
          postActionState,
          query,
          reason: recovery?.reason ?? 'The requested app/window is not verified yet; wait and poll lightweight window/process state before visual recovery.',
          waitAttempt: previousWaits + 1,
        }),
        recoveryAttempt: previousWaits + 1,
        recoveryMaxAttempts: maxWaits,
        recoveryPostActionState: postActionState,
        waitMs: resolveAgentDesktopAutoRecoveryWaitMs(recoveryArgs.waitMs, fallbackWaitMs),
      },
      sourceText,
      toolName: 'execute_desktop_observation',
      userGoal,
    });
  }

  if (recovery?.nextTool === 'locate_screen_elements') {
    return createAgentDesktopAutoRecoveryReadCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    });
  }

  if (recovery?.nextTool === 'observe_windows_and_apps') {
    return createAgentDesktopAutoRecoveryWindowObservationCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    });
  }

  const windowUiInspectionRecovery = createAgentDesktopAutoRecoveryWindowUiInspectionCommand({
    dependencies,
    latestEntry,
    recovery,
    sourceText,
    toolResults,
    userGoal,
  });
  if (windowUiInspectionRecovery) {
    return windowUiInspectionRecovery;
  }

  const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, latestEntry, toolResults);
  const previousWaits = countAgentDesktopAutoRecoveryWaits(toolResults, postActionState);
  if (maxWaits <= 0 || previousWaits >= maxWaits) {
    return createAgentDesktopAutoRecoveryWaitCapReadCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    }) ?? createAgentDesktopAutoRecoveryStateReadCommand({
      dependencies,
      latestEntry,
      recovery,
      sourceText,
      toolResults,
      userGoal,
    });
  }

  if (recovery?.nextTool && recovery.nextTool !== 'execute_desktop_observation') {
    return null;
  }

  const recoveryArgs = recovery?.nextArgs && typeof recovery.nextArgs === 'object'
    ? recovery.nextArgs
    : {};
  const action = typeof recoveryArgs.action === 'string'
    ? normalizeAgentDesktopToolActionName(recoveryArgs.action)
    : 'wait_and_observe';
  if (action !== 'wait_and_observe') {
    return null;
  }

  const waitAttempt = previousWaits + 1;
  const fallbackWaitMs = resolveAgentDesktopAutoRecoveryFallbackWaitMs(postActionState, waitAttempt);
  const query = resolveAgentDesktopAutoRecoveryQuery({
    latestEntry,
    recoveryArgs,
    sourceText,
    userGoal,
  });
  return createAgentDesktopToolCommand({
    args: {
      action: 'wait_and_observe',
      forceRefresh: true,
      includeVisual: true,
      limit: 12,
      ...(query ? { query } : {}),
      question: createAgentDesktopAutoRecoveryQuestion({
        maxWaits,
        postActionState,
        query,
        reason: recovery?.reason ?? null,
        waitAttempt,
      }),
      recoveryAttempt: waitAttempt,
      recoveryMaxAttempts: maxWaits,
      recoveryPostActionState: postActionState,
      waitMs: resolveAgentDesktopAutoRecoveryWaitMs(recoveryArgs.waitMs, fallbackWaitMs),
    },
    sourceText,
    toolName: 'execute_desktop_observation',
    userGoal,
  });
}

export function hasAgentDesktopAutoRecoveryWaitBudgetRemaining(
  latestEntry: AgentDesktopToolResultEntry | null,
  toolResults: AgentDesktopToolResultEntry[],
) {
  const postActionState = getAgentDesktopPostActionState(latestEntry);
  const maxWaits = resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, latestEntry, toolResults);
  return maxWaits > 0 && countAgentDesktopAutoRecoveryWaits(toolResults, postActionState) < maxWaits;
}

export function findLatestAgentDesktopAutoRecoverySourceEntry(
  toolResults: AgentDesktopToolResultEntry[],
) {
  for (let index = toolResults.length - 1; index >= 0; index -= 1) {
    const entry = toolResults[index];
    if (getAgentDesktopPostActionState(entry)) {
      return entry;
    }
  }

  return null;
}
