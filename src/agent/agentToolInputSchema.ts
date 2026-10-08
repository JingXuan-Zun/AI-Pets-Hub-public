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
  browser_search: AGENT_OBSERVATION_INPUT_SPECS.browser_search,
  observe_windows_and_apps: AGENT_OBSERVATION_INPUT_SPECS.observe_windows_and_apps,
  execute_desktop_action: AGENT_DESKTOP_ACTION_INPUT_SPECS.execute_desktop_action,
  execute_desktop_input: AGENT_DESKTOP_ACTION_INPUT_SPECS.execute_desktop_input,
  execute_desktop_sequence: AGENT_DESKTOP_ACTION_INPUT_SPECS.execute_desktop_sequence,
  execute_desktop_observation: AGENT_OBSERVATION_INPUT_SPECS.execute_desktop_observation,
  run_controlled_command: AGENT_DESKTOP_ACTION_INPUT_SPECS.run_controlled_command,
  control_browser: AGENT_DESKTOP_ACTION_INPUT_SPECS.control_browser,
  locate_screen_elements: AGENT_OBSERVATION_INPUT_SPECS.locate_screen_elements,
  execute_local_file_action: AGENT_LOCAL_SERVICE_INPUT_SPECS.execute_local_file_action,
  execute_file_management_action: AGENT_LOCAL_SERVICE_INPUT_SPECS.execute_file_management_action,
  execute_memory_action: AGENT_LOCAL_SERVICE_INPUT_SPECS.execute_memory_action,
  get_default_app_for_uri: AGENT_OBSERVATION_INPUT_SPECS.get_default_app_for_uri,
  get_display_info: AGENT_OBSERVATION_INPUT_SPECS.get_display_info,
  get_system_info: AGENT_OBSERVATION_INPUT_SPECS.get_system_info,
  get_pet_settings: AGENT_LOCAL_SERVICE_INPUT_SPECS.get_pet_settings,
  update_pet_settings: AGENT_LOCAL_SERVICE_INPUT_SPECS.update_pet_settings,
  get_voice_status: AGENT_LOCAL_SERVICE_INPUT_SPECS.get_voice_status,
  list_running_apps: AGENT_OBSERVATION_INPUT_SPECS.list_running_apps,
  get_active_window_info: AGENT_OBSERVATION_INPUT_SPECS.get_active_window_info,
  list_capture_sources: AGENT_OBSERVATION_INPUT_SPECS.list_capture_sources,
  summarize_visual_snapshot: AGENT_OBSERVATION_INPUT_SPECS.summarize_visual_snapshot,
  analyze_game_screen: AGENT_OBSERVATION_INPUT_SPECS.analyze_game_screen,
  manage_game_companion_loop: AGENT_LOCAL_SERVICE_INPUT_SPECS.manage_game_companion_loop,
  get_cursor_position: AGENT_OBSERVATION_INPUT_SPECS.get_cursor_position,
  focus_window: AGENT_DESKTOP_ACTION_INPUT_SPECS.focus_window,
  close_window: AGENT_DESKTOP_ACTION_INPUT_SPECS.close_window,
  open_resource: AGENT_DESKTOP_ACTION_INPUT_SPECS.open_resource,
  inspect_local_project: AGENT_LOCAL_SERVICE_INPUT_SPECS.inspect_local_project,
  launch_local_app: AGENT_DESKTOP_ACTION_INPUT_SPECS.launch_local_app,
  search_web: AGENT_OBSERVATION_INPUT_SPECS.search_web,
  organize_desktop_icons: AGENT_DESKTOP_ACTION_INPUT_SPECS.organize_desktop_icons,
  place_desktop_icon: AGENT_DESKTOP_ACTION_INPUT_SPECS.place_desktop_icon,
  remember_local_app: AGENT_DESKTOP_ACTION_INPUT_SPECS.remember_local_app,
  get_path_info: AGENT_LOCAL_SERVICE_INPUT_SPECS.get_path_info,
  list_directory: AGENT_LOCAL_SERVICE_INPUT_SPECS.list_directory,
  search_files: AGENT_LOCAL_SERVICE_INPUT_SPECS.search_files,
  read_text_file: AGENT_LOCAL_SERVICE_INPUT_SPECS.read_text_file,
  set_voice_input: AGENT_LOCAL_SERVICE_INPUT_SPECS.set_voice_input,
  start_voice_input_session: AGENT_LOCAL_SERVICE_INPUT_SPECS.start_voice_input_session,
  stop_voice_input_session: AGENT_LOCAL_SERVICE_INPUT_SPECS.stop_voice_input_session,
  switch_tts_provider: AGENT_LOCAL_SERVICE_INPUT_SPECS.switch_tts_provider,
  warmup_local_voice: AGENT_LOCAL_SERVICE_INPUT_SPECS.warmup_local_voice,
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

function isAgentToolInputRequired(
  toolName: AgentToolCallName,
  spec: AgentToolInputParamSpec,
  input: Record<string, unknown>,
) {
  if (!spec.required) {
    return false;
  }

  if (toolName !== 'execute_desktop_sequence' || spec.key !== 'stepsJson') {
    return true;
  }

  const mode = typeof input.mode === 'string' ? input.mode.trim().toLowerCase() : '';
  const visibleClickJson = typeof input.visibleClickJson === 'string' ? input.visibleClickJson.trim() : '';
  return !(mode === 'visible_click' || mode === 'visibleclick' || Boolean(visibleClickJson));
}

export function prepareAgentToolInput(
  toolName: AgentToolCallName,
  input: Record<string, unknown>,
): AgentToolInputPrepareResult {
  const normalizedInput: Record<string, unknown> = {};
  const specs = getAgentToolInputParamSpecs(toolName);

  for (const spec of specs) {
    const rawValue = getAgentToolInputParamRawValue(input, spec);
    const normalizedRawValue = toolName === 'update_pet_settings'
      && spec.key === 'changesJson'
      && rawValue
      && typeof rawValue === 'object'
      && !Array.isArray(rawValue)
      ? JSON.stringify(rawValue)
      : rawValue;
    const isMissing = normalizedRawValue === undefined || normalizedRawValue === null || (
      typeof normalizedRawValue === 'string' && !normalizedRawValue.trim()
    );

    if (isMissing) {
      if (isAgentToolInputRequired(toolName, spec, input)) {
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
