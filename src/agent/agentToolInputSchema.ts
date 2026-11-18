import { AGENT_DESKTOP_ACTION_INPUT_SPECS } from './inputSchema/desktopActionSpecs';
import { AGENT_OBSERVATION_INPUT_SPECS } from './inputSchema/observationSpecs';
import { AGENT_LOCAL_SERVICE_INPUT_SPECS } from './inputSchema/localServiceSpecs';
import { type AgentToolCallName } from './agentChatCommand';

export type AgentToolInputParamType = 'boolean' | 'number' | 'string';

export interface AgentToolInputParamSpec {
  aliases?: readonly string[];
  enumValues?: readonly string[];
  key: string;
  required?: boolean;
  type: AgentToolInputParamType;
}

export type AgentToolInputPrepareResult =
  | {
      input: Record<string, unknown>;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export const AGENT_TOOL_INPUT_PARAM_SPECS: Record<AgentToolCallName, readonly AgentToolInputParamSpec[]> = {
  run_controlled_command: AGENT_DESKTOP_ACTION_INPUT_SPECS.run_controlled_command,
  control_browser: AGENT_DESKTOP_ACTION_INPUT_SPECS.control_browser,
  execute_memory_action: AGENT_LOCAL_SERVICE_INPUT_SPECS.execute_memory_action,
  get_system_info: AGENT_OBSERVATION_INPUT_SPECS.get_system_info,
  get_pet_settings: AGENT_LOCAL_SERVICE_INPUT_SPECS.get_pet_settings,
  update_pet_settings: AGENT_LOCAL_SERVICE_INPUT_SPECS.update_pet_settings,
  use_platform_capability: AGENT_LOCAL_SERVICE_INPUT_SPECS.use_platform_capability,
  manage_game_companion_loop: AGENT_LOCAL_SERVICE_INPUT_SPECS.manage_game_companion_loop,
  inspect_local_project: AGENT_LOCAL_SERVICE_INPUT_SPECS.inspect_local_project,
  organize_desktop_icons: AGENT_DESKTOP_ACTION_INPUT_SPECS.organize_desktop_icons,
  remember_local_app: AGENT_DESKTOP_ACTION_INPUT_SPECS.remember_local_app,
  run_local_project_action: AGENT_LOCAL_SERVICE_INPUT_SPECS.run_local_project_action,
  list_agent_skills: AGENT_LOCAL_SERVICE_INPUT_SPECS.list_agent_skills,
  execute_agent_skill: AGENT_LOCAL_SERVICE_INPUT_SPECS.execute_agent_skill,
  list_mcp_tools: AGENT_LOCAL_SERVICE_INPUT_SPECS.list_mcp_tools,
  call_mcp_tool: AGENT_LOCAL_SERVICE_INPUT_SPECS.call_mcp_tool,
};

export function getAgentToolInputParamSpecs(toolName: AgentToolCallName) {
  return AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
}

export function getAgentToolInputParamRawValue(
  input: Record<string, unknown>,
  spec: AgentToolInputParamSpec,
) {
  const keys = [spec.key, ...(spec.aliases ?? [])];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return input[key];
    }
  }

  return undefined;
}

export function formatAgentToolInputParamType(type: AgentToolInputParamType) {
  if (type === 'string') {
    return 'string';
  }

  if (type === 'number') {
    return 'number';
  }

  return 'boolean';
}

function isAgentToolInputRequired(spec: AgentToolInputParamSpec) {
  return Boolean(spec.required);
}

export function prepareAgentToolInput(
  toolName: AgentToolCallName,
  input: Record<string, unknown>,
): AgentToolInputPrepareResult {
  const normalizedInput: Record<string, unknown> = {};
  const specs = getAgentToolInputParamSpecs(toolName);

  for (const spec of specs) {
    const rawValue = getAgentToolInputParamRawValue(input, spec);
    const normalizedRawValue = ((toolName === 'update_pet_settings' && spec.key === 'changesJson')
      || (toolName === 'use_platform_capability' && spec.key === 'argsJson'))
      && rawValue
      && typeof rawValue === 'object'
      && !Array.isArray(rawValue)
      ? JSON.stringify(rawValue)
      : rawValue;
    const isMissing = normalizedRawValue === undefined || normalizedRawValue === null || (
      typeof normalizedRawValue === 'string' && !normalizedRawValue.trim()
    );

    if (isMissing) {
      if (isAgentToolInputRequired(spec)) {
        return {
          error: `Agent tool "${toolName}" is missing required parameter "${spec.key}".`,
          ok: false,
        };
      }

      continue;
    }

    if (spec.type === 'string') {
      if (typeof normalizedRawValue !== 'string') {
        return {
          error: `Agent tool "${toolName}" parameter "${spec.key}" must be ${formatAgentToolInputParamType(spec.type)}.`,
          ok: false,
        };
      }

      const normalizedValue = normalizedRawValue.trim();
      if (spec.enumValues && !spec.enumValues.includes(normalizedValue)) {
        return {
          error: `Agent tool "${toolName}" parameter "${spec.key}" must be one of: ${spec.enumValues.join(', ')}.`,
          ok: false,
        };
      }

      normalizedInput[spec.key] = normalizedValue;
      continue;
    }

    if (spec.type === 'boolean') {
      if (typeof normalizedRawValue !== 'boolean') {
        return {
          error: `Agent tool "${toolName}" parameter "${spec.key}" must be ${formatAgentToolInputParamType(spec.type)}.`,
          ok: false,
        };
      }

      normalizedInput[spec.key] = normalizedRawValue;
      continue;
    }

    const normalizedValue = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue.trim())
        : NaN;

    if (!Number.isFinite(normalizedValue)) {
      return {
        error: `Agent tool "${toolName}" parameter "${spec.key}" must be ${formatAgentToolInputParamType(spec.type)}.`,
        ok: false,
      };
    }

    normalizedInput[spec.key] = normalizedValue;
  }

  return {
    input: {
      ...input,
      ...normalizedInput,
    },
    ok: true,
  };
}
