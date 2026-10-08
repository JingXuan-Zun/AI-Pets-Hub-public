import {
  type AgentChatCommandResult,
  type AgentStructuredToolWindowEvidence,
} from '../agentChatCommand';
import {
  type AgentRuntimeExecutorContext,
} from '../agentRuntimeExecutor';
import {
  createAgentRuntimeCoreWindowTargetCandidates,
} from '../agentRuntimeCore';
import {
  executeObserveWindowsAndApps,
} from '../agentRuntimeDesktopObservationTools';
import {
  waitForDesktopActionWindowSettle,
} from '../agentRuntimeWindowTools';
import {
  createAgentRuntimeResult,
  type AgentRuntimeDesktopSequenceStep,
  getAgentRuntimeSequenceStepAction,
  isAgentRuntimeCancellationRequested,
  getToolStringInput,
} from './sequenceResultEvidence';

export function getAgentRuntimeDesktopSequenceFinalWindow(
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

export function createAgentRuntimeDesktopSequenceUnresolvedWindowResult(
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

export function isAgentRuntimeDesktopSequenceWindowDependentStep(step: AgentRuntimeDesktopSequenceStep) {
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

export function isAgentRuntimeDesktopSequenceSurfaceChangingStep(step: AgentRuntimeDesktopSequenceStep) {
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

export async function refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange(
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

export function createAgentRuntimeDesktopSequenceInputArgs(
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

export function getAgentRuntimeDesktopSequenceRawTarget(step: AgentRuntimeDesktopSequenceStep | null) {
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

export function createAgentRuntimeDesktopSequenceActionArgs(
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
