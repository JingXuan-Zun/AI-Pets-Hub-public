import {
  type AgentChatCommand,
  type AgentStructuredToolEvidence,
} from '../../agentChatCommand';

import {
  type AgentRuntimeToolResultEntry as AgentDesktopToolResultEntry,
} from '../../runtime/agentRuntimeContract';

import {
  getAgentStructuredEvidence as getAgentDesktopStructuredEvidence,
} from '../../runtime/agentToolEvidence';

import {
  countAgentRecoveryStrategyRuns as countAgentDesktopRecoveryStrategyRuns,
  getAgentRecoveryStrategyBudget as getAgentDesktopRecoveryStrategyBudget,
} from '../../runtime/agentRecoveryStrategyBudget';

import {
  resolveAgentDesktopAutoRecoveryQuery,
} from '../agentDesktopRecoveryCommandBuilder';

import {
  createAgentToolCommand as createAgentDesktopToolCommand,
} from '../../runtime/agentToolCommandFactory';

import {
  AGENT_DESKTOP_AUTO_RECOVERY_MARKER,
  type AgentDesktopAutoRecoveryObservationBuilderDependencies,
  getAgentDesktopToolInputAction,
  normalizeAgentDesktopToolActionName,
  isAgentDesktopSelectionRecoveryState,
  hasAgentDesktopAutoRecoveryReadBudget,
  resolveAgentDesktopAutoRecoveryMaxWaits,
  shouldReadAgentDesktopAutoRecoveryAfterWaitCap,
} from './recoveryObservationBudget';

export function createAgentDesktopVisualTimeoutRecoveryCommand(options: {
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

export function createAgentDesktopAutoRecoveryQuestion(options: {
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

export function createAgentDesktopAutoRecoveryReadCommand(options: {
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

export function createAgentDesktopAutoRecoveryWaitCapReadCommand(options: {
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

export function createAgentDesktopAutoRecoveryStateReadCommand(options: {
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

export function createAgentDesktopAutoRecoveryWindowObservationCommand(options: {
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

export function createAgentDesktopAutoRecoveryWindowUiInspectionCommand(options: {
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
