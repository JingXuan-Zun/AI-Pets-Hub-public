import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentDesktopActionEvidence,
  type AgentDesktopActionOutcome,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
  type AgentStructuredToolRecoveryEvidence,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';
import {
  evaluateAgentActionLifecycle,
  type AgentActionLifecycleDecision,
} from './agentActionLifecycle';
import {
  createAgentRuntimeCoreContext,
  createAgentRuntimeCoreWindowTargetCandidates,
  parseAgentRuntimeCoreTaskPlanJson,
  resolveAgentRuntimeCoreSequenceOutcome,
} from './agentRuntimeCore';
import {
  executeDesktopAction,
  executeDesktopInput,
  normalizeExecuteDesktopAction,
  normalizeExecuteDesktopInputAction,
} from './agentRuntimeDesktopTools';
import { executeObserveWindowsAndApps } from './agentRuntimeDesktopObservationTools';
import { executeLocateScreenElements, executeSummarizeVisualSnapshot } from './agentRuntimeVisualTools';
import { waitForDesktopActionWindowSettle } from './agentRuntimeWindowTools';
import { resolveAgentVisualExecutionStrategy } from './agentExecutionStrategy';
import { prepareAgentToolInput } from './agentToolInputSchema';

const AGENT_RUNTIME_CANCELLED_TEXT = 'Agent run cancelled by user.';
const AGENT_RUNTIME_DESKTOP_SEQUENCE_MAX_STEPS = 8;
const AGENT_RUNTIME_DESKTOP_SEQUENCE_VERIFICATION_ACTIONS = new Set([
  'close_window',
  'control_window',
  'focus_window',
  'interact_window_ui',
  'invoke_window_ui',
  'launch_local_app',
  'move_window_to_display',
  'open_or_focus_then_control_window',
  'open_or_focus_then_move_window_to_display',
  'open_resource',
  'search_web',
]);
const AGENT_RUNTIME_DESKTOP_SEQUENCE_INPUT_VERIFICATION_ACTIONS = new Set([
  'click',
  'double_click',
  'drag',
  'hotkey',
  'right_click',
  'send_keys',
  'type_text',
]);

type AgentRuntimeDesktopSequenceToolName = 'execute_desktop_action' | 'execute_desktop_input';

interface AgentRuntimeDesktopSequenceStep {
  args: Record<string, unknown>;
  reason?: string | null;
  tool: AgentRuntimeDesktopSequenceToolName;
}

interface AgentRuntimeVisibleClickSpec {
  app: string;
  postVerify: string;
  requireActionable: boolean;
  requireSameHwnd: boolean;
  sourceHwnd: number | null;
  sourceWindowTitle: string;
  target: string;
  targetPoint: { x: number; y: number } | null;
  targetRole: string;
}

function getAgentRuntimeDesktopSequenceFinalWindow(
  result: AgentChatCommandResult,
): AgentStructuredToolWindowEvidence | null {
  const evidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  return evidence?.finalWindow ?? null;
}

export function resolveAgentRuntimeDesktopSequenceObservedWindow(
  result: AgentChatCommandResult,
  target: string,
) {
  const evidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const candidates = [
    ...(evidence?.finalWindow ? [{ window: evidence.finalWindow, label: '' }] : []),
    ...(evidence?.targetCandidates ?? []).map((candidate) => ({
      label: [candidate.label, candidate.name, candidate.description].filter(Boolean).join(' '),
      window: candidate.window,
    })),
  ].filter((candidate): candidate is { label: string; window: AgentStructuredToolWindowEvidence } => Boolean(candidate.window?.hwnd));
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [
    `${candidate.window.hwnd}:${candidate.window.pid ?? ''}`,
    candidate,
  ])).values()];
  if (!uniqueCandidates.length) {
    return null;
  }

  const normalizedTarget = target.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
  const targetBasename = target
    .replace(/[?#].*$/u, '')
    .split(/[\\/]/u)
    .at(-1)
    ?.replace(/\.[a-z0-9]{1,8}$/iu, '')
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .toLowerCase() ?? '';
  const matching = normalizedTarget
    ? uniqueCandidates.filter(({ label, window }) => [
        label,
        window.title,
        window.processName,
      ].filter(Boolean).join(' ').normalize('NFKC').replace(/\s+/gu, '').toLowerCase().includes(normalizedTarget)
        || (targetBasename.length >= 2 && [
          label,
          window.title,
          window.processName,
        ].filter(Boolean).join(' ').normalize('NFKC').replace(/\s+/gu, '').toLowerCase().includes(targetBasename)))
    : uniqueCandidates;
  if (normalizedTarget) {
    return (matching.length === 1 ? matching[0] : null)?.window ?? null;
  }
  return (uniqueCandidates.length === 1 ? uniqueCandidates[0] : null)?.window ?? null;
}

function createAgentRuntimeDesktopSequenceUnresolvedWindowResult(
  target: string,
  action = 'desktop action',
): AgentChatCommandResult {
  const reason = target
    ? `The window created by "${target}" was not uniquely resolved before the ${action} step.`
    : `The window created by the previous desktop action was not uniquely resolved before the ${action} step.`;
  return createAgentRuntimeResult({
    errorText: reason,
    observations: [
      reason,
      `The ${action} step was blocked before dispatch because its target window identity was unavailable.`,
      'Refresh window/process evidence and retry only after one live target is resolved.',
    ],
    ok: false,
    receipt: {
      evidenceLines: [reason, 'preDispatchWindowResolution=blocked'],
      status: 'blocked',
      summaryLines: [
        'Call: execute_desktop_sequence',
        'Input step blocked before side-effect dispatch.',
      ],
      title: 'Desktop input target unresolved',
      toolName: 'execute_desktop_sequence',
      verification: reason,
    },
    responseText: reason,
    verification: reason,
  });
}

function isAgentRuntimeDesktopSequenceWindowDependentStep(step: AgentRuntimeDesktopSequenceStep) {
  if (step.tool === 'execute_desktop_input') {
    return true;
  }
  return [
    'close_window',
    'control_window',
    'focus_window',
    'interact_window_ui',
    'invoke_window_ui',
    'move_window_to_display',
  ].includes(getAgentRuntimeSequenceStepAction(step));
}

function isAgentRuntimeDesktopSequenceSurfaceChangingStep(step: AgentRuntimeDesktopSequenceStep) {
  if (step.tool === 'execute_desktop_input') {
    return [
      'click',
      'double_click',
      'drag',
      'hotkey',
      'right_click',
      'send_keys',
      'type_text',
    ].includes(getAgentRuntimeSequenceStepAction(step));
  }
  return [
    'interact_window_ui',
    'invoke_window_ui',
    'launch_local_app',
    'open_resource',
    'search_web',
  ].includes(getAgentRuntimeSequenceStepAction(step));
}

async function refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange(
  context: AgentRuntimeExecutorContext,
  previousStep: AgentRuntimeDesktopSequenceStep,
  nextStep: AgentRuntimeDesktopSequenceStep,
  previousWindow: AgentStructuredToolWindowEvidence | null,
) {
  const target = resolveAgentRuntimeDesktopSequencePostCreationTarget({
    createdTarget: getAgentRuntimeDesktopSequenceWindowTarget(previousStep)
      || getAgentRuntimeDesktopSequenceRawTarget(previousStep)
      || previousWindow?.title?.trim()
      || previousWindow?.processName?.trim()
      || '',
    nextStepTarget: getAgentRuntimeDesktopSequenceWindowTarget(nextStep),
  });
  await waitForDesktopActionWindowSettle(350);
  if (isAgentRuntimeCancellationRequested(context)) {
    return null;
  }
  const result = await executeObserveWindowsAndApps({
    goal: 'Resolve the window created by the previous desktop action before the next step.',
    input: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeRunningApps: true,
      limit: 80,
      ...(target ? { query: target } : {}),
    },
    name: 'observe_windows_and_apps',
  });
  return {
    result,
    target,
    window: resolveAgentRuntimeDesktopSequenceObservedWindow(result, target),
  };
}

function createAgentRuntimeDesktopSequenceInputArgs(
  args: Record<string, unknown>,
  focusedWindow: AgentStructuredToolWindowEvidence | null,
) {
  if (!focusedWindow) {
    return args;
  }

  const expectedHwnd = Number(focusedWindow.hwnd);
  const expectedPid = Number(focusedWindow.pid);
  const expectedTitle = focusedWindow.title?.trim() ?? '';
  const expectedProcessName = focusedWindow.processName?.trim() ?? '';

  return {
    ...args,
    ...(Number.isFinite(expectedHwnd) && expectedHwnd > 0 && typeof args.expectedForegroundHwnd !== 'number' && typeof args.hwnd !== 'number'
      ? { expectedForegroundHwnd: Math.round(expectedHwnd) }
      : {}),
    ...(Number.isFinite(expectedPid) && expectedPid > 0 && typeof args.expectedForegroundPid !== 'number'
      ? { expectedForegroundPid: Math.round(expectedPid) }
      : {}),
    ...(expectedTitle && typeof args.expectedForegroundTitle !== 'string' && typeof args.windowTitle !== 'string' && typeof args.title !== 'string'
      ? { expectedForegroundTitle: expectedTitle }
      : {}),
    ...(expectedProcessName && typeof args.expectedForegroundProcessName !== 'string' && typeof args.processName !== 'string'
      ? { expectedForegroundProcessName: expectedProcessName }
      : {}),
  };
}

function hasAgentRuntimeDesktopSequenceConcreteWindowIdentity(args: Record<string, unknown>) {
  return ['pid', 'hwnd', 'windowHandle'].some((key) => {
    const value = Number(args[key]);
    return Number.isFinite(value) && value > 0;
  });
}

function mergeAgentRuntimeDesktopSequenceWindowCandidates(values: unknown[]) {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const value of values.flatMap((item) => Array.isArray(item) ? item : [item])) {
    if (typeof value !== 'string') {
      continue;
    }
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push(text);
  }
  return candidates.slice(0, 8);
}

function getAgentRuntimeDesktopSequenceRawTarget(step: AgentRuntimeDesktopSequenceStep | null) {
  if (!step) {
    return '';
  }

  return getToolStringInput({
    input: step.args,
    name: step.tool,
  }, ['target', 'query', 'url', 'website', 'site', 'appName', 'name']);
}

export function getAgentRuntimeDesktopSequenceWindowTarget(step: AgentRuntimeDesktopSequenceStep) {
  const action = getAgentRuntimeSequenceStepAction(step);
  const keys = step.tool === 'execute_desktop_input'
    ? [
        'sourceQuery',
        'sourceWindowTitle',
        'windowQuery',
      ]
    : [
        'query',
        'windowTitle',
        'title',
        'processName',
        ...(action === 'interact_window_ui' || action === 'invoke_window_ui' ? [] : ['target', 'name']),
      ];
  return getToolStringInput({ input: step.args, name: step.tool }, keys);
}

export function resolveAgentRuntimeDesktopSequencePostCreationTarget(options: {
  createdTarget: string;
  nextStepTarget: string;
}) {
  return options.nextStepTarget.trim() || options.createdTarget.trim();
}

