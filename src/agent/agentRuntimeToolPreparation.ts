import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  isAgentToolName,
  listAgentToolNames,
} from './agentToolRegistry';
import { prepareAgentToolInput } from './agentToolInputSchema';

interface AgentRuntimeToolPreparedCall {
  toolCall: AgentToolCallCommand;
}

export type AgentRuntimeToolPrepareResult =
  | {
      ok: true;
      prepared: AgentRuntimeToolPreparedCall;
    }
  | {
      error: string;
      ok: false;
    };

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

export function normalizeAgentRuntimeVisualLookupText(value: string) {
  return value.replace(/\s+/gu, '').trim().toLowerCase();
}

export function normalizeExecuteDesktopObservationAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'display_info':
    case 'screen_info':
    case 'list_displays':
      return 'get_display_info';
    case 'system_info':
    case 'computer_info':
      return 'get_system_info';
    case 'active_window':
    case 'foreground_window':
      return 'get_active_window_info';
    case 'window_ui':
    case 'ui_automation':
    case 'inspect_controls':
    case 'inspect_window_controls':
      return 'inspect_window_ui';
    case 'running_apps':
    case 'list_windows':
      return 'list_running_apps';
    case 'desktop_items':
    case 'desktop_icons':
    case 'list_desktop_icons':
      return 'list_desktop_items';
    case 'desktop_icon_diagnostics':
    case 'desktop_icon_status':
      return 'diagnose_desktop_icons';
    case 'capture_sources':
    case 'screen_sources':
      return 'list_capture_sources';
    case 'visual_snapshot':
    case 'screen_snapshot':
    case 'window_snapshot':
    case 'summarize_screen':
      return 'summarize_visual_snapshot';
    case 'wait_for_ui_state':
    case 'wait_then_observe':
    case 'wait_and_observe':
      return 'wait_and_observe';
    case 'cursor_position':
      return 'get_cursor_position';
    case 'get_display_info':
    case 'get_system_info':
    case 'get_active_window_info':
    case 'inspect_window_ui':
    case 'list_desktop_items':
    case 'diagnose_desktop_icons':
    case 'list_running_apps':
    case 'list_capture_sources':
    case 'summarize_visual_snapshot':
    case 'get_cursor_position':
      return normalizedValue;
    default:
      return '';
  }
}

export function annotateDesktopObservationResult(
  action: string,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  return {
    ...result,
    observations: [
      `Desktop observation: ${action}`,
      ...(result.observations ?? []),
    ],
  };
}

function isAgentRuntimeToolInputObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getAgentRuntimeAvailableToolText() {
  return listAgentToolNames().join(', ');
}

export function prepareAgentRuntimeToolCall(toolCall: AgentToolCallCommand): AgentRuntimeToolPrepareResult {
  const rawName = (toolCall as { name?: unknown }).name;
  if (typeof rawName !== 'string' || !isAgentToolName(rawName)) {
    return {
      error: `未知 Agent 工具 "${String(rawName || '')}"。可用工具：${getAgentRuntimeAvailableToolText()}。`,
      ok: false,
    };
  }

  const rawInput = (toolCall as { input?: unknown }).input;
  if (!isAgentRuntimeToolInputObject(rawInput)) {
    return {
      error: `Agent 工具 "${rawName}" 的参数必须是对象。`,
      ok: false,
    };
  }

  const preparedInput = prepareAgentToolInput(rawName, rawInput);
  if (preparedInput.ok === false) {
    return {
      error: preparedInput.error,
      ok: false,
    };
  }

  return {
    ok: true,
    prepared: {
      toolCall: {
        ...toolCall,
        input: preparedInput.input,
        name: rawName,
      },
    },
  };
}
