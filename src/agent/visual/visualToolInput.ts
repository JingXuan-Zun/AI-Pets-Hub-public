import { type AgentToolCallCommand } from '../agentChatCommand';

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

export function getToolRawInputValue(toolCall: AgentToolCallCommand, key: string) {
  const input = toolCall.input ?? {};
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
}

export function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function getToolBooleanInputAny(toolCall: AgentToolCallCommand, keys: string[]) {
  for (const key of keys) {
    const value = getToolBooleanInput(toolCall, key);
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
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
