import {
  type AgentToolCallCommand,
} from '../agentChatCommand';

export function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function getToolNumberInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function getToolNumberInputAny(toolCall: AgentToolCallCommand, keys: string[]) {
  for (const key of keys) {
    const value = getToolNumberInput(toolCall, key);
    if (typeof value === 'number') {
      return value;
    }
  }

  return undefined;
}

export function normalizeExecuteDesktopAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'list_windows':
      return 'list_running_apps';
    case 'get_default_browser':
      return 'get_default_app_for_uri';
    case 'focus_browser_window':
      return 'focus_window';
    case 'resize_window':
    case 'snap_window':
    case 'maximize_window':
    case 'minimize_window':
    case 'restore_window':
      return 'control_window';
    case 'open_then_control_window':
    case 'launch_then_control_window':
    case 'focus_then_control_window':
      return 'open_or_focus_then_control_window';
    case 'open_then_move_window_to_display':
    case 'launch_then_move_window_to_display':
      return 'open_or_focus_then_move_window_to_display';
    case 'move_window':
    case 'move_window_to_screen':
    case 'move_window_to_monitor':
      return 'move_window_to_display';
    case 'close_app':
      return 'close_window';
    case 'open_url':
      return 'open_resource';
    case 'open_app':
      return 'launch_local_app';
    case 'invoke_ui':
    case 'invoke_control':
    case 'invoke_button':
    case 'click_window_ui':
      return 'invoke_window_ui';
    case 'ui_action':
    case 'uia_action':
    case 'interact_ui':
    case 'interact_control':
    case 'select_ui':
    case 'select_window_ui':
    case 'toggle_ui':
    case 'toggle_window_ui':
    case 'expand_ui':
    case 'expand_window_ui':
    case 'collapse_ui':
    case 'collapse_window_ui':
    case 'set_ui_value':
    case 'set_window_ui_value':
      return 'interact_window_ui';
    case 'list_running_apps':
    case 'get_default_app_for_uri':
    case 'get_active_window_info':
    case 'focus_window':
    case 'control_window':
    case 'open_or_focus_then_control_window':
    case 'open_or_focus_then_move_window_to_display':
    case 'move_window_to_display':
    case 'close_window':
    case 'open_resource':
    case 'launch_local_app':
    case 'interact_window_ui':
    case 'invoke_window_ui':
    case 'search_web':
      return normalizedValue;
    default:
      return '';
  }
}

export function normalizeExecuteDesktopInputAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'move_pointer':
    case 'set_cursor':
      return 'move_mouse';
    case 'doubleclick':
      return 'double_click';
    case 'context_click':
      return 'right_click';
    case 'left_click':
      return 'click';
    case 'type':
    case 'text':
      return 'type_text';
    case 'keys':
    case 'press_keys':
      return 'send_keys';
    case 'shortcut':
      return 'hotkey';
    case 'drag_mouse':
      return 'drag';
    case 'move_mouse':
    case 'click':
    case 'double_click':
    case 'right_click':
    case 'type_text':
    case 'send_keys':
    case 'hotkey':
    case 'drag':
      return normalizedValue;
    default:
      return '';
  }
}

export function getDesktopActionTargetInput(toolCall: AgentToolCallCommand) {
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

export function shouldDefaultDesktopInputToNativeScreen(action: string) {
  return action === 'move_mouse'
    || action === 'click'
    || action === 'double_click'
    || action === 'right_click'
    || action === 'drag';
}

export function hasDesktopInputPoint(toolCall: AgentToolCallCommand, action: string) {
  if (action === 'drag') {
    return typeof getToolNumberInputAny(toolCall, ['fromX', 'x', 'fromNativeScreenX', 'nativeScreenX']) === 'number'
      && typeof getToolNumberInputAny(toolCall, ['fromY', 'y', 'fromNativeScreenY', 'nativeScreenY']) === 'number'
      && typeof getToolNumberInputAny(toolCall, ['toX', 'targetX', 'endX', 'toNativeScreenX']) === 'number'
      && typeof getToolNumberInputAny(toolCall, ['toY', 'targetY', 'endY', 'toNativeScreenY']) === 'number';
  }

  return typeof getToolNumberInputAny(toolCall, ['x', 'nativeScreenX']) === 'number'
    && typeof getToolNumberInputAny(toolCall, ['y', 'nativeScreenY']) === 'number';
}

export function createDesktopInputRequest(toolCall: AgentToolCallCommand, action: string) {
  const explicitCoordinateSpace = getToolStringInput(toolCall, ['coordinateSpace']);
  const shouldDefaultToNativeScreen = !explicitCoordinateSpace
    && shouldDefaultDesktopInputToNativeScreen(action)
    && hasDesktopInputPoint(toolCall, action);

  return {
    ...toolCall.input,
    action,
    ...(shouldDefaultToNativeScreen ? { coordinateSpace: 'native-screen' } : {}),
  };
}
