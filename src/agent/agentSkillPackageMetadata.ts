import { type AgentSkillId } from './agentSkillDefinitions';

export interface AgentSkillPackageMetadata {
  assetRequirements: string[];
  installStatus: 'bundled' | 'external-required' | 'planned';
  runtime: 'local' | 'platform-tool' | 'external-mcp' | 'hybrid';
  runtimeRequirements: string[];
  version: string;
}

export const AGENT_SKILL_PACKAGE_METADATA_BY_ID: Record<AgentSkillId, AgentSkillPackageMetadata> = {
  'character.animation': {
    assetRequirements: ['motionBindings', 'optional:musicAssets'],
    installStatus: 'bundled',
    runtime: 'hybrid',
    runtimeRequirements: ['desktopPetChatStore', 'model-motion-bindings'],
    version: '0.3.0',
  },
  'desktop.observation': {
    assetRequirements: ['screen-or-window-capture'],
    installStatus: 'bundled',
    runtime: 'platform-tool',
    runtimeRequirements: ['desktop-observation-tools', 'vision-model-optional'],
    version: '0.1.0',
  },
  'game.companion': {
    assetRequirements: ['game-screen-or-window-capture'],
    installStatus: 'bundled',
    runtime: 'platform-tool',
    runtimeRequirements: ['game-companion-loop', 'vision-model-optional'],
    version: '0.1.0',
  },
  'local.files': {
    assetRequirements: ['local-file-path'],
    installStatus: 'bundled',
    runtime: 'platform-tool',
    runtimeRequirements: ['local-file-tools'],
    version: '0.1.0',
  },
  'mcp.tool': {
    assetRequirements: ['optional:mcp-server-config'],
    installStatus: 'external-required',
    runtime: 'external-mcp',
    runtimeRequirements: ['mcp-config', 'mcp-permission-policy'],
    version: '0.2.0',
  },
  'memory.manage': {
    assetRequirements: [],
    installStatus: 'bundled',
    runtime: 'platform-tool',
    runtimeRequirements: ['agent-memory-store'],
    version: '0.1.0',
  },
  'platform.capability-router': {
    assetRequirements: [],
    installStatus: 'bundled',
    runtime: 'hybrid',
    runtimeRequirements: ['skill-registry', 'agent-tool-registry', 'mcp-tool-registry'],
    version: '0.1.0',
  },
  'voice.control': {
    assetRequirements: ['optional:local-voice-model'],
    installStatus: 'bundled',
    runtime: 'platform-tool',
    runtimeRequirements: ['tts-provider', 'stt-provider'],
    version: '0.1.0',
  },
};

export function getAgentSkillPackageMetadata(skillId: AgentSkillId) {
  return AGENT_SKILL_PACKAGE_METADATA_BY_ID[skillId];
}
