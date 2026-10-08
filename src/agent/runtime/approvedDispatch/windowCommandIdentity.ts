import { type AgentChatCommand } from '../../agentChatCommand';

export const WINDOW_TARGET_ACTIONS = new Set([
  'close_window',
  'control_window',
  'focus_window',
  'move_window_to_display',
]);

export const WINDOW_UI_ACTIONS = new Set([
  'interact_window_ui',
  'invoke_window_ui',
  'select_window_ui',
  'toggle_window_ui',
  'expand_window_ui',
  'collapse_window_ui',
  'set_window_ui_value',
]);

const WINDOW_CREATION_ACTIONS = new Set([
  'launch_local_app',
  'open_resource',
  'search_web',
]);

export function normalizeAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

export function getSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return null;
  }

  const stepsJson = command.toolCall.input.stepsJson;
  if (typeof stepsJson !== 'string') {
    return null;
  }

  try {
    const steps = JSON.parse(stepsJson) as unknown;
    return Array.isArray(steps) ? steps : null;
  } catch {
    return null;
  }
}

export function getStepToolAndArgs(step: unknown) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    return null;
  }
  const record = step as Record<string, unknown>;
  const rawArgs = record.args ?? record.input;
  return {
    args: rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
      ? rawArgs as Record<string, unknown>
      : {},
    record,
    tool: typeof record.tool === 'string' ? record.tool : '',
  };
}

function isWindowTargetAction(args: Record<string, unknown>, tool: string) {
  return tool === 'execute_desktop_action'
    && WINDOW_TARGET_ACTIONS.has(normalizeAction(args.action));
}

export function getInputWindowIdentityArgs(args: Record<string, unknown>) {
  const hwnd = getPositiveInteger(args.expectedForegroundHwnd ?? args.hwnd ?? args.windowHandle);
  const pid = getPositiveInteger(args.expectedForegroundPid ?? args.pid);
  const query = [
    args.sourceQuery,
    args.sourceWindowTitle,
    args.windowQuery,
    args.expectedForegroundTitle,
    args.expectedForegroundProcessName,
    args.windowTitle,
    args.title,
    args.processName,
  ].find((value) => typeof value === 'string' && value.trim()) ?? '';
  if (!hwnd && !pid && !query) {
    return null;
  }
  return {
    action: 'focus_window',
    ...(hwnd ? { hwnd } : {}),
    ...(pid ? { pid } : {}),
    ...(query ? { query } : {}),
  };
}

export function getWindowIdentityArgsForAction(args: Record<string, unknown>, tool: string) {
  if (isWindowTargetAction(args, tool)) {
    return args;
  }
  const action = normalizeAction(args.action);
  if (tool !== 'execute_desktop_action' || !WINDOW_UI_ACTIONS.has(action)) {
    return null;
  }
  const hwnd = getPositiveInteger(args.hwnd ?? args.windowHandle);
  const pid = getPositiveInteger(args.pid);
  const query = [
    args.query,
    args.sourceQuery,
    args.sourceWindowTitle,
    args.windowQuery,
    args.windowTitle,
    args.title,
    args.processName,
  ]
    .find((value) => typeof value === 'string' && value.trim()) ?? '';
  if (!hwnd && !pid && !query) {
    return null;
  }
  return {
    action: 'focus_window',
    ...(hwnd ? { hwnd } : {}),
    ...(pid ? { pid } : {}),
    ...(query ? { query } : {}),
  };
}

export function getResolutionArgs(args: Record<string, unknown>) {
  const query = [
    args.query,
    args.target,
    args.title,
    args.windowTitle,
    args.processName,
    args.sourceQuery,
    args.sourceWindowTitle,
    args.windowQuery,
    args.expectedForegroundTitle,
    args.expectedForegroundProcessName,
  ].find((value) => typeof value === 'string' && value.trim());
  if (!query) {
    return args;
  }

  const {
    hwnd: _hwnd,
    pid: _pid,
    windowHandle: _windowHandle,
    expectedForegroundHwnd: _expectedForegroundHwnd,
    expectedForegroundPid: _expectedForegroundPid,
    ...semanticArgs
  } = args;
  return {
    ...semanticArgs,
    action: 'focus_window',
  };
}

export function isWindowUiAction(args: Record<string, unknown>, tool: string) {
  return tool === 'execute_desktop_action'
    && WINDOW_UI_ACTIONS.has(normalizeAction(args.action));
}