function createAgentRuntimeDesktopSequenceActionArgs(
  args: Record<string, unknown>,
  focusedWindow: AgentStructuredToolWindowEvidence | null,
  previousStep: AgentRuntimeDesktopSequenceStep | null,
) {
  const action = typeof args.action === 'string'
    ? args.action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
  const identityActions = new Set([
    'close_window',
    'control_window',
    'focus_window',
    'interact_window_ui',
    'invoke_window_ui',
  ]);
  if (identityActions.has(action)) {
    const hwnd = Number(focusedWindow?.hwnd);
    const pid = Number(focusedWindow?.pid);
    if (
      !hasAgentRuntimeDesktopSequenceConcreteWindowIdentity(args)
      && ((Number.isFinite(hwnd) && hwnd > 0) || (Number.isFinite(pid) && pid > 0))
    ) {
      return {
        ...args,
        ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
        ...(Number.isFinite(pid) && pid > 0 ? { pid: Math.round(pid) } : {}),
      };
    }
    return args;
  }

  if (action !== 'move_window_to_display') {
    return args;
  }

  const hwnd = Number(focusedWindow?.hwnd);
  const pid = Number(focusedWindow?.pid);
  if (
    !hasAgentRuntimeDesktopSequenceConcreteWindowIdentity(args)
    && ((Number.isFinite(hwnd) && hwnd > 0) || (Number.isFinite(pid) && pid > 0))
  ) {
    return {
      ...args,
      fallbackToActiveWindow: false,
      ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
      ...(Number.isFinite(pid) && pid > 0 ? { pid: Math.round(pid) } : {}),
    };
  }

  const previousAction = previousStep ? getAgentRuntimeSequenceStepAction(previousStep) : '';
  const target = getAgentRuntimeDesktopSequenceRawTarget(previousStep);
  const followsWindowCreation = ['launch_local_app', 'open_resource', 'search_web'].includes(previousAction);
  if (!target || !followsWindowCreation) {
    return args;
  }

  const existingTarget = getToolStringInput({
    input: args,
    name: 'execute_desktop_action',
  }, ['query', 'target', 'title', 'processName', 'name']);
  const inheritedCandidates = createAgentRuntimeCoreWindowTargetCandidates({
    openAction: previousAction,
    target,
  });

  return {
    ...args,
    fallbackToActiveWindow: true,
    queryCandidates: mergeAgentRuntimeDesktopSequenceWindowCandidates([
      existingTarget,
      args.queryCandidates,
      args.targetCandidates,
      args.windowCandidates,
      inheritedCandidates,
    ]),
    target: existingTarget || target,
  };
}

type AgentRuntimeDesktopSequenceParseResult =
  | {
      ok: true;
      steps: AgentRuntimeDesktopSequenceStep[];
    }
  | {
      error: string;
      ok: false;
    };

function isAgentRuntimeCancellationRequested(runtime: AgentRuntimeExecutorContext) {
  return Boolean(runtime.signal?.aborted);
}

function createAgentRuntimeCancelledResult(target: AgentToolCallCommand | string): AgentChatCommandResult {
  const toolName = typeof target === 'string' ? target : target.name;
  return {
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  };
}

function createAgentRuntimeResult(options: AgentChatCommandResult): AgentChatCommandResult {
  return {
    ...options,
    ok: options.ok ?? !options.errorText,
  };
}

function attachAgentActionLifecycleDecision(
  result: AgentChatCommandResult,
  lifecycle: AgentActionLifecycleDecision,
): AgentChatCommandResult {
  const structuredEvidence = {
    ...(result.stateSummary?.structuredEvidence
      ?? result.receipt?.stateSummary?.structuredEvidence
      ?? {}),
    actionLifecycle: lifecycle,
  };
  const stateSummary = {
    ...(result.stateSummary ?? {}),
    recommendedRecovery: mergeAgentRuntimeDesktopSequenceLists(
      result.stateSummary?.recommendedRecovery,
      [`ActionLifecycle: ${lifecycle.status} | ${lifecycle.recommendedRecovery}`],
    ),
    structuredEvidence,
  };

  return {
    ...result,
    observations: mergeAgentRuntimeDesktopSequenceLists(
      result.observations,
      [
        `ActionLifecycle status: ${lifecycle.status}`,
        `ActionLifecycle reason: ${lifecycle.reason}`,
      ],
    ),
    receipt: result.receipt
      ? {
          ...result.receipt,
          evidenceLines: mergeAgentRuntimeDesktopSequenceLists(
            result.receipt.evidenceLines,
            [
              `ActionLifecycle status: ${lifecycle.status}`,
              `ActionLifecycle reason: ${lifecycle.reason}`,
            ],
          ),
          stateSummary: {
            ...(result.receipt.stateSummary ?? {}),
            recommendedRecovery: mergeAgentRuntimeDesktopSequenceLists(
              result.receipt.stateSummary?.recommendedRecovery,
              [`ActionLifecycle: ${lifecycle.status} | ${lifecycle.recommendedRecovery}`],
            ),
            structuredEvidence,
          },
          summaryLines: mergeAgentRuntimeDesktopSequenceLists(
            result.receipt.summaryLines,
            [`ActionLifecycle: ${lifecycle.status}`],
          ),
        }
      : result.receipt,
    stateSummary,
  };
}

function inferAgentRuntimeToolResultOk(result: AgentChatCommandResult) {
  if (typeof result.ok === 'boolean') {
    return result.ok;
  }

  if (result.errorText) {
    return false;
  }

  return !/(?:failed|not\s+found|missing|unavailable|cannot|unable|error|blocked|unverified)/iu.test(result.responseText);
}

