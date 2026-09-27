import { type AgentCapabilityId } from '../agentCapabilityTypes';
import {
  type AgentActionScope,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../agentChatCommand';
import { createAgentTaskGoalId } from './agentTaskIdentity';

export {
  createAgentSubgoalId,
  createAgentTaskGoalId,
} from './agentTaskIdentity';

export function resolveAgentCapabilityId(toolName: AgentToolCallName): AgentCapabilityId {
  if (toolName === 'inspect_local_project' || toolName === 'run_local_project_action') {
    return 'local-project-inspector';
  }
  if ([
    'get_path_info',
    'list_directory',
    'execute_local_file_action',
    'execute_file_management_action',
    'search_files',
    'read_text_file',
  ].includes(toolName)) {
    return 'local-file-system';
  }
  if (toolName === 'get_pet_settings' || toolName === 'update_pet_settings') {
    return 'pet-settings';
  }
  if (toolName === 'execute_memory_action') {
    return 'agent-memory';
  }
  if ([
    'get_active_window_info',
    'observe_windows_and_apps',
    'execute_desktop_observation',
    'list_capture_sources',
    'summarize_visual_snapshot',
    'locate_screen_elements',
    'analyze_game_screen',
    'manage_game_companion_loop',
    'get_cursor_position',
  ].includes(toolName)) {
    return toolName === 'analyze_game_screen' || toolName === 'manage_game_companion_loop'
      ? 'game-companion'
      : 'desktop-observation';
  }
  if ([
    'get_voice_status',
    'switch_tts_provider',
    'warmup_local_voice',
    'set_voice_input',
    'start_voice_input_session',
    'stop_voice_input_session',
  ].includes(toolName)) {
    return 'voice-control';
  }
  if ([
    'launch_local_app',
    'browser_search',
    'execute_desktop_action',
    'execute_desktop_input',
    'execute_desktop_sequence',
    'get_default_app_for_uri',
    'list_running_apps',
    'focus_window',
    'close_window',
    'open_resource',
    'search_web',
    'control_browser',
    'remember_local_app',
  ].includes(toolName)) {
    return 'app-launcher';
  }
  if (toolName === 'run_controlled_command') {
    return 'system-inspector';
  }
  if (toolName === 'organize_desktop_icons' || toolName === 'place_desktop_icon') {
    return 'desktop-organization';
  }
  if (toolName === 'list_agent_skills' || toolName === 'execute_agent_skill') {
    return 'skill-system';
  }
  if (toolName === 'list_mcp_tools' || toolName === 'call_mcp_tool') {
    return 'mcp-tools';
  }
  return 'system-inspector';
}

export function createAgentToolCommand(options: {
  actionScope?: Omit<AgentActionScope, 'taskGoalId'> & { taskGoalId?: string | null };
  args: Record<string, unknown>;
  sourceText: string;
  toolName: AgentToolCallName;
  userGoal: string;
}): AgentChatCommand {
  return {
    capabilityId: resolveAgentCapabilityId(options.toolName),
    instruction: options.userGoal,
    kind: 'tool-call',
    sourceText: options.sourceText,
    toolCall: {
      ...(options.actionScope ? {
        actionScope: {
          ...options.actionScope,
          taskGoalId: options.actionScope.taskGoalId ?? createAgentTaskGoalId(options.userGoal),
        },
      } : {}),
      goal: options.userGoal,
      input: options.args,
      name: options.toolName,
    },
  };
}
