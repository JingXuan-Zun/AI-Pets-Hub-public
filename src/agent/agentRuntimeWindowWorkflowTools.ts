import { isAgentRuntimeCancellationRequested, createAgentRuntimeCancelledResult } from './agentRuntimeCancellation';
import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';
import {
  executeAppLaunch,
  executeOpenResource,
} from './agentRuntimeDesktopLaunchTools';
import {
  getToolBooleanInput,
  getToolNumberInput,
  getToolStringInput,
} from './agentRuntimeToolPreparation';
import {
  executeControlWindow,
  executeMoveWindowToDisplay,
  waitForDesktopActionWindowSettle,
} from './agentRuntimeWindowTools';

function getDesktopActionTargetInput(toolCall: AgentToolCallCommand) {
  return getToolStringInput(toolCall, [
    'target',
    'query',
    'url',
    'path',
    'website',
    'site',
    'appName',
    'name',
    'title',
    'processName',
  ]);
}

function shouldOpenDesktopActionTargetAsResource(target: string, resourceType?: string) {
  const normalizedResourceType = resourceType?.trim().toLowerCase();
  if (normalizedResourceType && normalizedResourceType !== 'app') {
    return true;
  }

  return /^(?:https?:\/\/|file:\/\/)/iu.test(target)
    || /^[^\s]+\.[a-z0-9]{2,}(?:[/?#].*)?$/iu.test(target);
}

function hasControlWindowOperationInput(toolCall: AgentToolCallCommand) {
  return Boolean(
    getToolStringInput(toolCall, ['windowState', 'state', 'mode'])
    || getToolStringInput(toolCall, ['snap', 'snapPosition', 'placement'])
    || getToolStringInput(toolCall, ['targetDisplay', 'display', 'displayTarget', 'screen', 'screenTarget'])
    || getToolStringInput(toolCall, ['displayId', 'targetDisplayId', 'screenId'])
    || typeof getToolNumberInput(toolCall, 'x') === 'number'
    || typeof getToolNumberInput(toolCall, 'left') === 'number'
    || typeof getToolNumberInput(toolCall, 'y') === 'number'
    || typeof getToolNumberInput(toolCall, 'top') === 'number'
    || typeof getToolNumberInput(toolCall, 'width') === 'number'
    || typeof getToolNumberInput(toolCall, 'w') === 'number'
    || typeof getToolNumberInput(toolCall, 'height') === 'number'
    || typeof getToolNumberInput(toolCall, 'h') === 'number'
  );
}

export async function executeOpenOrFocusThenControlWindow(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const target = getDesktopActionTargetInput(toolCall);
  const resourceType = getToolStringInput(toolCall, ['resourceType']);
  if (!target) {
    return {
      errorText: 'Missing open_or_focus_then_control_window target.',
      ok: false,
      responseText: 'open_or_focus_then_control_window needs an app, URL, file, folder, or window target.',
    };
  }

  if (!hasControlWindowOperationInput(toolCall)) {
    return {
      errorText: 'Missing open_or_focus_then_control_window control operation.',
      ok: false,
      responseText: 'open_or_focus_then_control_window needs windowState, snap, display target, or x/y/width/height bounds.',
    };
  }

  const openResult = shouldOpenDesktopActionTargetAsResource(target, resourceType)
    ? await executeOpenResource(target, resourceType || 'auto', getToolBooleanInput(toolCall, 'forceNew'))
    : await executeAppLaunch(target, getToolBooleanInput(toolCall, 'forceNew'));

  if (openResult.ok === false) {
    return {
      ...openResult,
      observations: [
        'Compound action: open_or_focus_then_control_window',
        'Compound stage failed: open-or-focus',
        ...(openResult.observations ?? []),
      ],
    };
  }

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult(toolCall);
  }

  await waitForDesktopActionWindowSettle();

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult(toolCall);
  }

  const controlToolCall: AgentToolCallCommand = {
    ...toolCall,
    input: {
      ...toolCall.input,
      action: 'control_window',
      fallbackToActiveWindow: getToolBooleanInput(toolCall, 'fallbackToActiveWindow') ?? true,
      target,
    },
  };
  const controlResult = await executeControlWindow(controlToolCall);
  const ok = controlResult.ok !== false;

  return {
    errorText: ok ? null : controlResult.errorText ?? openResult.errorText ?? 'Compound desktop action failed.',
    followUp: ok ? null : controlResult.followUp ?? openResult.followUp ?? null,
    observations: [
      'Compound action: open_or_focus_then_control_window',
      'Stage 1: open/focus target',
      ...(openResult.observations ?? []),
      'Stage 2: control resulting window',
      ...(controlResult.observations ?? []),
    ],
    ok,
    receipt: controlResult.receipt ?? openResult.receipt,
    responseText: ok
      ? `Opened or focused ${target}, then controlled the resulting window.`
      : `Opened or focused ${target}, but window control did not complete. ${controlResult.responseText || ''}`.trim(),
    verification: ok
      ? `Compound window control completed: ${target}`
      : controlResult.verification ?? openResult.verification ?? null,
  };
}

