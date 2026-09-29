import { createAgentSkillManifest, type AgentSkillManifestEntry } from './agentSkillManifest';
import { type PetConfig } from '../types';

export type AgentSkillInstallValidationStatus = 'blocked' | 'ready' | 'unknown' | 'warning';

export interface AgentSkillInstallValidationCheck {
  detail: string;
  key: string;
  optional: boolean;
  source: 'asset' | 'route' | 'runtime';
  status: AgentSkillInstallValidationStatus;
}

export interface AgentSkillInstallValidation {
  checks: AgentSkillInstallValidationCheck[];
  skillId: string;
  status: AgentSkillInstallValidationStatus;
  summary: string;
}

export interface AgentSkillInstallValidationReport {
  summary: Record<AgentSkillInstallValidationStatus, number> & { total: number };
  validations: AgentSkillInstallValidation[];
}

export interface AgentSkillInstallValidationOptions {
  config: PetConfig;
  mcpConfig?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasMotionBindings(config: PetConfig) {
  return config.customModelPresets.some((preset) => (preset.motionBindings ?? []).length > 0);
}

function hasMusicAssets(config: PetConfig) {
  return (config.musicAssets ?? []).length > 0;
}

function hasLocalVoiceModel(config: PetConfig) {
  return Boolean(config.settings.localTtsModelId || config.settings.localSttModelId);
}

function getMcpServerCount(mcpConfig: unknown) {
  if (!isRecord(mcpConfig)) {
    return null;
  }

  const servers = Array.isArray(mcpConfig.servers)
    ? mcpConfig.servers
    : Array.isArray(mcpConfig.mcpServers)
      ? mcpConfig.mcpServers
      : null;
  return servers?.filter(isRecord).length ?? 0;
}

function createCheck(
  key: string,
  source: AgentSkillInstallValidationCheck['source'],
  status: AgentSkillInstallValidationStatus,
  detail: string,
) {
  return {
    detail,
    key,
    optional: key.startsWith('optional:'),
    source,
    status,
  };
}

function validateAssetRequirement(key: string, options: AgentSkillInstallValidationOptions) {
  const normalizedKey = key.replace(/^optional:/u, '');
  if (normalizedKey === 'motionBindings') {
    return hasMotionBindings(options.config)
      ? createCheck(key, 'asset', 'ready', 'At least one custom model motion binding is available.')
      : createCheck(key, 'asset', 'blocked', 'No custom model motion bindings are configured.');
  }

  if (normalizedKey === 'musicAssets') {
    return hasMusicAssets(options.config)
      ? createCheck(key, 'asset', 'ready', 'At least one music asset is registered.')
      : createCheck(key, 'asset', 'warning', 'No music assets are registered; audio-linked timelines may need manual URLs.');
  }

  if (normalizedKey === 'local-voice-model') {
    return hasLocalVoiceModel(options.config)
      ? createCheck(key, 'asset', 'ready', 'A local TTS or STT model is selected.')
      : createCheck(key, 'asset', 'warning', 'Local voice models are only needed when local voice providers are selected.');
  }

  if (normalizedKey === 'mcp-server-config') {
    const count = getMcpServerCount(options.mcpConfig);
    if (count === null) {
      return createCheck(key, 'asset', 'unknown', 'MCP config was not provided to this validation run.');
    }
    return count > 0
      ? createCheck(key, 'asset', 'ready', `${count} MCP server config(s) detected.`)
      : createCheck(key, 'asset', 'blocked', 'No external MCP servers are configured.');
  }

  return createCheck(key, 'asset', 'ready', 'Requirement is satisfied by user-provided input or platform runtime.');
}

function validateRuntimeRequirement(key: string, options: AgentSkillInstallValidationOptions) {
  if (key === 'mcp-config') {
    const count = getMcpServerCount(options.mcpConfig);
    if (count === null) {
      return createCheck(key, 'runtime', 'unknown', 'MCP config was not provided to this validation run.');
    }
    return count > 0
      ? createCheck(key, 'runtime', 'ready', `${count} MCP server config(s) detected.`)
      : createCheck(key, 'runtime', 'blocked', 'No external MCP servers are configured.');
  }

  if (key === 'tts-provider') {
    return createCheck(key, 'runtime', 'ready', `TTS provider is ${options.config.settings.ttsProvider}.`);
  }

  if (key === 'stt-provider') {
    return createCheck(key, 'runtime', 'ready', `STT provider is ${options.config.settings.sttProvider}.`);
  }

  return createCheck(key, 'runtime', 'ready', 'Runtime requirement is provided by the bundled platform.');
}

function createRouteChecks(entry: AgentSkillManifestEntry) {
  return entry.preferredToolRoutes.map((route) => (
    createCheck(
      route.name,
      'route',
      route.available ? 'ready' : 'blocked',
      route.available ? 'Preferred Agent tool is registered.' : 'Preferred Agent tool is missing.',
    )
  ));
}

function resolveValidationStatus(checks: AgentSkillInstallValidationCheck[]) {
  if (checks.some((check) => check.status === 'blocked' && !check.optional)) {
    return 'blocked';
  }
  if (checks.some((check) => check.status === 'unknown')) {
    return 'unknown';
  }
  if (checks.some((check) => check.status === 'warning' || check.status === 'blocked')) {
    return 'warning';
  }
  return 'ready';
}

function createValidationSummary(checks: AgentSkillInstallValidationCheck[]) {
  const status = resolveValidationStatus(checks);
  const blocked = checks.filter((check) => check.status === 'blocked').length;
  const warning = checks.filter((check) => check.status === 'warning').length;
  const unknown = checks.filter((check) => check.status === 'unknown').length;
  return `${status}: ${blocked} blocked, ${warning} warning, ${unknown} unknown`;
}

export function validateAgentSkillInstall(
  entry: AgentSkillManifestEntry,
  options: AgentSkillInstallValidationOptions,
): AgentSkillInstallValidation {
  const checks = [
    ...createRouteChecks(entry),
    ...entry.package.assetRequirements.map((key) => validateAssetRequirement(key, options)),
    ...entry.package.runtimeRequirements.map((key) => validateRuntimeRequirement(key, options)),
  ];

  return {
    checks,
    skillId: entry.id,
    status: resolveValidationStatus(checks),
    summary: createValidationSummary(checks),
  };
}

export function createAgentSkillInstallValidationReport(
  options: AgentSkillInstallValidationOptions,
): AgentSkillInstallValidationReport {
  const validations = createAgentSkillManifest().entries.map((entry) => validateAgentSkillInstall(entry, options));
  const summary = { blocked: 0, ready: 0, total: validations.length, unknown: 0, warning: 0 };
  validations.forEach((validation) => {
    summary[validation.status] += 1;
  });

  return { summary, validations };
}