function createAgentRuntimeObservation(toolCall: AgentToolCallCommand) {
  const goalText = toolCall.goal?.trim();
  const inputKeys = Object.keys(toolCall.input ?? {}).filter((key) => toolCall.input[key] !== undefined);
  return [
    `Tool: ${toolCall.name}`,
    goalText ? `Goal: ${goalText}` : '',
    inputKeys.length ? `Input keys: ${inputKeys.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
}

function enrichDesktopSequenceNestedResult(
  toolCall: AgentToolCallCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const ok = inferAgentRuntimeToolResultOk(result);
  return createAgentRuntimeResult({
    ...result,
    errorText: ok ? result.errorText ?? null : result.errorText ?? result.responseText,
    observations: [
      createAgentRuntimeObservation(toolCall),
      ...(result.observations ?? []),
    ].filter(Boolean),
    ok,
  });
}

function getToolStringInput(toolCall: Pick<AgentToolCallCommand, 'input' | 'name'>, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function parseAgentRuntimeVisibleClickSpec(toolCall: AgentToolCallCommand): AgentRuntimeVisibleClickSpec | null {
  const rawJson = getToolStringInput(toolCall, ['visibleClickJson']);
  const rawInput = toolCall.input ?? {};
  let parsed: unknown = null;
  if (rawJson) {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = null;
    }
  }

  const source = isAgentRuntimeToolInputObject(parsed) ? parsed : rawInput;
  const mode = typeof rawInput.mode === 'string' ? rawInput.mode.trim().toLowerCase() : '';
  const enabled = Boolean(rawJson) || mode === 'visible_click' || mode === 'visibleclick';
  if (!enabled) {
    return null;
  }

  const app = typeof source.app === 'string' && source.app.trim()
    ? source.app.trim()
    : typeof source.sourceWindowTitle === 'string' && source.sourceWindowTitle.trim()
      ? source.sourceWindowTitle.trim()
    : typeof source.sourceQuery === 'string' && source.sourceQuery.trim()
      ? source.sourceQuery.trim()
      : typeof source.windowQuery === 'string' && source.windowQuery.trim()
        ? source.windowQuery.trim()
        : '';
  const target = typeof source.target === 'string' && source.target.trim()
    ? source.target.trim()
    : typeof source.targetText === 'string' && source.targetText.trim()
      ? source.targetText.trim()
      : typeof source.targetDescription === 'string' && source.targetDescription.trim()
        ? source.targetDescription.trim()
        : '';
  const postVerify = typeof source.postVerify === 'string' && source.postVerify.trim()
    ? source.postVerify.trim()
    : typeof source.postVerifyQuery === 'string' && source.postVerifyQuery.trim()
      ? source.postVerifyQuery.trim()
      : `The ${target || 'target'} in ${app || 'the app'} changed state after the visible click.`;
  const sourceHwndRaw = source.sourceHwnd ?? source.hwnd ?? source.windowHandle;
  const sourceHwndNumber = typeof sourceHwndRaw === 'number'
    ? sourceHwndRaw
    : typeof sourceHwndRaw === 'string'
      ? Number(sourceHwndRaw.trim())
      : NaN;
  const targetXRaw = source.targetX ?? source.x;
  const targetYRaw = source.targetY ?? source.y;
  const targetX = typeof targetXRaw === 'number' ? targetXRaw : typeof targetXRaw === 'string' ? Number(targetXRaw.trim()) : NaN;
  const targetY = typeof targetYRaw === 'number' ? targetYRaw : typeof targetYRaw === 'string' ? Number(targetYRaw.trim()) : NaN;
  const sourceHwnd = Number.isFinite(sourceHwndNumber) && sourceHwndNumber > 0
    ? Math.round(sourceHwndNumber)
    : null;
  const targetPoint = Number.isFinite(targetX) && Number.isFinite(targetY)
    ? { x: Math.round(targetX), y: Math.round(targetY) }
    : null;
  const sourceWindowTitle = typeof source.sourceWindowTitle === 'string' ? source.sourceWindowTitle.trim() : app;
  const targetRole = typeof source.targetRole === 'string' ? source.targetRole.trim() : '';

  if ((!app && !sourceHwnd) || !target) {
    return {
      app,
      postVerify,
      requireActionable: true,
      requireSameHwnd: true,
      sourceHwnd,
      sourceWindowTitle,
      target,
      targetPoint,
      targetRole,
    };
  }

  return {
    app,
    postVerify,
    requireActionable: typeof source.requireActionable === 'boolean' ? source.requireActionable : true,
    requireSameHwnd: typeof source.requireSameHwnd === 'boolean' ? source.requireSameHwnd : true,
    sourceHwnd,
    sourceWindowTitle,
    target,
    targetPoint,
    targetRole,
  };
}

function getAgentRuntimeDesktopSequenceCorePlan(toolCall: AgentToolCallCommand) {
  return parseAgentRuntimeCoreTaskPlanJson(getToolStringInput(toolCall, ['runtimeCorePlanJson']));
}

function createAgentRuntimeDesktopSequenceCoreEventLines(result: AgentChatCommandResult, toolCall: AgentToolCallCommand) {
  const plan = getAgentRuntimeDesktopSequenceCorePlan(toolCall);
  if (!plan) {
    return [];
  }

  const outcome = resolveAgentRuntimeCoreSequenceOutcome(
    createAgentRuntimeCoreContext(plan),
    result,
  );

  return [
    `RuntimeCore: task=${plan.taskId}`,
    `RuntimeCore: verified=${outcome.verified} completed=${outcome.completed}`,
    ...outcome.events.map((event) => [
      `RuntimeCore: event=${event.type}`,
      event.stepKind ? `step=${event.stepKind}` : '',
      event.verified !== undefined ? `verified=${event.verified}` : '',
      event.reason ? `reason=${compactAgentRuntimeSequenceText(event.reason, 180)}` : '',
    ].filter(Boolean).join(' | ')),
  ];
}

function isAgentRuntimeToolInputObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAgentRuntimeDesktopSequenceToolName(value: unknown): value is AgentRuntimeDesktopSequenceToolName {
  return value === 'execute_desktop_action' || value === 'execute_desktop_input';
}

function compactAgentRuntimeSequenceText(value: unknown, maxLength = 220) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
  if (!text) {
    return '';
  }

  if (/^(?:open|opened|launched|running|started|complete|completed)$/iu.test(text)) {
    return 'launched';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getAgentRuntimeSequenceStepAction(step: AgentRuntimeDesktopSequenceStep) {
  const rawAction = getToolStringInput({
    input: step.args,
    name: step.tool,
  }, ['action', 'desktopAction', 'operation']);

  return step.tool === 'execute_desktop_action'
    ? normalizeExecuteDesktopAction(rawAction)
    : normalizeExecuteDesktopInputAction(rawAction);
}

function getAgentRuntimeSequenceStepTarget(step: AgentRuntimeDesktopSequenceStep) {
  const target = getToolStringInput({
    input: step.args,
    name: step.tool,
  }, ['query', 'target', 'title', 'processName', 'name']);

  if (!target || /^(?:https?:\/\/|file:\/\/)/iu.test(target) || /^[^\s]+\.[a-z0-9]{2,}(?:[/?#].*)?$/iu.test(target)) {
    return '';
  }

  return target;
}

function getAgentRuntimeSequenceStepNumber(step: AgentRuntimeDesktopSequenceStep, key: string) {
  const value = step.args[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : null;
}

function getAgentRuntimeSequenceStepString(step: AgentRuntimeDesktopSequenceStep, keys: string[]) {
  return getToolStringInput({
    input: step.args,
    name: step.tool,
  }, keys);
}

function getAgentRuntimeDesktopSequenceLastWindowUiStep(steps: AgentRuntimeDesktopSequenceStep[]) {
  return [...steps].reverse().find((step) => (
    step.tool === 'execute_desktop_action'
      && ['interact_window_ui', 'invoke_window_ui'].includes(getAgentRuntimeSequenceStepAction(step))
  )) ?? null;
}

function createAgentRuntimeDesktopSequenceWindowUiRecoveryArgs(
  steps: AgentRuntimeDesktopSequenceStep[],
  query: string,
) {
  const step = getAgentRuntimeDesktopSequenceLastWindowUiStep(steps);
  if (!step) {
    return null;
  }

  const targetText = getAgentRuntimeSequenceStepString(step, [
    'targetText',
    'text',
    'label',
    'name',
    'target',
    'automationId',
  ]);
  const windowQuery = getAgentRuntimeSequenceStepString(step, [
    'query',
    'windowTitle',
    'title',
    'processName',
  ]) || query.trim();
  const targetDescription = getAgentRuntimeSequenceStepString(step, [
    'targetDescription',
    'description',
    'element',
  ]);
  const hwnd = getAgentRuntimeSequenceStepNumber(step, 'hwnd')
    ?? getAgentRuntimeSequenceStepNumber(step, 'windowHandle');

  return {
    action: 'inspect_window_ui',
    forceRefresh: true,
    ...(Number.isFinite(Number(hwnd)) && Number(hwnd) > 0 ? { hwnd: Math.round(Number(hwnd)) } : {}),
    limit: 80,
    maxDepth: 6,
    question: [
      'The previous UI Automation action completed but the requested final state was not verified.',
      'Refresh read-only UI Automation controls for the same window/control before retrying.',
      targetText ? `Target/control text: ${targetText}.` : '',
      'Return enabled/offscreen state, supported actions, blockers/modals, alternate start/open/continue controls, and screen bounds when available.',
      'Do not click or invoke anything.',
    ].filter(Boolean).join(' '),
    ...(targetDescription ? { targetDescription } : targetText ? { targetDescription: targetText } : {}),
    ...(targetText ? { targetText } : {}),
    ...(windowQuery ? { query: windowQuery } : {}),
  };
}

function shouldVerifyAgentRuntimeDesktopSequence(steps: AgentRuntimeDesktopSequenceStep[]) {
  return steps.some((step) => (
    step.tool === 'execute_desktop_action'
      ? AGENT_RUNTIME_DESKTOP_SEQUENCE_VERIFICATION_ACTIONS.has(getAgentRuntimeSequenceStepAction(step))
      : AGENT_RUNTIME_DESKTOP_SEQUENCE_INPUT_VERIFICATION_ACTIONS.has(getAgentRuntimeSequenceStepAction(step))
  ));
}

function getAgentRuntimeDesktopSequenceVerificationQuery(
  steps: AgentRuntimeDesktopSequenceStep[],
  explicitQuery = '',
) {
  if (explicitQuery.trim()) {
    return explicitQuery.trim();
  }

  for (const step of [...steps].reverse()) {
    const action = getAgentRuntimeSequenceStepAction(step);
    if (step.tool === 'execute_desktop_action' && !AGENT_RUNTIME_DESKTOP_SEQUENCE_VERIFICATION_ACTIONS.has(action)) {
      continue;
    }

    if (step.tool === 'execute_desktop_input' && !AGENT_RUNTIME_DESKTOP_SEQUENCE_INPUT_VERIFICATION_ACTIONS.has(action)) {
      continue;
    }

    const target = getAgentRuntimeSequenceStepTarget(step);
    if (target) {
      return target;
    }
  }

  return '';
}

function mergeAgentRuntimeDesktopSequenceLists(
  ...lists: Array<Array<string | null | undefined> | null | undefined>
) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const list of lists) {
    for (const item of list ?? []) {
      const text = typeof item === 'string' ? item.trim() : '';
      if (!text || seen.has(text)) {
        continue;
      }

      seen.add(text);
      merged.push(text);
    }
  }

  return merged;
}

function mergeAgentRuntimeDesktopSequenceStructuredEvidence(
  latestStructuredEvidence: AgentStructuredToolEvidence | null,
  verificationResult: AgentChatCommandResult | null,
) {
  const verificationStructuredEvidence = verificationResult?.stateSummary?.structuredEvidence
    ?? verificationResult?.receipt?.stateSummary?.structuredEvidence
    ?? null;

  if (!latestStructuredEvidence && !verificationStructuredEvidence) {
    return null;
  }

  return {
    ...(latestStructuredEvidence ?? {}),
    ...(verificationStructuredEvidence ?? {}),
  } satisfies AgentStructuredToolEvidence;
}

function isAgentRuntimeDesktopSequenceAuxiliaryStep(step: AgentRuntimeDesktopSequenceStep) {
  return step.tool === 'execute_desktop_action'
    && getAgentRuntimeSequenceStepAction(step) === 'focus_window';
}

function getAgentRuntimeDesktopSequenceActionEvidence(
  result: AgentChatCommandResult,
) {
  return result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? null;
}

function getAgentRuntimeDesktopSequenceActionOutcome(
  status: AgentChatExecutionReceipt['status'],
  stepEvidences: AgentDesktopActionEvidence[],
  verificationResult: AgentChatCommandResult | null,
): AgentDesktopActionOutcome {
  if (status === 'failed' || stepEvidences.some((evidence) => evidence.outcome === 'blocked')) {
    return 'blocked';
  }

  if (stepEvidences.some((evidence) => evidence.outcome === 'no-op')) {
    return 'no-op';
  }

  if (
    status === 'unverified'
    || stepEvidences.some((evidence) => evidence.outcome === 'uncertain')
    || verificationResult?.receipt?.status === 'unverified'
  ) {
    return 'uncertain';
  }

  return 'changed';
}

function getAgentRuntimeDesktopSequenceActionConfidence(outcome: AgentDesktopActionOutcome) {
  switch (outcome) {
    case 'changed':
      return 0.74;
    case 'no-op':
      return 0.7;
    case 'blocked':
      return 0.78;
    case 'uncertain':
    default:
      return 0.4;
  }
}

function getAgentRuntimeDesktopSequenceSnapshotProfile(options: {
  stepEvidences: AgentDesktopActionEvidence[];
  verificationResult: AgentChatCommandResult | null;
}): AgentDesktopActionEvidence['snapshotProfile'] {
  if (
    options.verificationResult
    || options.stepEvidences.some((evidence) => evidence.snapshotProfile === 'heavy')
  ) {
    return 'heavy';
  }

  if (options.stepEvidences.some((evidence) => evidence.snapshotProfile === 'replay')) {
    return 'replay';
  }

  return 'light';
}

function createAgentRuntimeDesktopSequenceActionEvidence(options: {
  completedCount: number;
  evidenceLines: string[];
  failedStepIndex: number | null;
  status: AgentChatExecutionReceipt['status'];
  stepCount: number;
  stepEvidences: AgentDesktopActionEvidence[];
  verificationResult: AgentChatCommandResult | null;
}): AgentDesktopActionEvidence {
  const outcome = getAgentRuntimeDesktopSequenceActionOutcome(
    options.status,
    options.stepEvidences,
    options.verificationResult,
  );
  const firstEvidence = options.stepEvidences[0] ?? null;
  const latestEvidence = options.stepEvidences.at(-1) ?? null;
  const verificationState = options.verificationResult?.stateSummary;
  const changed = outcome === 'changed'
    ? true
    : outcome === 'no-op'
      ? false
      : null;

  return {
    action: 'sequence',
    after: verificationState?.observedState?.length
      ? {
          observedState: verificationState.observedState.slice(0, 12),
          targetWindow: verificationState.structuredEvidence?.finalWindow ?? null,
        }
      : latestEvidence?.after ?? null,
    before: firstEvidence?.before ?? null,
    confidence: getAgentRuntimeDesktopSequenceActionConfidence(outcome),
    diff: {
      changed,
      signals: [
        `stepsCompleted=${options.completedCount}/${options.stepCount}`,
        options.failedStepIndex ? `failedStep=${options.failedStepIndex}` : '',
        options.verificationResult?.receipt?.status ? `verificationReceipt=${options.verificationResult.receipt.status}` : '',
        ...options.stepEvidences.map((evidence, index) => `step${index + 1}=${evidence.outcome}`),
      ].filter(Boolean),
      summary: outcome === 'changed'
        ? 'Desktop sequence completed and available evidence supports a state change.'
        : outcome === 'no-op'
          ? 'Desktop sequence completed, but at least one action step reported no visible state change.'
          : outcome === 'blocked'
            ? 'Desktop sequence was blocked or failed before a verified final state.'
            : 'Desktop sequence ran, but available evidence is insufficient to verify the requested state change.',
    },
    outcome,
    snapshotProfile: getAgentRuntimeDesktopSequenceSnapshotProfile({
      stepEvidences: options.stepEvidences,
      verificationResult: options.verificationResult,
    }),
    targetRef: latestEvidence?.targetRef ?? firstEvidence?.targetRef ?? null,
    timestamp: Date.now(),
    tool: 'execute_desktop_sequence',
  };
}

function createAgentRuntimeDesktopSequenceVisualQuestion(query: string) {
  return [
    'After the approved desktop input/action sequence, inspect the current visible UI state.',
    query ? `Expected target/content: ${query}.` : '',
    'If this is a launcher/list/detail UI, separate action success from selection state: visible target text is not enough.',
    'Verify whether the target is the current selected item/detail page/title/main action owner.',
    'Classify whether the UI appears launched/opened, waiting_target, loading, login_required, updating/downloading, error, unchanged, blocked, selection_mismatch, visible_only, or unknown.',
    'Use waiting_target when the start/open/play action appears sent but the requested target process/window/content has not appeared yet. Do not retry the same click for waiting_target.',
    'Return compact JSON using the normal desktop snapshot fields and set postActionState to exactly one of: launched, waiting_target, loading, login_required, updating, error, unchanged, blocked, selection_mismatch, visible_only, unknown.',
    'When relevant include currentSelection, selectionVerificationStatus, and selectionEvidence.',
    'Do not mark launched unless the expected target/content is visibly open/running or the current selected/detail state is confirmed for that target.',
    'Include readableText, uncertainty, confidence, and any visible recovery clue.',
  ].filter(Boolean).join(' ');
}

function normalizeAgentRuntimeDesktopSequencePostActionText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase()
    : '';
}

function inferAgentRuntimeDesktopSequenceSelectionPostActionState(text: string) {
  if (/(?:selection_mismatch|selected\s+(?:item|target)\s+(?:is|remains|still)\s+(?:not|different|wrong)|current\s+(?:selection|detail|page|title)\s+(?:is|remains|still)\s+(?:not|different|wrong)|"selectionverificationstatus"\s*:\s*"mismatch")/iu.test(text)) {
    return 'selection_mismatch';
  }

  if (/(?:visible_only|visible\s+only|target\s+(?:is\s+)?(?:visible|shown)\s+but\s+not\s+(?:selected|current)|not\s+selected|"selectionverificationstatus"\s*:\s*"visible-only")/iu.test(text)) {
    return 'visible_only';
  }

  return '';
}

function normalizeAgentRuntimeDesktopSequencePostActionState(value: unknown) {
  const text = normalizeAgentRuntimeDesktopSequencePostActionText(value).trim();
  if (!text) {
    return '';
  }

  const selectionState = inferAgentRuntimeDesktopSequenceSelectionPostActionState(text);
  if (selectionState) {
    return selectionState;
  }

  const hasNewTransitionalNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see)[^\n.]{0,36}(?:error|error_dialog|failed|failure|crash|exception)/iu.test(text);
  const hasNewTransitionalFailure = !hasNewTransitionalNegatedError
    && /(?:error|error_dialog|failed|failure|crash|exception)/iu.test(text);
  if (
    !hasNewTransitionalFailure
    && /(?:verifying|extracting|preparing|queued|queue|waiting\s+in\s+queue)/iu.test(text)
  ) {
    return 'updating';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:waiting_target|waiting\s+for\s+(?:the\s+)?(?:target|game|app|application|window|client|server)|target\s+(?:process|window|client|app|game)\s+(?:not\s+)?(?:yet\s+)?(?:appeared|visible|running|detected)|start(?:ed)?\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|launch\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|\u7b49\u5f85.{0,16}(?:\u76ee\u6807|\u6e38\u620f|\u7a97\u53e3|\u8fdb\u7a0b)|(?:\u76ee\u6807|\u6e38\u620f).{0,16}(?:\u672a|\u8fd8\u6ca1).{0,16}(?:\u51fa\u73b0|\u542f\u52a8|\u8fd0\u884c))/iu.test(text)
  ) {
    return 'waiting_target';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:opening|initializing|connecting|spinner)/iu.test(text)
  ) {
    return 'loading';
  }

  if (!hasNewTransitionalNegatedError && /(?:error|error_dialog|failed|failure|crash|exception)/iu.test(text)) {
    return 'error';
  }

  if (/(?:login_required|login|sign\s*in|password|account|qr\s*code)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:updating|update|download|install|patch)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|please\s*wait|progress)/iu.test(text)) {
    return 'loading';
  }

  if (/(?:unchanged|no\s+visible\s+change|same\s+screen)/iu.test(text)) {
    return 'unchanged';
  }

  if (/(?:blocked|permission|denied|blocked_by)/iu.test(text)) {
    return 'blocked';
  }

  if (/(?:launched|opened|running|started)/iu.test(text)) {
    return 'launched';
  }

  if (/(?:unknown|unclear)/iu.test(text)) {
    return 'unknown';
  }

  return '';
}

export function inferAgentRuntimeDesktopSequencePostActionState(result: AgentChatCommandResult | null) {
  const structuredPostActionState = normalizeAgentRuntimeDesktopSequencePostActionState(
    result?.stateSummary?.structuredEvidence?.postActionState
      ?? result?.receipt?.stateSummary?.structuredEvidence?.postActionState,
  );
  if (structuredPostActionState) {
    return structuredPostActionState;
  }

  const text = normalizeAgentRuntimeDesktopSequencePostActionText([
    result?.responseText,
    result?.verification,
    result?.observations?.join('\n'),
    result?.stateSummary?.observedState?.join('\n'),
    result?.stateSummary?.verificationEvidence?.join('\n'),
    result?.stateSummary?.missingEvidence?.join('\n'),
    result?.stateSummary?.structuredEvidence ? JSON.stringify(result.stateSummary.structuredEvidence) : '',
  ].filter(Boolean).join('\n'));

  if (!text) {
    return 'unknown';
  }

  const hasNewTransitionalNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see)[^\n.]{0,36}(?:error|failed|failure|crash|exception)/iu.test(text);
  const hasNewTransitionalFailure = !hasNewTransitionalNegatedError
    && /(?:error|failed|failure|crash|exception)/iu.test(text);
  if (
    !hasNewTransitionalFailure
    && /(?:verifying|extracting|preparing|queued|queue|waiting\s+in\s+queue)/iu.test(text)
  ) {
    return 'updating';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:waiting_target|waiting\s+for\s+(?:the\s+)?(?:target|game|app|application|window|client|server)|target\s+(?:process|window|client|app|game)\s+(?:not\s+)?(?:yet\s+)?(?:appeared|visible|running|detected)|start(?:ed)?\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|launch\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|\u7b49\u5f85.{0,16}(?:\u76ee\u6807|\u6e38\u620f|\u7a97\u53e3|\u8fdb\u7a0b)|(?:\u76ee\u6807|\u6e38\u620f).{0,16}(?:\u672a|\u8fd8\u6ca1).{0,16}(?:\u51fa\u73b0|\u542f\u52a8|\u8fd0\u884c))/iu.test(text)
  ) {
    return 'waiting_target';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:opening|initializing|connecting|spinner)/iu.test(text)
  ) {
    return 'loading';
  }

  const normalizedPostActionState = normalizeAgentRuntimeDesktopSequencePostActionState(text);
  if (normalizedPostActionState) {
    return normalizedPostActionState;
  }

  if (!hasNewTransitionalNegatedError && /(?:error|failed|failure|crash|exception)/iu.test(text)) {
    return 'error';
  }

  if (/(?:login|sign in|password|account|qr code)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:update|updating|download|install|patch)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|please wait|progress)/iu.test(text)) {
    return 'loading';
  }

  if (/(?:unchanged|no visible change|same screen)/iu.test(text)) {
    return 'unchanged';
  }

  if (/(?:opened|launched|running|started)/iu.test(text)) {
    return 'launched';
  }

  return 'unknown';
}

function createAgentRuntimeDesktopSequencePostActionRecoveryDirective(
  postActionState: string,
  query: string,
  steps: AgentRuntimeDesktopSequenceStep[] = [],
): AgentStructuredToolRecoveryEvidence | null {
  const targetQuery = query.trim();
  const withQuery = (args: Record<string, unknown>) => (
    targetQuery ? { ...args, query: targetQuery } : args
  );
  const windowUiRecoveryArgs = createAgentRuntimeDesktopSequenceWindowUiRecoveryArgs(steps, targetQuery);

  switch (postActionState) {
    case 'waiting_target':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 3000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The launch/start action appears sent, but the requested target is not visible/running yet. Wait and poll target window/process evidence instead of retrying the same click.',
        strategy: 'wait-and-observe',
      };
    case 'loading':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 2500,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The visible UI is still launching/loading, so refresh evidence after a short wait instead of asking the user whether to continue.',
        strategy: 'wait-and-observe',
      };
    case 'updating':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 5000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The visible UI is updating/downloading/installing, so observe progress again later and avoid random clicks.',
        strategy: 'wait-and-observe',
      };
    case 'unchanged':
      if (windowUiRecoveryArgs) {
        return {
          nextArgs: windowUiRecoveryArgs,
          nextTool: 'execute_desktop_observation',
          reason: 'The UI did not visibly change after a UI Automation action. Refresh the same window controls with read-only UI Automation before retrying or falling back to coordinates.',
          strategy: 'refresh-observation',
        };
      }

      return {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          ...(targetQuery ? { targetDescription: targetQuery } : {}),
        },
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI did not change after the input, so refresh target/action coordinates before retrying only the unclear primitive.',
        strategy: 're-locate-target',
      };
    case 'selection_mismatch':
    case 'visible_only':
      if (windowUiRecoveryArgs) {
        return {
          nextArgs: {
            ...windowUiRecoveryArgs,
            question: [
              'The target item may be visible, but current selection/detail state is not verified.',
              'Refresh read-only UI Automation controls and identify selected/current list item, detail title, and target item bounds.',
              'Do not click or invoke anything.',
            ].join(' '),
          },
          nextTool: 'execute_desktop_observation',
          reason: 'The previous action did not prove that the target item became the current selected/detail item. Refresh selection evidence before starting or claiming success.',
          strategy: 'refresh-observation',
        };
      }

      return {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          ...(targetQuery ? { targetDescription: targetQuery } : {}),
          question: [
            'Find the target item and verify whether it is the current selected/highlighted item or current detail page.',
            'Return currentSelection, selectionVerificationStatus, targetCandidates, and coordinates for the target item if it needs to be selected.',
          ].join(' '),
        },
        nextTool: 'locate_screen_elements',
        reason: 'The target is visible but not confirmed as selected/current. Re-locate the target item and selection state before retrying.',
        strategy: 're-locate-target',
      };
    case 'error':
      return {
        nextArgs: {
          action: 'describe_elements',
          forceRefresh: true,
          question: targetQuery
            ? `Read the visible error text and recovery controls related to: ${targetQuery}.`
            : 'Read the visible error text and any recovery controls.',
          targetDescription: 'visible error text and recovery controls',
        },
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI appears to show an error, so read the error text before retrying or reporting a blocker.',
        strategy: 'read-error',
      };
    case 'blocked':
      return {
        nextArgs: {
          action: 'describe_elements',
          forceRefresh: true,
          question: targetQuery
            ? `Read the visible blocker, permission prompt, or modal related to: ${targetQuery}.`
            : 'Read the visible blocker, permission prompt, modal, or confirmation gate.',
          targetDescription: 'visible blocker, permission prompt, modal, or confirmation gate',
        },
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI appears blocked by a gate, so inspect the blocker before retrying or asking the user.',
        strategy: 'read-blocker',
      };
    case 'unknown':
      if (windowUiRecoveryArgs) {
        return {
          nextArgs: windowUiRecoveryArgs,
          nextTool: 'execute_desktop_observation',
          reason: 'The post-action state is unknown after a UI Automation action. Read the current UI Automation controls before deciding whether to wait, retry, or ask the user.',
          strategy: 'refresh-observation',
        };
      }

      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 1000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The post-action visual state is unknown, so refresh observation once before retrying or asking a short question.',
        strategy: 'refresh-observation',
      };
    case 'login_required':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: 'Read the visible login/account page. Locate safe login continuation controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered. Also report captcha, QR-code scan, SMS code, two-factor verification, empty required input, or admin/UAC gates. Do not click anything.',
          targetDescription: 'login continuation controls and non-automatable verification gates',
          targetText: '登录 快速登录 安全登录 Sign in Log in Continue Confirm OK',
        }),
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI requires login/account continuation. Read safe login controls first; only ask the user for captcha, QR scan, 2FA, empty credentials, or admin confirmation.',
        strategy: 're-locate-target',
      };
    case 'launched':
      return null;
    default:
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 1000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The post-action state is not actionable yet, so refresh observation before deciding the next step.',
        strategy: 'refresh-observation',
      };
  }
}

function formatAgentRuntimeDesktopSequenceRecoveryDirective(
  directive: AgentStructuredToolRecoveryEvidence | null,
) {
  if (!directive?.strategy) {
    return '';
  }

  return [
    `postActionRecoveryStrategy=${directive.strategy}`,
    directive.nextTool ? `nextTool=${directive.nextTool}` : '',
    directive.nextArgs ? `nextArgs=${JSON.stringify(directive.nextArgs)}` : '',
    directive.reason ? `reason=${directive.reason}` : '',
  ].filter(Boolean).join(' | ');
}

function createAgentRuntimeDesktopSequencePostActionRecovery(
  postActionState: string,
  steps: AgentRuntimeDesktopSequenceStep[] = [],
) {
  const hasWindowUiStep = Boolean(getAgentRuntimeDesktopSequenceLastWindowUiStep(steps));
  switch (postActionState) {
    case 'waiting_target':
      return [
        'The post-action state is waiting_target: the start/open/play action appears sent, but the requested target process/window/content has not appeared yet. Wait and poll window/process evidence; do not retry the same click unless later evidence proves it did nothing.',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:observe_windows_and_apps',
      ];
    case 'launched':
      return [
        'The post-action visual state looks launched/opened. If the original request had more steps, continue with those steps; otherwise answer from the evidence.',
      ];
    case 'loading':
      return [
        'The post-action visual state looks like loading/launching. Wait briefly, then refresh window and visual observation before deciding whether to retry or answer.',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:execute_desktop_observation',
        'tool:observe_windows_and_apps',
      ];
    case 'login_required':
      return [
        'The post-action visual state appears to require login or account continuation. First locate safe login controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered.',
        'Ask the user only for captcha, QR scan, two-factor/SMS verification, empty required credentials, admin/UAC confirmation, or another non-automatable private gate.',
        'tool:locate_screen_elements',
      ];
    case 'updating':
      return [
        'The post-action visual state appears to be updating/downloading/installing. Observe progress again later instead of clicking random controls.',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:execute_desktop_observation',
      ];
    case 'error':
      return [
        'The post-action visual state appears to show an error. Read the visible error text, then decide whether to retry, use another visible control, or report the error.',
        'tool:locate_screen_elements',
        'tool:execute_desktop_observation',
      ];
    case 'blocked':
      return [
        'The post-action visual state appears blocked by permission, policy, modal confirmation, or another gate. Read the visible blocker before retrying.',
        'tool:locate_screen_elements',
        'tool:execute_desktop_observation',
      ];
    case 'unchanged':
      return [
        'The post-action visual state appears unchanged. Re-locate the intended element with forceRefresh, verify coordinates, then retry only if the target is still clear.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:locate_screen_elements',
        'tool:get_cursor_position',
      ].filter(Boolean);
    case 'selection_mismatch':
      return [
        'The post-action visual state says the current selected/detail item does not match the requested target. Do not claim success or press the launch/start button yet.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:locate_screen_elements',
      ].filter(Boolean);
    case 'visible_only':
      return [
        'The target is visible but not confirmed as selected/current. Select the target item first, then verify selection before looking for the primary action.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:locate_screen_elements',
      ].filter(Boolean);
    default:
      return [
        'The post-action visual state is unknown. Refresh visual/window observation, then decide whether to retry the unclear primitive or ask one short question.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:execute_desktop_observation',
        'tool:locate_screen_elements',
      ].filter(Boolean);
  }
}

async function executeDesktopSequencePostVerification(
  context: AgentRuntimeExecutorContext,
  steps: AgentRuntimeDesktopSequenceStep[],
  options: {
    enabled: boolean;
    query: string;
    requireSameHwnd?: boolean;
    sourceHwnd?: number | null;
    sourceQuery?: string;
    visualQuery: string;
  },
): Promise<AgentChatCommandResult | null> {
  if (!options.enabled || !shouldVerifyAgentRuntimeDesktopSequence(steps)) {
    return null;
  }

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult('execute_desktop_sequence');
  }

  await waitForDesktopActionWindowSettle(700);
  const query = getAgentRuntimeDesktopSequenceVerificationQuery(steps, options.query);
  const windowVerificationResult = await executeObserveWindowsAndApps({
    goal: 'Verify desktop state after execute_desktop_sequence',
    input: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeDisplays: true,
      includeRunningApps: true,
      limit: 12,
      ...(query ? { query } : {}),
    },
    name: 'observe_windows_and_apps',
  });

  const visualQuery = options.visualQuery.trim();
  if (!visualQuery) {
    return windowVerificationResult;
  }

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult('execute_desktop_sequence');
  }

  const visualVerificationResult = await executeSummarizeVisualSnapshot(
    context,
    {
      goal: 'Visually verify UI state after execute_desktop_sequence',
      input: {
        allowScreenFallback: options.requireSameHwnd !== true,
        forceRefresh: true,
        ...(Number.isFinite(options.sourceHwnd) && Number(options.sourceHwnd) > 0
          ? {
              hwnd: Math.round(Number(options.sourceHwnd)),
              sourceId: `window:${Math.round(Number(options.sourceHwnd))}:0`,
            }
          : {}),
        question: createAgentRuntimeDesktopSequenceVisualQuestion(visualQuery),
        ...(options.sourceQuery ? { sourceQuery: options.sourceQuery } : {}),
        sourceType: options.requireSameHwnd ? 'window' : 'all',
      },
      name: 'summarize_visual_snapshot',
    },
    visualQuery,
  );

  const visualOk = inferAgentRuntimeToolResultOk(visualVerificationResult);
  const windowOk = inferAgentRuntimeToolResultOk(windowVerificationResult);
  const postActionState = inferAgentRuntimeDesktopSequencePostActionState(visualVerificationResult);
  const postActionRecovery = createAgentRuntimeDesktopSequencePostActionRecoveryDirective(
    postActionState,
    visualQuery || query,
    steps,
  );
  const status: AgentChatExecutionReceipt['status'] = !visualOk && !windowOk
    ? 'failed'
    : postActionState === 'launched'
      ? 'success'
      : 'unverified';
  const stateSummary = {
    changedState: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.changedState,
      visualVerificationResult.stateSummary?.changedState,
    ),
    missingEvidence: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.missingEvidence,
      visualVerificationResult.stateSummary?.missingEvidence,
      status === 'success' ? [] : [`Post-sequence visual state is ${postActionState}, so the requested final state is not yet confirmed.`],
    ),
    observedState: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.observedState,
      windowVerificationResult.observations,
      visualVerificationResult.stateSummary?.observedState,
      visualVerificationResult.observations,
    ),
    recommendedRecovery: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.recommendedRecovery,
      visualVerificationResult.stateSummary?.recommendedRecovery,
      createAgentRuntimeDesktopSequencePostActionRecovery(postActionState, steps),
      [formatAgentRuntimeDesktopSequenceRecoveryDirective(postActionRecovery)],
    ),
    structuredEvidence: mergeAgentRuntimeDesktopSequenceStructuredEvidence(null, visualVerificationResult),
    verificationEvidence: mergeAgentRuntimeDesktopSequenceLists(
      windowVerificationResult.stateSummary?.verificationEvidence,
      visualVerificationResult.stateSummary?.verificationEvidence,
      [
        windowVerificationResult.verification,
        visualVerificationResult.verification,
      ],
    ),
  };
  stateSummary.structuredEvidence = stateSummary.structuredEvidence
    ? {
        ...stateSummary.structuredEvidence,
        postActionRecovery,
        postActionState,
      }
    : {
        postActionRecovery,
        postActionState,
        status,
      };
  stateSummary.observedState = mergeAgentRuntimeDesktopSequenceLists(
    stateSummary.observedState,
    [`Post-action visual state: ${postActionState}`],
  );

  const responseText = [
    'Post-sequence window/app observation:',
    windowVerificationResult.responseText,
    'Post-sequence visual state observation:',
    visualVerificationResult.responseText,
  ].filter(Boolean).join('\n');
  const verification = [
    windowVerificationResult.verification || windowVerificationResult.responseText,
    visualVerificationResult.verification || visualVerificationResult.responseText,
  ].filter(Boolean).join(' | ');

  return createAgentRuntimeResult({
    errorText: status === 'failed'
      ? visualVerificationResult.errorText || windowVerificationResult.errorText || 'Post-sequence verification failed.'
      : null,
    observations: [
      ...(windowVerificationResult.observations ?? []).map((line) => `Window verification: ${line}`),
      ...(visualVerificationResult.observations ?? []).map((line) => `Visual verification: ${line}`),
    ],
    ok: status !== 'failed',
    receipt: {
      evidenceLines: [
        ...(windowVerificationResult.receipt?.evidenceLines ?? windowVerificationResult.observations ?? [])
          .slice(0, 16)
          .map((line) => `Window: ${line}`),
        ...(visualVerificationResult.receipt?.evidenceLines ?? visualVerificationResult.observations ?? [])
          .slice(0, 16)
          .map((line) => `Visual: ${line}`),
      ],
      status,
      stateSummary,
      summaryLines: [
        'Call: execute_desktop_sequence post verification',
        `Window observation: ${windowOk ? 'ok' : 'failed'}`,
        `Visual observation: ${visualOk ? 'ok' : 'failed'}`,
      ],
      title: 'Agent desktop sequence verification',
      toolName: 'execute_desktop_sequence',
      verification,
    },
    responseText,
    stateSummary,
    verification,
  });
}

function parseAgentRuntimeDesktopSequenceSteps(toolCall: AgentToolCallCommand): AgentRuntimeDesktopSequenceParseResult {
  const stepsJson = getToolStringInput(toolCall, ['stepsJson', 'sequenceJson']);
  if (!stepsJson) {
    return {
      error: 'execute_desktop_sequence needs stepsJson.',
      ok: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stepsJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: `execute_desktop_sequence stepsJson is not valid JSON: ${message}`,
      ok: false,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      error: 'execute_desktop_sequence stepsJson must be a JSON array.',
      ok: false,
    };
  }

  if (parsed.length === 0) {
    return {
      error: 'execute_desktop_sequence needs at least one step.',
      ok: false,
    };
  }

  if (parsed.length > AGENT_RUNTIME_DESKTOP_SEQUENCE_MAX_STEPS) {
    return {
      error: `execute_desktop_sequence supports at most ${AGENT_RUNTIME_DESKTOP_SEQUENCE_MAX_STEPS} steps.`,
      ok: false,
    };
  }

  const steps: AgentRuntimeDesktopSequenceStep[] = [];
  for (const [index, value] of parsed.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        error: `execute_desktop_sequence step ${index + 1} must be an object.`,
        ok: false,
      };
    }

    const source = value as Record<string, unknown>;
    if (!isAgentRuntimeDesktopSequenceToolName(source.tool)) {
      return {
        error: `execute_desktop_sequence step ${index + 1} must use execute_desktop_action or execute_desktop_input.`,
        ok: false,
      };
    }

    const rawArgs = source.args ?? source.input;
    if (!isAgentRuntimeToolInputObject(rawArgs)) {
      return {
        error: `execute_desktop_sequence step ${index + 1} needs object args.`,
        ok: false,
      };
    }

    const preparedInput = prepareAgentToolInput(source.tool, rawArgs);
    if (preparedInput.ok === false) {
      return {
        error: `execute_desktop_sequence step ${index + 1}: ${preparedInput.error}`,
        ok: false,
      };
    }

    steps.push({
      args: preparedInput.input,
      reason: typeof source.reason === 'string' ? source.reason.trim() : null,
      tool: source.tool,
    });
  }

  return {
    ok: true,
    steps,
  };
}

async function runAgentRuntimeDesktopSequenceSteps(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  steps: AgentRuntimeDesktopSequenceStep[],
  options?: {
    observationPrefix?: string;
    postVerify?: boolean;
    postVerifyHwnd?: number | null;
    postVerifyQuery?: string;
    postVerifyRequired?: boolean;
    postVerifyRequireSameHwnd?: boolean;
    postVerifySourceQuery?: string;
    postVerifyVisualQuery?: string;
    stopOnError?: boolean;
    summaryLabel?: string;
  },
): Promise<AgentChatCommandResult> {
  const stopOnError = options?.stopOnError ?? getToolBooleanInput(toolCall, 'stopOnError') !== false;
  const postVerify = options?.postVerify ?? getToolBooleanInput(toolCall, 'postVerify') !== false;
  const postVerifyRequired = options?.postVerifyRequired ?? getToolBooleanInput(toolCall, 'postVerifyRequired') === true;
  const postVerifyQuery = options?.postVerifyQuery ?? getToolStringInput(toolCall, ['postVerifyQuery', 'verifyQuery', 'query', 'target']);
  const postVerifyVisualQuery = options?.postVerifyVisualQuery ?? getToolStringInput(toolCall, ['postVerifyVisualQuery', 'visualVerifyQuery', 'visualQuery']);
  const summaryLabel = options?.summaryLabel ?? 'execute_desktop_sequence';
  const evidenceLines: string[] = [];
  const observations: string[] = [
    options?.observationPrefix ?? '',
    `Desktop sequence step count: ${steps.length}`,
    `Desktop sequence stopOnError: ${stopOnError}`,
    `Desktop sequence postVerify: ${postVerify}`,
    `Desktop sequence postVerifyRequired: ${postVerifyRequired}`,
    postVerifyQuery ? `Desktop sequence postVerify query: ${postVerifyQuery}` : '',
    postVerifyVisualQuery ? `Desktop sequence visual postVerify query: ${postVerifyVisualQuery}` : '',
  ].filter(Boolean);
  let completedCount = 0;
  let failedStepIndex: number | null = null;
  let failedStepText: string | null = null;
  let auxiliaryStepFailure = false;
  let hasUnverifiedStep = false;
  let latestStructuredEvidence: AgentStructuredToolEvidence | null = null;
  let latestFocusedWindow: AgentStructuredToolWindowEvidence | null = null;
  const stepActionEvidences: AgentDesktopActionEvidence[] = [];

  for (const [index, step] of steps.entries()) {
    if (isAgentRuntimeCancellationRequested(context)) {
      return createAgentRuntimeCancelledResult(toolCall);
    }

    const previousStep = index > 0 ? steps[index - 1] : null;
    const previousAction = previousStep ? getAgentRuntimeSequenceStepAction(previousStep) : '';
    let preStepObservation: Awaited<ReturnType<typeof refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange>> = null;
    if (
      previousStep
      && isAgentRuntimeDesktopSequenceSurfaceChangingStep(previousStep)
      && isAgentRuntimeDesktopSequenceWindowDependentStep(step)
    ) {
      preStepObservation = await refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange(
        context,
        previousStep,
        step,
        latestFocusedWindow,
      );
      latestFocusedWindow = preStepObservation?.window ?? null;
      if (preStepObservation?.result.stateSummary?.structuredEvidence) {
        latestStructuredEvidence = preStepObservation.result.stateSummary.structuredEvidence;
      }
    }
    const preStepBlockedResult = (
      previousStep
      && isAgentRuntimeDesktopSequenceSurfaceChangingStep(previousStep)
      && isAgentRuntimeDesktopSequenceWindowDependentStep(step)
      && !latestFocusedWindow
    )
      ? createAgentRuntimeDesktopSequenceUnresolvedWindowResult(
          preStepObservation?.target || getAgentRuntimeDesktopSequenceRawTarget(previousStep),
          getAgentRuntimeSequenceStepAction(step) || step.tool,
        )
      : null;
    const stepArgs = step.tool === 'execute_desktop_input'
      ? createAgentRuntimeDesktopSequenceInputArgs(step.args, latestFocusedWindow)
      : createAgentRuntimeDesktopSequenceActionArgs(step.args, latestFocusedWindow, previousStep);
    const nestedToolCall: AgentToolCallCommand = {
      goal: step.reason || `execute_desktop_sequence step ${index + 1}`,
      input: stepArgs,
      name: step.tool,
    };
    let result = preStepBlockedResult
      ?? (step.tool === 'execute_desktop_action'
        ? await executeDesktopAction(context, nestedToolCall)
        : await executeDesktopInput(nestedToolCall));
    let windowReadyRetryCount = 0;
    const currentAction = typeof step.args.action === 'string'
      ? step.args.action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
      : '';
    const followsWindowCreation = [
      'launch_local_app',
      'open_resource',
      'search_web',
    ].includes(previousAction);
    while (
      step.tool === 'execute_desktop_action'
      && currentAction === 'move_window_to_display'
      && followsWindowCreation
      && result.ok === false
      && /no-window-match/iu.test(`${result.errorText ?? ''}\n${result.responseText ?? ''}\n${result.verification ?? ''}`)
      && windowReadyRetryCount < 3
    ) {
      windowReadyRetryCount += 1;
      await waitForDesktopActionWindowSettle(400 * windowReadyRetryCount);
      if (isAgentRuntimeCancellationRequested(context)) {
        return createAgentRuntimeCancelledResult(toolCall);
      }
      result = await executeDesktopAction(context, nestedToolCall);
    }
    const enrichedResult = enrichDesktopSequenceNestedResult(nestedToolCall, result);
    const stepStructuredEvidence = enrichedResult.stateSummary?.structuredEvidence
      ?? enrichedResult.receipt?.stateSummary?.structuredEvidence
      ?? null;
    if (stepStructuredEvidence) {
      latestStructuredEvidence = stepStructuredEvidence;
    }
    if (step.tool === 'execute_desktop_action') {
      const stepAction = getAgentRuntimeSequenceStepAction(step);
      const focusedWindow = getAgentRuntimeDesktopSequenceFinalWindow(enrichedResult);
      if (focusedWindow?.hwnd || focusedWindow?.title || focusedWindow?.processName) {
        latestFocusedWindow = focusedWindow;
      } else if (['launch_local_app', 'open_resource', 'search_web'].includes(stepAction)) {
        latestFocusedWindow = null;
      }
    }
    const stepActionEvidence = getAgentRuntimeDesktopSequenceActionEvidence(enrichedResult);
    if (stepActionEvidence) {
      stepActionEvidences.push(stepActionEvidence);
    }
    if (
      enrichedResult.receipt?.status === 'unverified'
      || stepStructuredEvidence?.status === 'unverified'
      || stepStructuredEvidence?.captureTrusted === false
      || stepStructuredEvidence?.inputReplayPreview?.uiChanged === false
      || stepActionEvidence?.outcome === 'no-op'
      || stepActionEvidence?.outcome === 'uncertain'
      || (
        stepStructuredEvidence?.inputReplayPreview?.coordinateClosureStatus
        && stepStructuredEvidence.inputReplayPreview.coordinateClosureStatus !== 'coordinate_closure_ok'
      )
    ) {
      hasUnverifiedStep = true;
    }
    const stepOk = inferAgentRuntimeToolResultOk(enrichedResult);
    const compactResponse = compactAgentRuntimeSequenceText(enrichedResult.responseText);
    const compactError = compactAgentRuntimeSequenceText(enrichedResult.errorText);
    const receiptEvidence = enrichedResult.receipt?.evidenceLines?.length
      ? compactAgentRuntimeSequenceText(enrichedResult.receipt.evidenceLines.join(' | '))
      : '';
    const inputBackendEvidence = enrichedResult.receipt?.evidenceLines
      ?.filter((line) => /^(?:Input backend|Input attempt|Input foreground|Input diagnostic|Input stage)/iu.test(line))
      .slice(0, 8)
      .map((line) => compactAgentRuntimeSequenceText(line, 360))
      .join(' || ') ?? '';
    const inputReplayChanged = typeof stepStructuredEvidence?.inputReplayPreview?.uiChanged === 'boolean'
      ? `inputReplayChanged=${stepStructuredEvidence.inputReplayPreview.uiChanged}`
      : '';
    const inputReplayClosure = stepStructuredEvidence?.inputReplayPreview?.coordinateClosureStatus
      ? `inputReplayClosure=${stepStructuredEvidence.inputReplayPreview.coordinateClosureStatus}`
      : '';
    const actionEvidenceOutcome = stepActionEvidence?.outcome
      ? `actionOutcome=${stepActionEvidence.outcome}`
      : '';
    const stepLine = [
      `Step ${index + 1}/${steps.length}`,
      `tool=${step.tool}`,
      `status=${stepOk ? 'ok' : 'failed'}`,
      preStepObservation ? `postCreationWindow=${preStepObservation.window ? 'resolved' : 'unresolved'}` : '',
      step.reason ? `reason=${step.reason}` : '',
      inputReplayChanged,
      inputReplayClosure,
      actionEvidenceOutcome,
      windowReadyRetryCount > 0 ? `windowReadyRetries=${windowReadyRetryCount}` : '',
      compactResponse ? `response=${compactResponse}` : '',
      compactError && compactError !== compactResponse ? `error=${compactError}` : '',
      inputBackendEvidence ? `inputBackendEvidence=${inputBackendEvidence}` : '',
      receiptEvidence ? `evidence=${receiptEvidence}` : '',
    ].filter(Boolean).join(' | ');

    evidenceLines.push(stepLine);
    observations.push(stepLine);

    if (preStepBlockedResult) {
      failedStepIndex = index + 1;
      failedStepText = preStepBlockedResult.errorText
        || preStepBlockedResult.responseText
        || `Step ${index + 1} target resolution failed.`;
      break;
    }

    if (stepOk) {
      completedCount += 1;
      continue;
    }

    if (isAgentRuntimeDesktopSequenceAuxiliaryStep(step)) {
      auxiliaryStepFailure = true;
      observations.push(
        `Step ${index + 1} focus warning: focus_window did not complete; continuing because focus is auxiliary and the next action may still activate the target window.`,
      );
      continue;
    }

    failedStepIndex = index + 1;
    failedStepText = enrichedResult.errorText || enrichedResult.responseText || `Step ${index + 1} failed.`;
    if (stopOnError) {
      break;
    }
  }

  const failed = failedStepIndex !== null;
  const verificationResult = failed
    ? null
    : await executeDesktopSequencePostVerification(context, steps, {
        enabled: postVerify,
        query: postVerifyQuery,
        requireSameHwnd: options?.postVerifyRequireSameHwnd,
        sourceHwnd: options?.postVerifyHwnd,
        sourceQuery: options?.postVerifySourceQuery,
        visualQuery: postVerifyVisualQuery,
      });
  const verificationResultOk = verificationResult ? inferAgentRuntimeToolResultOk(verificationResult) : null;
  if (verificationResult) {
    const verificationEvidence = [
      `Post-sequence verification: ${verificationResultOk ? 'ok' : 'failed'}`,
      verificationResult.responseText ? `response=${compactAgentRuntimeSequenceText(verificationResult.responseText, 420)}` : '',
      verificationResult.errorText ? `error=${compactAgentRuntimeSequenceText(verificationResult.errorText, 260)}` : '',
      verificationResult.receipt?.evidenceLines?.length
        ? `evidence=${compactAgentRuntimeSequenceText(verificationResult.receipt.evidenceLines.join(' | '), 520)}`
        : '',
    ].filter(Boolean).join(' | ');

    evidenceLines.push(verificationEvidence);
    observations.push('Desktop sequence post-verification requested.');
    observations.push(...(verificationResult.observations ?? []).map((line) => `Post-verification ${line}`));
  }

  // A later auxiliary step can fail after an earlier input already produced
  // changed evidence. Preserve that evidence as an uncertain sequence result
  // so the Runtime can verify/recover instead of misclassifying the whole task
  // as a pre-dispatch failure.
  const hasChangedStepBeforeFailure = failed
    && stepActionEvidences.some((evidence) => evidence.outcome === 'changed');
  const status: AgentChatExecutionReceipt['status'] = failed && !hasChangedStepBeforeFailure
    ? 'failed'
    : failed
      ? 'unverified'
      : verificationResultOk === false
      || hasUnverifiedStep
      || (auxiliaryStepFailure
        && !stepActionEvidences.some((evidence) => evidence.outcome === 'changed')
        && verificationResultOk !== true)
      ? 'unverified'
      : 'success';
  const actionEvidence = createAgentRuntimeDesktopSequenceActionEvidence({
    completedCount,
    evidenceLines,
    failedStepIndex,
    status,
    stepCount: steps.length,
    stepEvidences: stepActionEvidences,
    verificationResult,
  });
  const mergedStructuredEvidence = mergeAgentRuntimeDesktopSequenceStructuredEvidence(
    latestStructuredEvidence,
    verificationResult,
  );
  const sequenceStructuredEvidence = mergedStructuredEvidence
    ? {
        ...mergedStructuredEvidence,
        confidence: status === 'success'
          ? mergedStructuredEvidence.confidence ?? 'medium'
          : status === 'unverified'
            ? 'low'
            : mergedStructuredEvidence.postActionRecovery?.nextTool === 'execute_desktop_input'
              ? mergedStructuredEvidence.confidence ?? 'medium'
              : 'low',
        status,
      } satisfies AgentStructuredToolEvidence
    : null;
  const failedRecovery = status === 'failed'
    ? sequenceStructuredEvidence?.postActionRecovery ?? null
    : null;
  const unverifiedMissingEvidence = hasUnverifiedStep
    ? [
        'One or more desktop sequence steps returned unverified red-dot replay, capture, or coordinate-closure evidence.',
        verificationResultOk === true
          ? 'Post-sequence observation matched the requested desktop state, but it does not prove the pointer action changed the intended UI target.'
          : '',
      ].filter(Boolean)
    : [
        'Post-sequence window/app/display observation did not verify the requested final desktop state.',
      ];
  const failedStateSummary = status === 'failed'
    ? {
        actionEvidence,
        missingEvidence: [
          failedStepText || `Desktop sequence failed at step ${failedStepIndex}.`,
        ],
        observedState: observations,
        recommendedRecovery: [
          failedRecovery
            ? formatAgentRuntimeDesktopSequenceRecoveryDirective(failedRecovery)
            : '',
          failedRecovery?.nextTool
            ? `Follow the failed step recovery evidence with ${failedRecovery.nextTool}; do not retry the same failed primitive unchanged.`
            : 'Refresh the failed target evidence before retrying or asking the user.',
        ].filter(Boolean),
        structuredEvidence: sequenceStructuredEvidence,
        verificationEvidence: [
          `execute_desktop_sequence failed at step ${failedStepIndex}.`,
        ],
      }
    : undefined;
  const unverifiedStateSummary = status === 'unverified'
    ? {
        actionEvidence,
        missingEvidence: unverifiedMissingEvidence,
        recommendedRecovery: [
          'Observe windows/apps/displays again, then retry only the unclear primitive or ask the user if the target is ambiguous.',
          'tool:observe_windows_and_apps',
          'tool:execute_desktop_observation',
          'tool:execute_desktop_action',
        ],
        verificationEvidence: verificationResult
          ? [
              verificationResult.verification
                || verificationResult.responseText
                || 'Post-sequence verification was inconclusive.',
            ]
          : undefined,
        structuredEvidence: sequenceStructuredEvidence,
      }
    : undefined;
  const sequenceStateSummary = status === 'unverified'
    ? unverifiedStateSummary
      : status === 'failed'
      ? failedStateSummary
      : sequenceStructuredEvidence
        ? {
            actionEvidence,
            structuredEvidence: sequenceStructuredEvidence,
          }
        : {
            actionEvidence,
          };
  const responseText = failed
    ? `Desktop sequence stopped after ${completedCount}/${steps.length} successful step(s). Step ${failedStepIndex} failed: ${failedStepText}`
    : `Desktop sequence completed ${completedCount}/${steps.length} step(s).${verificationResult ? ` Post-sequence desktop state observation ${verificationResultOk ? 'succeeded' : 'was inconclusive'}.` : ''}`;
  const verification = failed
    ? `execute_desktop_sequence failed at step ${failedStepIndex}.`
    : verificationResult
      ? `execute_desktop_sequence completed all steps in order. Post-sequence verification: ${verificationResult.verification || verificationResult.responseText}`
      : 'execute_desktop_sequence completed all steps in order.';

  const sequenceResult = createAgentRuntimeResult({
    assessment: status === 'unverified'
    ? {
        evidence: evidenceLines,
        nextStep: 'Observe the desktop state again, retry the unclear primitive, or ask the user if the target is ambiguous.',
        status: 'unverified',
        summary: hasUnverifiedStep
          ? 'Desktop sequence steps completed, but at least one step had unverified replay or coordinate-closure evidence.'
          : 'Desktop sequence steps completed, but post-sequence verification did not confirm the requested final state.',
      }
    : undefined,
    errorText: failed
      ? failedStepText
      : postVerifyRequired && status !== 'success'
        ? 'Post-sequence verification did not confirm the requested final state.'
        : null,
    observations,
    ok: postVerifyRequired ? status === 'success' : !failed,
    receipt: {
      evidenceLines,
      status,
      summaryLines: [
        'Call: execute_desktop_sequence',
        `Mode: ${summaryLabel}`,
        `Steps requested: ${steps.length}`,
        `Steps completed: ${completedCount}`,
        failed ? `Failed step: ${failedStepIndex}` : 'Failed step: none',
      ],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification,
      stateSummary: sequenceStateSummary,
    },
    responseText,
    stateSummary: sequenceStateSummary,
    verification,
  });
  const sequenceResultWithLifecycle = attachAgentActionLifecycleDecision(
    sequenceResult,
    evaluateAgentActionLifecycle(sequenceResult),
  );
  const runtimeCoreEventLines = createAgentRuntimeDesktopSequenceCoreEventLines(sequenceResultWithLifecycle, toolCall);

  return runtimeCoreEventLines.length
    ? createAgentRuntimeResult({
        ...sequenceResultWithLifecycle,
        observations: [
          ...(sequenceResultWithLifecycle.observations ?? []),
          ...runtimeCoreEventLines,
        ],
        receipt: sequenceResultWithLifecycle.receipt
          ? {
              ...sequenceResultWithLifecycle.receipt,
              evidenceLines: [
                ...(sequenceResultWithLifecycle.receipt.evidenceLines ?? []),
                ...runtimeCoreEventLines,
              ],
              summaryLines: [
                ...sequenceResultWithLifecycle.receipt.summaryLines,
                'Runtime Core events: attached',
              ],
            }
          : sequenceResultWithLifecycle.receipt,
      })
    : sequenceResultWithLifecycle;
}

function parseAgentRuntimeVisibleClickStrategySteps(command: AgentChatCommand | undefined): AgentRuntimeDesktopSequenceStep[] | null {
  if (command?.toolCall?.name !== 'execute_desktop_sequence') {
    return null;
  }

  const stepsJson = typeof command.toolCall.input.stepsJson === 'string'
    ? command.toolCall.input.stepsJson
    : '';
  if (!stepsJson) {
    return null;
  }

  const parseResult = parseAgentRuntimeDesktopSequenceSteps({
    goal: command.toolCall.goal,
    input: { stepsJson },
    name: 'execute_desktop_sequence',
  });
  if (parseResult.ok === false) {
    return null;
  }

  const clickStep = parseResult.steps.find((step) => (
    step.tool === 'execute_desktop_input'
    && getAgentRuntimeSequenceStepAction(step) === 'click'
  ));
  if (!clickStep) {
    return null;
  }

  const focusSteps = parseResult.steps.filter((step) => (
    step.tool === 'execute_desktop_action'
    && getAgentRuntimeSequenceStepAction(step) === 'focus_window'
  ));
  return [
    ...focusSteps,
    {
      ...clickStep,
      args: {
        ...clickStep.args,
        forceMouseEventFallback: true,
        holdMs: typeof clickStep.args.holdMs === 'number' ? clickStep.args.holdMs : 140,
        intervalMs: typeof clickStep.args.intervalMs === 'number' ? clickStep.args.intervalMs : 160,
        preClickDelayMs: typeof clickStep.args.preClickDelayMs === 'number' ? clickStep.args.preClickDelayMs : 180,
        repeat: 1,
      },
      reason: `${clickStep.reason ?? 'Visible click coordinate action.'} VisibleClick mode intentionally runs one visible pointer click only; keyboard fallbacks are disabled for diagnosis.`,
    },
  ];
}

async function executeAgentRuntimeVisibleClick(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  spec: AgentRuntimeVisibleClickSpec,
): Promise<AgentChatCommandResult> {
  const inheritedTarget = Boolean(spec.sourceHwnd && spec.targetPoint);
  const prefix = `VisibleClick: app=${spec.app || spec.sourceWindowTitle || '<missing>'} target=${spec.target || '<missing>'} sourceHwnd=${spec.sourceHwnd ?? '<none>'} targetPoint=${spec.targetPoint ? `${spec.targetPoint.x},${spec.targetPoint.y}` : '<none>'} requireSameHwnd=${spec.requireSameHwnd} requireActionable=${spec.requireActionable}`;
  if ((!spec.app && !spec.sourceHwnd) || !spec.target) {
    return createAgentRuntimeResult({
      errorText: 'visibleClick requires both app and target.',
      observations: [prefix],
      ok: false,
      receipt: {
        evidenceLines: [prefix, 'visibleClick missing app or target'],
        status: 'failed',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: rejected before focus/locate'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: 'visibleClick requires both app and target.',
      },
      responseText: 'visibleClick requires both app and target.',
      verification: 'visibleClick requires both app and target.',
    });
  }

  const focusToolCall: AgentToolCallCommand = {
    goal: `VisibleClick focus ${spec.app || spec.sourceWindowTitle || `hwnd=${spec.sourceHwnd ?? 'unknown'}`}`,
    input: {
      action: 'focus_window',
      ...(spec.app ? { query: spec.app } : {}),
      ...(!spec.app && spec.sourceHwnd ? { hwnd: spec.sourceHwnd } : {}),
    },
    name: 'execute_desktop_action',
  };
  const focusResult = await executeDesktopAction(context, focusToolCall);
  const focusedWindow = getAgentRuntimeDesktopSequenceFinalWindow(focusResult);
  const focusedHwnd = Number(focusedWindow?.hwnd);
  const focusOk = inferAgentRuntimeToolResultOk(focusResult);
  const hasFocusedHwnd = Number.isFinite(focusedHwnd) && focusedHwnd > 0;
  const observations = [
    prefix,
    `VisibleClick focus ok=${focusOk}`,
    hasFocusedHwnd ? `VisibleClick focusedHwnd=${Math.round(focusedHwnd)}` : 'VisibleClick focusedHwnd=<none>',
  ];

  if (!focusOk || (spec.requireSameHwnd && !hasFocusedHwnd)) {
    const reason = !focusOk
      ? focusResult.errorText || focusResult.responseText || `Could not focus ${spec.app || spec.sourceWindowTitle}.`
      : `VisibleClick requires the current ${spec.app || spec.sourceWindowTitle} window HWND before dispatch.`;
    observations.push(`VisibleClick focusFailure=${reason}`);
    return createAgentRuntimeResult({
      errorText: reason,
      observations,
      ok: false,
      receipt: {
        evidenceLines: observations,
        status: 'failed',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: focus/HWND binding failed'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: reason,
      },
      responseText: `VisibleClick could not bind the target app/window: ${reason}`,
      verification: reason,
    });
  }

  const canReuseInheritedTarget = inheritedTarget
    && spec.targetPoint
    && spec.sourceHwnd
    && hasFocusedHwnd
    && focusedHwnd === spec.sourceHwnd;
  if (canReuseInheritedTarget && spec.targetPoint && spec.sourceHwnd) {
    observations.push(
      'VisibleClick target source=inherited actionable locate evidence',
      `VisibleClick expectedHwnd=${spec.sourceHwnd}`,
      `VisibleClick targetRole=${spec.targetRole || 'unknown'}`,
    );
    return runAgentRuntimeDesktopSequenceSteps(context, toolCall, [
      {
        args: {
          action: 'click',
          button: 'left',
          coordinateSpace: 'native-screen',
          expectedForegroundHwnd: spec.sourceHwnd,
          forceMouseEventFallback: true,
          holdMs: 140,
          intervalMs: 160,
          preClickDelayMs: 180,
          repeat: 1,
          x: spec.targetPoint.x,
          y: spec.targetPoint.y,
        },
        reason: `VisibleClick inherited target "${spec.target}" at (${spec.targetPoint.x}, ${spec.targetPoint.y}) in HWND ${spec.sourceHwnd}.`,
        tool: 'execute_desktop_input',
      },
    ], {
      observationPrefix: observations.join(' | '),
      postVerify: true,
      postVerifyHwnd: spec.sourceHwnd,
      postVerifyQuery: spec.app || spec.sourceWindowTitle,
      postVerifyRequired: false,
      postVerifyRequireSameHwnd: spec.requireSameHwnd,
      postVerifySourceQuery: spec.app || spec.sourceWindowTitle,
      postVerifyVisualQuery: spec.postVerify,
      stopOnError: true,
      summaryLabel: 'visible_click_inherited_target',
    });
  }

  if (inheritedTarget && spec.sourceHwnd && hasFocusedHwnd && focusedHwnd !== spec.sourceHwnd) {
    observations.push(
      `VisibleClick staleSourceHwnd=${spec.sourceHwnd}`,
      `VisibleClick reboundSourceHwnd=${focusedHwnd}`,
      'VisibleClick will re-locate the target because the dispatch-time window identity changed.',
    );
  }

  const locateToolCall: AgentToolCallCommand = {
    goal: `VisibleClick locate ${spec.target} in ${spec.app}`,
    input: {
      action: 'locate_element',
      allowScreenFallback: !spec.requireSameHwnd,
      hwnd: hasFocusedHwnd ? Math.round(focusedHwnd) : undefined,
      question: [
        `Find the visible clickable target "${spec.target}" inside the app/window "${spec.app}".`,
        'Prefer the exact focused window HWND as the capture source. Return actionable structured evidence with source bounds, element center, targetMatched, primaryAction, confidence, and visualActionReadiness=ready only when the target is clearly clickable.',
      ].join(' '),
      sourceQuery: spec.app,
      sourceId: hasFocusedHwnd ? `window:${Math.round(focusedHwnd)}:0` : undefined,
      sourceType: 'window',
      targetDescription: spec.target,
      targetText: spec.target,
    },
    name: 'locate_screen_elements',
  };
  const locateResult = await executeLocateScreenElements(context, locateToolCall, spec.target);
  const locateEvidence = locateResult.stateSummary?.structuredEvidence
    ?? locateResult.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const captureStayedOnWindow = locateEvidence?.captureSourceType === 'window'
    && locateEvidence.captureFallback?.toSourceType !== 'screen'
    && locateEvidence.captureTrusted !== false;
  observations.push(
    `VisibleClick locate ok=${inferAgentRuntimeToolResultOk(locateResult)}`,
    `VisibleClick locateCaptureType=${locateEvidence?.captureSourceType ?? 'unknown'}`,
    `VisibleClick locateCaptureTrusted=${locateEvidence?.captureTrusted ?? 'unknown'}`,
    `VisibleClick locateFallback=${locateEvidence?.captureFallback?.toSourceType ?? 'none'}`,
  );
  if (spec.requireSameHwnd && !captureStayedOnWindow) {
    const reason = 'VisibleClick refused to dispatch because locate did not return trusted window-capture evidence for the requested HWND source.';
    observations.push(`VisibleClick sameHwndFailure=${reason}`);
    return createAgentRuntimeResult({
      errorText: reason,
      observations,
      ok: false,
      receipt: {
        evidenceLines: observations,
        status: 'failed',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: same-HWND locate evidence failed'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: reason,
      },
      responseText: reason,
      verification: reason,
    });
  }
  const locateCommand: AgentChatCommand = {
    capabilityId: 'desktop-observation',
    instruction: `VisibleClick locate ${spec.target} in ${spec.app}`,
    kind: 'tool-call',
    sourceText: toolCall.goal ?? `visibleClick ${spec.app} ${spec.target}`,
    toolCall: locateToolCall,
  };
  const strategy = resolveAgentVisualExecutionStrategy({
    command: locateCommand,
    result: locateResult,
    sourceText: locateCommand.sourceText,
    userGoal: spec.postVerify || `Click ${spec.target} in ${spec.app}`,
  });
  const strategySteps = parseAgentRuntimeVisibleClickStrategySteps(strategy.command);
  observations.push(
    `VisibleClick strategy=${strategy.kind}`,
    `VisibleClick strategyReason=${strategy.reason}`,
    ...strategy.diagnostics.map((line) => `VisibleClick ${line}`),
  );

  if (!strategySteps?.length || strategy.kind === 'none') {
    return createAgentRuntimeResult({
      assessment: {
        evidence: observations,
        nextStep: 'Refresh the window capture or refine the target description before clicking.',
        status: 'unverified',
        summary: `VisibleClick target is not actionable: ${strategy.reason}`,
      },
      errorText: spec.requireActionable ? `VisibleClick target is not actionable: ${strategy.reason}` : null,
      observations,
      ok: !spec.requireActionable,
      receipt: {
        evidenceLines: observations,
        status: spec.requireActionable ? 'failed' : 'unverified',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: target not actionable'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: `VisibleClick did not dispatch because target is not actionable: ${strategy.reason}`,
      },
      responseText: `VisibleClick did not dispatch because target is not actionable: ${strategy.reason}`,
      verification: `VisibleClick did not dispatch because target is not actionable: ${strategy.reason}`,
    });
  }

  const dispatchHwnd = hasFocusedHwnd ? Math.round(focusedHwnd) : null;
  return runAgentRuntimeDesktopSequenceSteps(context, toolCall, strategySteps, {
    observationPrefix: observations.join(' | '),
    postVerify: true,
    postVerifyHwnd: dispatchHwnd,
    postVerifyQuery: spec.app,
    postVerifyRequired: false,
    postVerifyRequireSameHwnd: spec.requireSameHwnd,
    postVerifySourceQuery: spec.app,
    postVerifyVisualQuery: spec.postVerify,
    stopOnError: true,
    summaryLabel: 'visible_click',
  });
}

export async function executeDesktopSequence(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const visibleClickSpec = parseAgentRuntimeVisibleClickSpec(toolCall);
  if (visibleClickSpec) {
    return executeAgentRuntimeVisibleClick(context, toolCall, visibleClickSpec);
  }

  const parsed = parseAgentRuntimeDesktopSequenceSteps(toolCall);
  if (parsed.ok === false) {
    return createAgentRuntimeResult({
      errorText: parsed.error,
      ok: false,
      receipt: {
        evidenceLines: [parsed.error],
        status: 'failed',
        summaryLines: [
          'Call: execute_desktop_sequence',
          'Result: rejected before any step ran',
        ],
        title: 'Agent desktop sequence',
        toolName: 'execute_desktop_sequence',
        verification: parsed.error,
      },
      responseText: parsed.error,
      verification: parsed.error,
    });
  }

  return runAgentRuntimeDesktopSequenceSteps(context, toolCall, parsed.steps);
}
