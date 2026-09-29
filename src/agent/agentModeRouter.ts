import {
  type AgentCapabilityId,
  type AgentToolActionKind,
} from './agentCapabilityTypes';
import {
  type AgentChatCommand,
  type AgentToolCallName,
} from './agentChatCommand';
import { type AgentExecutionPlan } from './agentOrchestrator';
import {
  AGENT_TOOL_REGISTRY,
  formatAgentToolLifecycleMetadata,
  getAgentToolDefinition,
  type AgentToolDefinition,
} from './agentToolRegistry';

export type AgentModeRouteMode = 'chat' | 'agent' | 'developer';

export interface AgentModePolicy {
  capabilityIds: AgentCapabilityId[];
  description: string;
  mode: AgentModeRouteMode;
  toolNames: AgentToolCallName[];
}

export interface AgentModeRoute {
  availableCapabilities: AgentCapabilityId[];
  availableToolNames: AgentToolCallName[];
  availableTools: AgentToolDefinition[];
  command: AgentChatCommand;
  mode: AgentModeRouteMode;
  planActionKinds: AgentToolActionKind[];
  policy: AgentModePolicy;
  reason: string;
  summary: string;
}

const DEVELOPER_TOOL_NAMES = new Set<AgentToolCallName>([
  'inspect_local_project',
  'run_local_project_action',
]);

const AGENT_MODE_POLICIES: Record<AgentModeRouteMode, AgentModePolicy> = {
  agent: {
    capabilityIds: [
      'desktop-observation',
      'desktop-organization',
      'agent-memory',
      'app-launcher',
      'game-companion',
      'local-file-system',
      'system-inspector',
      'pet-settings',
      'voice-control',
      'skill-system',
      'mcp-tools',
    ],
    description: 'Desktop user task mode: inspect this PC, arrange icons, open apps, and manage voice settings through approved tools.',
    mode: 'agent',
    toolNames: [
      'get_display_info',
      'get_system_info',
      'launch_local_app',
      'browser_search',
      'observe_windows_and_apps',
      'execute_desktop_action',
      'execute_desktop_input',
      'execute_desktop_sequence',
      'get_default_app_for_uri',
      'list_running_apps',
      'get_active_window_info',
      'execute_desktop_observation',
      'list_capture_sources',
      'summarize_visual_snapshot',
      'locate_screen_elements',
      'analyze_game_screen',
      'manage_game_companion_loop',
      'get_cursor_position',
      'focus_window',
      'close_window',
      'open_resource',
      'search_web',
      'control_browser',
      'run_controlled_command',
      'remember_local_app',
      'execute_memory_action',
      'get_path_info',
      'list_directory',
      'execute_local_file_action',
      'execute_file_management_action',
      'search_files',
      'read_text_file',
      'organize_desktop_icons',
      'place_desktop_icon',
      'get_pet_settings',
      'update_pet_settings',
      'get_voice_status',
      'switch_tts_provider',
      'warmup_local_voice',
      'set_voice_input',
      'start_voice_input_session',
      'stop_voice_input_session',
      'list_agent_skills',
      'execute_agent_skill',
      'list_mcp_tools',
      'call_mcp_tool',
    ],
  },
  chat: {
    capabilityIds: [],
    description: 'Conversation-only mode: no local computer tools are available.',
    mode: 'chat',
    toolNames: [],
  },
  developer: {
    capabilityIds: [
      'local-file-system',
      'local-project-inspector',
      'system-inspector',
    ],
    description: 'Developer mode: inspect local projects and run approved project actions with permission checks.',
    mode: 'developer',
    toolNames: [
      'inspect_local_project',
      'run_local_project_action',
      'get_path_info',
      'list_directory',
      'execute_local_file_action',
      'search_files',
      'read_text_file',
      'get_display_info',
      'get_system_info',
      'run_controlled_command',
    ],
  },
};

