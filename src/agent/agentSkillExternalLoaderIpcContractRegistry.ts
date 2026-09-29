import {
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
} from './agentSkillExternalLoaderIpcContractPreview';

export const AGENT_SKILL_EXTERNAL_LOADER_IPC_CONTRACT_REGISTRY_KIND = 'agent-skill-external-loader-ipc-contract-registry.v1';

export interface AgentSkillExternalLoaderIpcContractRecord {
  code: string;
  reviewedAt: string;
  reviewer: 'local-reviewer';
}

export interface AgentSkillExternalLoaderIpcContractRegistry {
  kind: typeof AGENT_SKILL_EXTERNAL_LOADER_IPC_CONTRACT_REGISTRY_KIND;
  records: AgentSkillExternalLoaderIpcContractRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getAllowedCodes() {
  return new Set<string>(getAgentSkillExternalLoaderRequiredIpcContractCodes());
}

function normalizeRecord(value: unknown): AgentSkillExternalLoaderIpcContractRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const code = getString(value.code);
  if (!getAllowedCodes().has(code)) {
    return null;
  }
  return {
    code,
    reviewedAt: getString(value.reviewedAt) || new Date(0).toISOString(),
    reviewer: 'local-reviewer',
  };
}

export function createEmptyAgentSkillExternalLoaderIpcContractRegistry(): AgentSkillExternalLoaderIpcContractRegistry {
  return {
    kind: AGENT_SKILL_EXTERNAL_LOADER_IPC_CONTRACT_REGISTRY_KIND,
    records: [],
  };
}

export function parseAgentSkillExternalLoaderIpcContractRegistryJson(
  rawText?: string | null,
): AgentSkillExternalLoaderIpcContractRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillExternalLoaderIpcContractRegistry();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const records = isRecord(parsed) && Array.isArray(parsed.records)
    ? parsed.records.map(normalizeRecord).filter((record): record is AgentSkillExternalLoaderIpcContractRecord => Boolean(record))
    : [];
  return {
    kind: AGENT_SKILL_EXTERNAL_LOADER_IPC_CONTRACT_REGISTRY_KIND,
    records: [...new Map(records.map((record) => [record.code, record])).values()],
  };
}

export function serializeAgentSkillExternalLoaderIpcContractRegistry(
  registry: AgentSkillExternalLoaderIpcContractRegistry,
) {
  return JSON.stringify({
    kind: AGENT_SKILL_EXTERNAL_LOADER_IPC_CONTRACT_REGISTRY_KIND,
    records: registry.records,
  });
}

export function setAgentSkillExternalLoaderIpcContractCode(
  registry: AgentSkillExternalLoaderIpcContractRegistry,
  code: string,
  enabled: boolean,
  reviewedAt = new Date().toISOString(),
): AgentSkillExternalLoaderIpcContractRegistry {
  if (!getAllowedCodes().has(code)) {
    return registry;
  }
  const records = enabled
    ? [{ code, reviewedAt, reviewer: 'local-reviewer' as const }, ...registry.records.filter((record) => record.code !== code)]
    : registry.records.filter((record) => record.code !== code);
  return {
    kind: AGENT_SKILL_EXTERNAL_LOADER_IPC_CONTRACT_REGISTRY_KIND,
    records,
  };
}

export function getAgentSkillExternalLoaderIpcContractCodes(
  registry: AgentSkillExternalLoaderIpcContractRegistry,
) {
  const allowed = getAllowedCodes();
  return registry.records.map((record) => record.code).filter((code) => allowed.has(code));
}
