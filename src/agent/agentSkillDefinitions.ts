import { type AgentCapabilityId } from './agentCapabilityTypes';
import { type AgentToolCallName } from './agentChatCommand';
import {
  getAgentSkillPackageMetadata,
  type AgentSkillPackageMetadata,
} from './agentSkillPackageMetadata';

export type AgentSkillId =
  | 'character.animation'
  | 'desktop.observation'
  | 'game.companion'
  | 'local.files'
  | 'memory.manage'
  | 'mcp.tool'
  | 'platform.capability-router'
  | 'voice.control';

export type AgentSkillPreferredCapabilityId = AgentCapabilityId;
export type AgentSkillPreferredToolName = AgentToolCallName;

export interface AgentSkillDefinition {
  defaultEnabled: boolean;
  description: string;
  id: AgentSkillId;
  inputSchema: Record<string, unknown>;
  package: AgentSkillPackageMetadata;
  preferredCapabilityId: AgentSkillPreferredCapabilityId;
  preferredToolNames: AgentSkillPreferredToolName[];
  risk: 'read' | 'visual' | 'action';
  stage: 'foundation' | 'mvp' | 'future';
  tags: string[];
  title: string;
}

export const AGENT_SKILL_REGISTRY: AgentSkillDefinition[] = [
  {
    defaultEnabled: true,
    description: 'Resolve character gesture, animation, dance, and expression intent without binding that ability to one role.',
    id: 'character.animation',
    inputSchema: {
      properties: {
        animationId: { type: 'string' },
        animationIds: {
          items: { type: 'string' },
          type: 'array',
        },
        expressionId: { type: 'string' },
        expressionIds: {
          items: { type: 'string' },
          type: 'array',
        },
        audioId: { type: 'string' },
        audioOffsetMs: { type: 'number' },
        audioStartDelayMs: { type: 'number' },
        audioUrl: { type: 'string' },
        beatCount: { type: 'number' },
        bpm: { type: 'number' },
        durationMs: { type: 'number' },
        intent: { type: 'string' },
        music: { type: 'string' },
        musicId: { type: 'string' },
        musicSync: { type: 'object' },
        offsetMs: { type: 'number' },
        startDelayMs: { type: 'number' },
        sequence: {
          items: {
            oneOf: [
              { type: 'string' },
              { type: 'object' },
            ],
          },
          type: 'array',
        },
        steps: {
          items: {
            oneOf: [
              { type: 'string' },
              { type: 'object' },
            ],
          },
          type: 'array',
        },
        song: { type: 'string' },
        songId: { type: 'string' },
        sync: { type: 'object' },
        targetPetId: { type: 'string' },
        timeline: {
          items: {
            oneOf: [
              { type: 'string' },
              { type: 'object' },
            ],
          },
          type: 'array',
        },
        timelineJson: { type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('character.animation'),
    preferredCapabilityId: 'skill-system',
    preferredToolNames: [],
    risk: 'action',
    stage: 'mvp',
    tags: ['character', 'animation', 'motion', 'expression'],
    title: 'Character Animation Skill',
  },
  {
    defaultEnabled: true,
    description: 'Route desktop, window, capture-source, visual, and cursor observation intent through existing Agent tools.',
    id: 'desktop.observation',
    inputSchema: {
      properties: {
        query: { type: 'string' },
        question: { type: 'string' },
        sourceType: { enum: ['screen', 'window', 'all'], type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('desktop.observation'),
    preferredCapabilityId: 'desktop-observation',
    preferredToolNames: ['observe_windows_and_apps', 'execute_desktop_observation', 'summarize_visual_snapshot', 'locate_screen_elements'],
    risk: 'visual',
    stage: 'mvp',
    tags: ['desktop', 'vision', 'observation'],
    title: 'Desktop Observation Skill',
  },
  {
    defaultEnabled: true,
    description: 'Route game screen analysis and low-frequency game companion loops.',
    id: 'game.companion',
    inputSchema: {
      properties: {
        gameHint: { type: 'string' },
        query: { type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('game.companion'),
    preferredCapabilityId: 'game-companion',
    preferredToolNames: ['analyze_game_screen', 'manage_game_companion_loop'],
    risk: 'visual',
    stage: 'mvp',
    tags: ['game', 'vision', 'companion'],
    title: 'Game Companion Skill',
  },
  {
    defaultEnabled: true,
    description: 'Route read-only local file inspection and bounded file-management previews.',
    id: 'local.files',
    inputSchema: {
      properties: {
        path: { type: 'string' },
        query: { type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('local.files'),
    preferredCapabilityId: 'local-file-system',
    preferredToolNames: ['execute_local_file_action', 'get_path_info', 'list_directory', 'search_files', 'read_text_file'],
    risk: 'read',
    stage: 'mvp',
    tags: ['files', 'local', 'read'],
    title: 'Local Files Skill',
  },
  {
    defaultEnabled: true,
    description: 'Route explicit user memory read, remember, and forget requests through the global memory tool.',
    id: 'memory.manage',
    inputSchema: {
      properties: {
        action: { enum: ['read', 'remember', 'forget'], type: 'string' },
        key: { type: 'string' },
        value: { type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('memory.manage'),
    preferredCapabilityId: 'agent-memory',
    preferredToolNames: ['execute_memory_action'],
    risk: 'action',
    stage: 'mvp',
    tags: ['memory', 'preferences'],
    title: 'Memory Skill',
  },
  {
    defaultEnabled: true,
    description: 'Route voice status, TTS provider, warmup, and voice input session requests.',
    id: 'voice.control',
    inputSchema: {
      properties: {
        action: { type: 'string' },
        provider: { enum: ['browser', 'api', 'local'], type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('voice.control'),
    preferredCapabilityId: 'voice-control',
    preferredToolNames: ['get_voice_status', 'switch_tts_provider', 'warmup_local_voice', 'start_voice_input_session'],
    risk: 'action',
    stage: 'mvp',
    tags: ['voice', 'tts', 'stt'],
    title: 'Voice Control Skill',
  },
  {
    defaultEnabled: true,
    description: 'Expose MCP-style tool discovery and calls behind the same Agent permission and receipt layer.',
    id: 'mcp.tool',
    inputSchema: {
      properties: {
        serverId: { type: 'string' },
        toolName: { type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('mcp.tool'),
    preferredCapabilityId: 'mcp-tools',
    preferredToolNames: ['list_mcp_tools', 'call_mcp_tool'],
    risk: 'action',
    stage: 'foundation',
    tags: ['mcp', 'tools', 'protocol'],
    title: 'MCP Tool Skill',
  },
  {
    defaultEnabled: true,
    description: 'Choose Tool, Skill, or MCP routes as platform capabilities instead of role-owned hardcoded tools.',
    id: 'platform.capability-router',
    inputSchema: {
      properties: {
        intent: { type: 'string' },
        rolePreference: { type: 'string' },
      },
      type: 'object',
    },
    package: getAgentSkillPackageMetadata('platform.capability-router'),
    preferredCapabilityId: 'skill-system',
    preferredToolNames: ['list_agent_skills', 'execute_agent_skill', 'list_mcp_tools'],
    risk: 'read',
    stage: 'foundation',
    tags: ['routing', 'capability', 'platform'],
    title: 'Capability Router Skill',
  },
];