function getPolicyToolDefinitions(policy: AgentModePolicy) {
  return policy.toolNames
    .map((toolName) => getAgentToolDefinition(toolName))
    .filter((definition): definition is AgentToolDefinition => Boolean(definition));
}

function getPlanActionKinds(plan: AgentExecutionPlan | null) {
  const actionKinds = new Set<AgentToolActionKind>();
  for (const step of plan?.steps ?? []) {
    actionKinds.add(step.action.kind);
  }

  return [...actionKinds];
}

function resolveModeReason(command: AgentChatCommand, plan: AgentExecutionPlan | null, mode: AgentModeRouteMode) {
  if (!plan) {
    return 'No execution plan was produced, so the request stays in chat mode.';
  }

  if (mode === 'developer') {
    return 'The command targets local project inspection or project action execution.';
  }

  const toolName = command.toolCall?.name;
  if (toolName) {
    return `The command selected desktop Agent tool "${toolName}".`;
  }

  return `The command produced a desktop Agent plan for "${command.kind}".`;
}

function resolveModeFromCommand(command: AgentChatCommand, plan: AgentExecutionPlan | null): AgentModeRouteMode {
  if (!plan) {
    return 'chat';
  }

  if (command.kind === 'context-query') {
    return 'agent';
  }

  if (command.capabilityId === 'local-project-inspector') {
    return 'developer';
  }

  const toolName = command.toolCall?.name;
  if (toolName && DEVELOPER_TOOL_NAMES.has(toolName)) {
    return 'developer';
  }

  return 'agent';
}

function createModeRouteSummary(route: Omit<AgentModeRoute, 'summary'>) {
  if (route.mode === 'chat') {
    return 'Chat mode: no local tools are exposed.';
  }

  return `${route.mode} mode: ${route.availableToolNames.length} tool(s), ${route.availableCapabilities.length} capability group(s).`;
}

export function getAgentModePolicy(mode: AgentModeRouteMode) {
  return AGENT_MODE_POLICIES[mode];
}

export function listAgentModePolicies() {
  return [
    AGENT_MODE_POLICIES.chat,
    AGENT_MODE_POLICIES.agent,
    AGENT_MODE_POLICIES.developer,
  ];
}

export function isAgentDeveloperToolName(toolName: AgentToolCallName) {
  return DEVELOPER_TOOL_NAMES.has(toolName);
}

export function isAgentToolAvailableInMode(toolName: AgentToolCallName, mode: AgentModeRouteMode) {
  return AGENT_MODE_POLICIES[mode].toolNames.includes(toolName);
}

export function buildAgentModeRoute(command: AgentChatCommand, plan: AgentExecutionPlan | null): AgentModeRoute {
  const mode = resolveModeFromCommand(command, plan);
  const policy = getAgentModePolicy(mode);
  const routeWithoutSummary = {
    availableCapabilities: [...policy.capabilityIds],
    availableToolNames: [...policy.toolNames],
    availableTools: getPolicyToolDefinitions(policy),
    command,
    mode,
    planActionKinds: getPlanActionKinds(plan),
    policy,
    reason: resolveModeReason(command, plan, mode),
  };

  return {
    ...routeWithoutSummary,
    summary: createModeRouteSummary(routeWithoutSummary),
  };
}

export function createAgentModeAvailableToolLines(mode: AgentModeRouteMode) {
  return getPolicyToolDefinitions(getAgentModePolicy(mode)).map((definition) => (
    `- ${definition.name}: ${definition.description}. args: ${definition.argsSchemaText}. ${formatAgentToolLifecycleMetadata(definition.name)} ${definition.plannerGuidance}`
  ));
}

export function listRegisteredAgentToolNamesOutsideModePolicies() {
  const policyToolNames = new Set(
    listAgentModePolicies().flatMap((policy) => policy.toolNames),
  );

  return AGENT_TOOL_REGISTRY
    .map((definition) => definition.name)
    .filter((toolName) => !policyToolNames.has(toolName));
}
