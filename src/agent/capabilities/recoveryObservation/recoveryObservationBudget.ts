import {
  getAgentDesktopAutoRecoveryQuestionState,
  createAgentDesktopAutoRecoveryProgressSnapshot,
  hasAgentDesktopAutoRecoveryAdvancingProgressEvidence,
} from './recoveryProgressEvidence';
export { collectAgentDesktopAutoRecoveryEvidenceText } from './recoveryProgressEvidence';

import {
  type AgentChatCommand,
} from '../../agentChatCommand';

import {
  type AgentRuntimeToolResultEntry as AgentDesktopToolResultEntry,
} from '../../runtime/agentRuntimeContract';

import {
  getAgentPostActionState as getAgentDesktopPostActionState,
} from '../../runtime/agentToolEvidence';

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

export function getAgentDesktopToolInputAction(command: AgentChatCommand) {
  const action = command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
}

export function normalizeAgentDesktopToolActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
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

export function isAgentDesktopSelectionRecoveryState(postActionState: string) {
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

export function hasAgentDesktopAutoRecoveryReadBudget(
  toolResults: AgentDesktopToolResultEntry[],
  purpose: string,
) {
  return countAgentDesktopAutoRecoveryReads(toolResults, purpose) < AGENT_DESKTOP_AUTO_RECOVERY_READ_MAX_RUNS;
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

export function resolveAgentDesktopAutoRecoveryFallbackWaitMs(postActionState: string, waitAttempt: number) {
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

export function resolveAgentDesktopAutoRecoveryWaitMs(value: unknown, fallback: number) {
  return Math.max(normalizeAgentDesktopAutoRecoveryWaitMs(value, fallback), fallback);
}

export function shouldReadAgentDesktopAutoRecoveryAfterWaitCap(postActionState: string) {
  return postActionState === 'loading'
    || postActionState === 'updating'
    || postActionState === 'unknown'
    || postActionState === 'waiting_target'
    || postActionState === 'waiting_window';
}

export function shouldContinueAgentDesktopAfterWaitCapRead(options: {
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
