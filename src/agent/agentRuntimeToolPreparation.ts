import { type AgentToolCallCommand } from './agentChatCommand';
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