export function applyResolvedIdentity(
  originalArgs: Record<string, unknown>,
  resolvedArgs: Record<string, unknown>,
) {
  const { windowHandle: _windowHandle, ...argsWithoutLegacyHandle } = originalArgs;
  return {
    ...argsWithoutLegacyHandle,
    ...(getPositiveInteger(resolvedArgs.hwnd) ? { hwnd: getPositiveInteger(resolvedArgs.hwnd) } : {}),
    ...(getPositiveInteger(resolvedArgs.pid) ? { pid: getPositiveInteger(resolvedArgs.pid) } : {}),
  };
}

export function hasWindowCreationBefore(steps: unknown[], index: number) {
  return steps.slice(0, index).some((step) => {
    const parsed = getStepToolAndArgs(step);
    return Boolean(parsed) && WINDOW_CREATION_ACTIONS.has(normalizeAction(parsed.args.action));
  });
}

export function getLatestWindowCreationTarget(steps: unknown[], index: number) {
  for (let stepIndex = index - 1; stepIndex >= 0; stepIndex -= 1) {
    const parsed = getStepToolAndArgs(steps[stepIndex]);
    if (!parsed || !isWindowCreationAction(parsed.args, parsed.tool)) {
      continue;
    }
    return [
      parsed.args.target,
      parsed.args.query,
      parsed.args.appName,
      parsed.args.name,
      parsed.args.url,
    ].find((value) => typeof value === 'string' && value.trim()) ?? '';
  }
  return '';
}

export function stripWindowIdentity(args: Record<string, unknown>) {
  const {
    hwnd: _hwnd,
    pid: _pid,
    windowHandle: _windowHandle,
    expectedForegroundHwnd: _expectedForegroundHwnd,
    expectedForegroundPid: _expectedForegroundPid,
    ...semanticArgs
  } = args;
  return semanticArgs;
}

export function getWindowQueryArgs(args: Record<string, unknown>) {
  return [
    args.query,
    args.target,
    args.title,
    args.windowTitle,
    args.processName,
    args.name,
  ].some((value) => typeof value === 'string' && value.trim());
}

function isWindowCreationAction(args: Record<string, unknown>, tool: string) {
  return tool === 'execute_desktop_action'
    && WINDOW_CREATION_ACTIONS.has(normalizeAction(args.action));
}

export function getPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : null;
}

export function updateDependentInputIdentities(
  steps: unknown[],
  resolvedArgs: Record<string, unknown>,
  resolvedIndex: number,
  previousArgs: Record<string, unknown>,
) {
  const resolvedHwnd = getPositiveInteger(resolvedArgs.hwnd);
  const resolvedPid = getPositiveInteger(resolvedArgs.pid);
  const previousHwnd = getPositiveInteger(previousArgs.hwnd);
  const previousPid = getPositiveInteger(previousArgs.pid);
  if (!resolvedHwnd && !resolvedPid) {
    return steps;
  }

  return steps.map((step, index) => {
    if (index <= resolvedIndex) {
      return step;
    }
    const parsed = getStepToolAndArgs(step);
    if (!parsed) {
      return step;
    }
    if (isWindowTargetAction(parsed.args, parsed.tool) || WINDOW_UI_ACTIONS.has(normalizeAction(parsed.args.action)) || (
      parsed.tool === 'execute_desktop_action'
      && WINDOW_CREATION_ACTIONS.has(normalizeAction(parsed.args.action))
    )) {
      return step;
    }
    if (parsed.tool !== 'execute_desktop_input') {
      return step;
    }

    const currentHwnd = getPositiveInteger(parsed.args.expectedForegroundHwnd);
    const currentPid = getPositiveInteger(parsed.args.expectedForegroundPid);
    if (!currentHwnd && !currentPid) {
      return step;
    }
    const hwndMatchesPrevious = !currentHwnd || !previousHwnd || currentHwnd === previousHwnd;
    const pidMatchesPrevious = !currentPid || !previousPid || currentPid === previousPid;
    if (!hwndMatchesPrevious || !pidMatchesPrevious) {
      return step;
    }

    return {
      ...parsed.record,
      args: {
        ...parsed.args,
        ...(resolvedHwnd ? { expectedForegroundHwnd: resolvedHwnd } : {}),
        ...(resolvedPid ? { expectedForegroundPid: resolvedPid } : {}),
      },
    };
  });
}