export async function executeOpenOrFocusThenMoveWindowToDisplay(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const target = getDesktopActionTargetInput(toolCall);
  const targetDisplay = getToolStringInput(toolCall, [
    'targetDisplay',
    'display',
    'displayTarget',
    'screen',
    'screenTarget',
    'displayId',
    'targetDisplayId',
  ]);
  const resourceType = getToolStringInput(toolCall, ['resourceType']);
  if (!target) {
    return {
      errorText: 'Missing open_or_focus_then_move_window_to_display target.',
      ok: false,
      responseText: 'open_or_focus_then_move_window_to_display needs an app, URL, file, folder, or window target.',
    };
  }

  if (!targetDisplay) {
    return {
      errorText: 'Missing open_or_focus_then_move_window_to_display target display.',
      ok: false,
      responseText: 'open_or_focus_then_move_window_to_display needs a target display such as primary, secondary, or displayId.',
    };
  }

  const openResult = shouldOpenDesktopActionTargetAsResource(target, resourceType)
    ? await executeOpenResource(target, resourceType || 'auto', getToolBooleanInput(toolCall, 'forceNew'))
    : await executeAppLaunch(target, getToolBooleanInput(toolCall, 'forceNew'));

  if (openResult.ok === false) {
    return {
      ...openResult,
      observations: [
        'Compound action: open_or_focus_then_move_window_to_display',
        'Compound stage failed: open-or-focus',
        ...(openResult.observations ?? []),
      ],
    };
  }

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult(toolCall);
  }

  await waitForDesktopActionWindowSettle();

  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult(toolCall);
  }

  const moveToolCall: AgentToolCallCommand = {
    ...toolCall,
    input: {
      ...toolCall.input,
      action: 'move_window_to_display',
      fallbackToActiveWindow: getToolBooleanInput(toolCall, 'fallbackToActiveWindow') ?? true,
      target,
    },
  };
  const moveResult = await executeMoveWindowToDisplay(moveToolCall);
  const ok = moveResult.ok !== false;

  return {
    errorText: ok ? null : moveResult.errorText ?? openResult.errorText ?? 'Compound desktop action failed.',
    followUp: ok ? null : moveResult.followUp ?? openResult.followUp ?? null,
    observations: [
      'Compound action: open_or_focus_then_move_window_to_display',
      'Stage 1: open/focus target',
      ...(openResult.observations ?? []),
      'Stage 2: move resulting window to display',
      ...(moveResult.observations ?? []),
    ],
    ok,
    receipt: moveResult.receipt ?? openResult.receipt,
    responseText: ok
      ? `Opened or focused ${target}, then moved the resulting window to ${targetDisplay}.`
      : `Opened or focused ${target}, but the window move did not complete. ${moveResult.responseText || ''}`.trim(),
    verification: ok
      ? `Compound action completed: ${target} -> ${targetDisplay}`
      : moveResult.verification ?? openResult.verification ?? null,
  };
}
