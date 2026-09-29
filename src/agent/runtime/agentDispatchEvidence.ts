export interface AgentRuntimeDispatchCommand {
  kind?: string | null;
  toolCall?: {
    actionScope?: {
      targetRef?: string | null;
    } | null;
    input?: Record<string, unknown> | null;
    name?: string | null;
  } | null;
}

export interface AgentRuntimeDispatchResult {
  ok?: boolean | null;
  receipt?: {
    status?: string | null;
    stateSummary?: {
      actionEvidence?: {
        outcome?: string | null;
      } | null;
    } | null;
  } | null;
  stateSummary?: {
    actionEvidence?: {
      outcome?: string | null;
    } | null;
  } | null;
}

const INPUT_ACTION_PATTERN = /(?:click|double[_\s-]*click|type|send[_\s-]*keys?|hotkey|press|drag|mouse|interact|invoke|select|toggle|expand|collapse|set[_\s-]*value|scroll)/iu;
const IN_APP_ACTION_PATTERN = /^(?:interact_window_ui|invoke_window_ui|select_window_ui|toggle_window_ui|expand_window_ui|collapse_window_ui|set_window_ui_value)$/u;
const DESKTOP_SIDE_EFFECT_ACTION_PATTERN = /(?:launch|open|focus|close|move|control|resize|maximi[sz]e|minimi[sz]e|restore|snap|click|double[_\s-]*click|type|send[_\s-]*keys?|hotkey|press|drag|mouse|interact|invoke|select|toggle|expand|collapse|set[_\s-]*value|scroll)/iu;

function normalizeAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function getSequenceSteps(command: AgentRuntimeDispatchCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return [];
  }

  const stepsJson = command.toolCall.input?.stepsJson;
  if (typeof stepsJson !== 'string') {
    return [];
  }

  try {
    const steps = JSON.parse(stepsJson) as unknown;
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

function getAction(args: Record<string, unknown> | null | undefined) {
  return normalizeAction(
    args?.action
      ?? args?.operation
      ?? args?.desktopAction,
  );
}

function getStepToolAndArgs(step: unknown) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    return null;
  }

  const record = step as Record<string, unknown>;
  const args = record.args ?? record.input;
  return {
    args: args && typeof args === 'object' && !Array.isArray(args)
      ? args as Record<string, unknown>
      : {},
    tool: typeof record.tool === 'string' ? record.tool : '',
  };
}

function hasDesktopSideEffectStep(step: unknown) {
  const parsed = getStepToolAndArgs(step);
  if (!parsed) {
    return false;
  }
  return parsed.tool === 'execute_desktop_input'
    ? Boolean(normalizeAction(parsed.args.action))
    : parsed.tool === 'execute_desktop_action'
      && DESKTOP_SIDE_EFFECT_ACTION_PATTERN.test(normalizeAction(parsed.args.action ?? parsed.args.operation ?? parsed.args.desktopAction));
}

function hasInputStep(step: unknown) {
  const parsed = getStepToolAndArgs(step);
  if (!parsed) {
    return false;
  }

  if (parsed.tool === 'execute_desktop_input') {
    return Boolean(getAction(parsed.args));
  }

  return parsed.tool === 'execute_desktop_action'
    && INPUT_ACTION_PATTERN.test(getAction(parsed.args));
}

function hasInAppStep(
  step: unknown,
  command: AgentRuntimeDispatchCommand,
) {
  const parsed = getStepToolAndArgs(step);
  if (!parsed) {
    return false;
  }

  if (parsed.tool === 'execute_desktop_input') {
    return Boolean(normalizeAction(parsed.args.action))
      && (hasExplicitInAppTarget(command) || Boolean(
        parsed.args.targetText
          || parsed.args.targetDescription
          || parsed.args.sourceQuery
          || parsed.args.windowQuery,
      ));
  }

  return parsed.tool === 'execute_desktop_action'
    && IN_APP_ACTION_PATTERN.test(normalizeAction(parsed.args.action));
}

function hasExplicitInAppTarget(command: AgentRuntimeDispatchCommand) {
  const input = command.toolCall?.input ?? {};
  return Boolean(
    command.toolCall?.actionScope?.targetRef?.trim()
      || input.sourceQuery
      || input.sourceWindowTitle
      || input.windowQuery
      || input.targetText
      || input.targetDescription,
  );
}

export function hasAgentRuntimeInputDispatch(command: AgentRuntimeDispatchCommand) {
  const toolName = command.toolCall?.name ?? '';
  if (toolName === 'execute_desktop_input') {
    return Boolean(getAction(command.toolCall?.input));
  }

  if (toolName === 'execute_desktop_action') {
    return INPUT_ACTION_PATTERN.test(getAction(command.toolCall?.input));
  }

  return getSequenceSteps(command).some(hasInputStep);
}

export function hasAgentRuntimeDesktopDispatch(command: AgentRuntimeDispatchCommand) {
  const toolName = command.toolCall?.name ?? '';
  if (toolName === 'execute_desktop_input') {
    return Boolean(getAction(command.toolCall?.input));
  }
  if (toolName === 'execute_desktop_action') {
    return DESKTOP_SIDE_EFFECT_ACTION_PATTERN.test(getAction(command.toolCall?.input));
  }
  if (toolName === 'launch_local_app' || toolName === 'open_resource' || toolName === 'focus_window' || toolName === 'close_window') {
    return true;
  }
  return getSequenceSteps(command).some(hasDesktopSideEffectStep);
}

export function hasAgentRuntimeInAppDispatch(command: AgentRuntimeDispatchCommand) {
  const toolName = command.toolCall?.name ?? '';
  if (toolName === 'execute_desktop_action') {
    return IN_APP_ACTION_PATTERN.test(getAction(command.toolCall?.input));
  }

  if (toolName === 'execute_desktop_input') {
    return Boolean(getAction(command.toolCall?.input)) && hasExplicitInAppTarget(command);
  }

  return getSequenceSteps(command).some((step) => hasInAppStep(step, command));
}

function isDispatchResultCommitted(result: AgentRuntimeDispatchResult | null | undefined) {
  const actionOutcome = (
    result?.stateSummary?.actionEvidence
      ?? result?.receipt?.stateSummary?.actionEvidence
  )?.outcome?.trim().toLowerCase();
  const receiptStatus = result?.receipt?.status?.trim().toLowerCase();
  const hasExplicitSuccessReceipt = receiptStatus === 'success';
  const hasChangedActionEvidence = actionOutcome === 'changed';
  return result?.ok === true
    && (hasExplicitSuccessReceipt || hasChangedActionEvidence)
    && receiptStatus !== 'failed'
    && receiptStatus !== 'blocked'
    && receiptStatus !== 'unverified'
    && actionOutcome !== 'blocked'
    && actionOutcome !== 'no-op'
    && actionOutcome !== 'uncertain';
}

export function hasAgentRuntimeCommittedInputDispatch(
  command: AgentRuntimeDispatchCommand,
  result: AgentRuntimeDispatchResult | null | undefined,
) {
  return hasAgentRuntimeInputDispatch(command) && isDispatchResultCommitted(result);
}

export function hasAgentRuntimeCommittedDesktopDispatch(
  command: AgentRuntimeDispatchCommand,
  result: AgentRuntimeDispatchResult | null | undefined,
) {
  return hasAgentRuntimeDesktopDispatch(command) && isDispatchResultCommitted(result);
}
