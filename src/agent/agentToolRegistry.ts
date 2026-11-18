import { formatPlatformCapabilityCatalog } from '../platform-capabilities/platformCapabilityRegistry';
import {
  type AgentCapabilityId,
  type AgentToolActionKind,
} from './agentCapabilityTypes';
import { type AgentToolCallName } from './agentChatCommand';

export interface AgentToolDefinition {
  argsSchemaText: string;
  capabilityId: AgentCapabilityId;
  description: string;
  name: AgentToolCallName;
  plannerGuidance: string;
  toolActions: AgentToolActionKind[];
}

export const AGENT_TOOL_REGISTRY: AgentToolDefinition[] = [
  {
    argsSchemaText: '{ "action": "start" | "stop" | "status", "sourceType"?: "screen" | "window" | "all", "sourceId"?: string, "query"?: string, "gameHint"?: string, "focus"?: string, "intervalMs"?: number, "minCommentIntervalMs"?: number, "maxSamples"?: number }',
    capabilityId: 'game-companion',
    description: 'start, stop, or inspect a low-frequency game companion loop that samples a locked game screen/window and posts short companion observations',
    name: 'manage_game_companion_loop',
    plannerGuidance: 'Use when the user wants ongoing game companionship, low-frequency game watching, or wants the pet to keep commenting while they play. Start only after the user clearly requests continuous observation; use stop when the user asks to stop watching/commenting. This loop samples periodically and should not be used for a one-time question.',
    toolActions: ['manage-game-companion-loop'],
  },
  {
    argsSchemaText: '{ "action": "open_url" | "search_web" | "read_page" | "focus_tab" | "list_tabs" | "status", "url"?: string, "query"?: string, "tabId"?: string, "title"?: string, "forceNewPage"?: boolean, "forceOpen"?: boolean, "readPage"?: boolean }',
    capabilityId: 'app-launcher',
    description: 'control the app managed browser session: open URL, search web, list/focus tabs, read current page text, or inspect browser status',
    name: 'control_browser',
    plannerGuidance: 'Use for browser tasks that need direct URL navigation, page reading, tab listing/focusing, or controlled search. Use open_url for URLs/domains and search_web only for keyword search. For video summary, prefer open_url/read_page/list_tabs if the video page is known; do not search for candidate videos unless the user asked to search. read_page/list_tabs/status are read-only; open_url/search/focus mutate browser state and need approval.',
    toolActions: ['control-browser-read', 'control-browser-open'],
  },
  {
    argsSchemaText: '{ "command": string, "cwd"?: string, "shell"?: "powershell" | "cmd", "timeoutMs"?: number }',
    capabilityId: 'system-inspector',
    description: 'run one controlled local shell command and return stdout, stderr, exitCode, cwd, and safety blocking details',
    name: 'run_controlled_command',
    plannerGuidance: 'Use when existing tools are not enough and a small diagnostic command can answer the user. The runtime blocks destructive patterns, shell chaining, redirection, and pipes in v1; still request approval before execution. Prefer dedicated read-only tools when available.',
    toolActions: ['run-controlled-command'],
  },
  {
    argsSchemaText: '{ "alias": string, "path": string }',
    capabilityId: 'app-launcher',
    description: 'remember a user-provided app path',
    name: 'remember_local_app',
    plannerGuidance: 'Use when the user provides a local exe/lnk/url/appref-ms path and asks the agent to remember it.',
    toolActions: ['remember-local-app'],
  },
  {
    argsSchemaText: '{ "action": "list" | "recall" | "remember" | "forget", "query"?: string, "value"?: string, "kind"?: "profile" | "preference" | "promise" | "event" | "other", "limit"?: number }',
    capabilityId: 'agent-memory',
    description: 'read or change the shared “关于你” memory: facts about the user that every character knows',
    name: 'execute_memory_action',
    plannerGuidance: 'Use this for durable facts and preferences about the user. list/recall are read-only. remember only proposes the fact: the user approves it in the chat sidebar before it is stored. forget deletes matching facts and requires approval. Do not use memory for current local computer facts.',
    toolActions: ['read-agent-memory', 'remember-agent-memory', 'forget-agent-memory'],
  },
  {
    argsSchemaText: '{ "targetDisplay"?: "primary" | "secondary" | "current" | "all", "sourceDisplay"?: "primary" | "secondary" | "current" | "all", "sourceScope"?: "all-icons" | "display-icons", "displayTarget"?: "primary" | "secondary" | "all", "scope"?: "all-icons" | "display-icons", "mode"?: "preview" | "execute", "groupBy"?: "none" | "kind" | "category" | "extension", "placementIntent"?: string }',
    capabilityId: 'desktop-organization',
    description: 'arrange desktop icons',
    name: 'organize_desktop_icons',
    plannerGuidance: 'For a direct organize/arrange request, first use mode "preview" as the one-call preflight: it observes icons/displays, reads item metadata, classifies desktop items, applies optional grouping, and prepares a plan. Then continue to mode "execute" so the permission system can ask before moving icons. Prefer structured intent fields: targetDisplay is where the arranged icons should end up; sourceScope "display-icons" means only icons already on the target/source display, and "all-icons" means arrange all desktop icons into the target display. Use placementIntent to preserve open-ended layout requests such as target region, preserve-other-icons, or item subset intent; it is evidence for planning/verification, not a fixed command template. Use displayTarget/scope only as legacy aliases. Use preview-only final answers only when the user explicitly asks just to inspect, preview, or plan. Use groupBy "category" when the user asks to keep images/documents/media/folders together or says type/category/group by type, "kind" for files/folders/shortcuts/system icons, and "extension" for suffix-level grouping. If the request is ambiguous between organizing existing icons on a display and moving all icons to that display, ask_user instead of guessing.',
    toolActions: ['read-display-info', 'list-desktop-icons', 'preview-desktop-icon-arrangement', 'move-desktop-icon'],
  },
  {
    argsSchemaText: '{ "includeDisplays"?: boolean }',
    capabilityId: 'system-inspector',
    description: 'read this computer basic configuration',
    name: 'get_system_info',
    plannerGuidance: 'Use it for OS, CPU, memory, GPU, hardware/config questions. Do not answer local computer facts from memory.',
    toolActions: ['read-system-info', 'read-display-info'],
  },
  {
    argsSchemaText: '{ "path"?: string, "query"?: string }',
    capabilityId: 'pet-settings',
    description: 'read the desktop pet configuration tree or one exact configuration path; sensitive values are redacted',
    name: 'get_pet_settings',
    plannerGuidance: 'Use for any desktop pet setting question or before a non-obvious change. With path, read one exact path. With query, search available runtime configuration paths. With neither, discover available paths. This is not a manually maintained whitelist: paths come from the live PetConfig tree.',
    toolActions: ['read-pet-settings'],
  },
  {
    argsSchemaText: '{ "changesJson": string }',
    capabilityId: 'pet-settings',
    description: 'atomically update any existing desktop pet configuration path using a JSON object of path-to-value changes',
    name: 'update_pet_settings',
    plannerGuidance: 'Use after the required exact paths and value types are known. changesJson must be a JSON object, for example {"scale":1.2,"settings.autoSpeakResponses":false}. Existing runtime paths are validated dynamically, values must keep the current field type, the result is normalized, saved, and read back. This changes settings and requires confirmation.',
    toolActions: ['update-pet-settings'],
  },
  {
    argsSchemaText: '{ "capability": string, "argsJson"?: string }',
    capabilityId: 'platform-capabilities',
    description: `use one of the platform's own features by id. Capabilities: ${formatPlatformCapabilityCatalog().join(' | ')}`,
    name: 'use_platform_capability',
    plannerGuidance: 'Prefer this over update_pet_settings whenever a listed capability fits the request. argsJson is a JSON object of the capability args, for example {"capability":"life_companion.quiet_hours","argsJson":"{\\"start\\":\\"23:00\\",\\"end\\":\\"08:00\\"}"}. [read] capabilities run silently; [change] capabilities ask the user first with a plain-language summary.',
    toolActions: ['read-platform-capability', 'use-platform-capability'],
  },
  {
    argsSchemaText: '{ "path": string, "question"?: string }',
    capabilityId: 'local-project-inspector',
    description: 'read-only inspect a local folder or program path and infer how it runs',
    name: 'inspect_local_project',
    plannerGuidance: 'Use it for "how does this folder/project/program run", entrypoint, startup method, or local project analysis questions.',
    toolActions: ['inspect-local-project'],
  },
  {
    argsSchemaText: '{ "path"?: string, "actionIndex"?: number, "command"?: string, "label"?: string }',
    capabilityId: 'local-project-inspector',
    description: 'run/start/open one suggested action from inspect_local_project',
    name: 'run_local_project_action',
    plannerGuidance: 'If the user says "run the first one" after an inspection, path may be omitted. This tool requires confirmation later; do not choose it for analysis-only questions.',
    toolActions: ['inspect-local-project', 'run-local-project-action'],
  },
  {
    argsSchemaText: '{ "query"?: string, "limit"?: number }',
    capabilityId: 'skill-system',
    description: 'list platform Agent skills without executing them',
    name: 'list_agent_skills',
    plannerGuidance: 'Discover built-in skills and imported skills enabled for the current role. Use the returned ID with execute_agent_skill to read a requested skill before applying it. Listing alone does not complete a skill-based task.',
    toolActions: ['list-agent-skills'],
  },
  {
    argsSchemaText: '{ "skillId": string, "intent"?: string, "target"?: string, "inputJson"?: string, "dryRun"?: boolean }',
    capabilityId: 'skill-system',
    description: 'resolve one platform Agent skill into preferred tool routes or a dry-run marker',
    name: 'execute_agent_skill',
    plannerGuidance: 'Resolve a requested built-in skill or read an enabled imported skill. For declarative skills, apply the returned instructions in the next decision and produce the requested output; loading instructions is not task completion. Any tool actions still require normal permissions. Prefer dryRun true unless the user asked to execute.',
    toolActions: ['read-agent-skill', 'execute-agent-skill'],
  },
  {
    argsSchemaText: '{ "serverId"?: string }',
    capabilityId: 'mcp-tools',
    description: 'list registered local MCP-style tools',
    name: 'list_mcp_tools',
    plannerGuidance: 'Use to inspect available MCP-style tools before choosing a call. Read-only.',
    toolActions: ['list-mcp-tools'],
  },
  {
    argsSchemaText: '{ "serverId": string, "name": string, "argumentsJson"?: string }',
    capabilityId: 'mcp-tools',
    description: 'call one registered local MCP-style tool through Agent permissions',
    name: 'call_mcp_tool',
    plannerGuidance: 'Use only after the server and tool are known. Pass JSON object arguments as argumentsJson.',
    toolActions: ['call-mcp-tool'],
  },
];

const AGENT_TOOL_DEFINITION_BY_NAME = new Map(
  AGENT_TOOL_REGISTRY.map((definition) => [definition.name, definition]),
);

export function getAgentToolDefinition(name: AgentToolCallName) {
  return AGENT_TOOL_DEFINITION_BY_NAME.get(name) ?? null;
}

export function listAgentToolNames() {
  return AGENT_TOOL_REGISTRY.map((definition) => definition.name);
}

export function isAgentToolName(value: string): value is AgentToolCallName {
  return AGENT_TOOL_DEFINITION_BY_NAME.has(value as AgentToolCallName);
}
