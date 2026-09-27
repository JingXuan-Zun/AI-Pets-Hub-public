import { type AgentToolCallName } from '../agentChatCommand';

const AGENT_DESKTOP_COMPATIBILITY_TOOLS = new Set<AgentToolCallName>([
  'browser_search',
  'close_window',
  'focus_window',
  'get_active_window_info',
  'get_default_app_for_uri',
  'launch_local_app',
  'list_running_apps',
  'open_resource',
  'search_web',
]);

const AGENT_VISUAL_COMPATIBILITY_TOOLS = new Set<AgentToolCallName>([
  'get_cursor_position',
  'get_display_info',
  'get_system_info',
  'list_capture_sources',
  'summarize_visual_snapshot',
]);

const AGENT_FILE_COMPATIBILITY_TOOLS = new Set<AgentToolCallName>([
  'get_path_info',
  'list_directory',
  'read_text_file',
  'search_files',
]);

const AGENT_DESKTOP_LAYOUT_COMPATIBILITY_TOOLS = new Set<AgentToolCallName>([
  'place_desktop_icon',
]);

export function createAgentCompatibilityToolRejection(toolName: string) {
  const normalizedToolName = toolName as AgentToolCallName;
  const capabilityGuidance = AGENT_DESKTOP_COMPATIBILITY_TOOLS.has(normalizedToolName)
    ? 'This is a desktop/app/window/browser/resource task. Re-plan with primary tools such as observe_windows_and_apps, execute_desktop_action, execute_desktop_sequence, or control_browser, and put the concrete operation in the arguments instead of choosing a compatibility-only tool name.'
    : AGENT_VISUAL_COMPATIBILITY_TOOLS.has(normalizedToolName)
      ? 'This is a desktop observation or visual/system fact task. Re-plan with execute_desktop_observation, locate_screen_elements, analyze_game_screen, or a more specific primary observation tool when appropriate.'
      : AGENT_FILE_COMPATIBILITY_TOOLS.has(normalizedToolName)
        ? 'This is a local file or folder observation task. Re-plan with execute_local_file_action, execute_file_management_action, or inspect_local_project according to whether the task is read-only, mutating, or project-oriented.'
        : AGENT_DESKTOP_LAYOUT_COMPATIBILITY_TOOLS.has(normalizedToolName)
          ? 'This is a desktop layout/icon task. Re-plan with organize_desktop_icons for layout planning, or use visual observation plus execute_desktop_input only when the exact target and approval-required input action are clear.'
          : 'Re-plan with one of the listed primary Agent tools and express the requested operation through that tool arguments.';

  return [
    `Compatibility-only tool "${toolName}" is not part of the primary Agent tool surface.`,
    'compatibilityToolRejectionPolicy=This rejection is advisory/decision-contract-driven. It redirects compatibility-only tool names to primary Agent tools without prescribing a fixed execution chain.',
    capabilityGuidance,
    'Do not call the compatibility-only tool again. Preserve the user intent, observe missing facts when useful, and choose the next primary tool from the available tool list.',
  ].join(' ');
}
