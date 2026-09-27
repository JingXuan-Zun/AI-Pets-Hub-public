import {
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
} from './agentSkillExternalSandboxIsolationEvidence';

export const AGENT_SKILL_EXTERNAL_SANDBOX_EVIDENCE_REGISTRY_KIND = 'agent-skill-external-sandbox-evidence-registry.v1';

export interface AgentSkillExternalSandboxEvidenceRecord {
  code: string;
  reviewedAt: string;
  reviewer: 'local-reviewer';
}

export interface AgentSkillExternalSandboxEvidenceRegistry {
  kind: typeof AGENT_SKILL_EXTERNAL_SANDBOX_EVIDENCE_REGISTRY_KIND;
  records: AgentSkillExternalSandboxEvidenceRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getAllowedEvidenceCodes() {
  return new Set<string>(getAgentSkillExternalSandboxRequiredEvidenceCodes());
}

function normalizeRecord(value: unknown): AgentSkillExternalSandboxEvidenceRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const code = getString(value.code);
  if (!getAllowedEvidenceCodes().has(code)) {
    return null;
  }
  return {
    code,
    reviewedAt: getString(value.reviewedAt) || new Date(0).toISOString(),
    reviewer: 'local-reviewer',
  };
}

export function createEmptyAgentSkillExternalSandboxEvidenceRegistry(): AgentSkillExternalSandboxEvidenceRegistry {
  return {
    kind: AGENT_SKILL_EXTERNAL_SANDBOX_EVIDENCE_REGISTRY_KIND,
    records: [],
  };
}

export function parseAgentSkillExternalSandboxEvidenceRegistryJson(
  rawText?: string | null,
): AgentSkillExternalSandboxEvidenceRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillExternalSandboxEvidenceRegistry();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const records = isRecord(parsed) && Array.isArray(parsed.records)
    ? parsed.records.map(normalizeRecord).filter((record): record is AgentSkillExternalSandboxEvidenceRecord => Boolean(record))
    : [];
  const uniqueRecords = [...new Map(records.map((record) => [record.code, record])).values()];
  return {
    kind: AGENT_SKILL_EXTERNAL_SANDBOX_EVIDENCE_REGISTRY_KIND,
    records: uniqueRecords,
  };
}

export function serializeAgentSkillExternalSandboxEvidenceRegistry(
  registry: AgentSkillExternalSandboxEvidenceRegistry,
) {
  return JSON.stringify({
    kind: AGENT_SKILL_EXTERNAL_SANDBOX_EVIDENCE_REGISTRY_KIND,
    records: registry.records,
  });
}

export function setAgentSkillExternalSandboxEvidenceCode(
  registry: AgentSkillExternalSandboxEvidenceRegistry,
  code: string,
  enabled: boolean,
  reviewedAt = new Date().toISOString(),
): AgentSkillExternalSandboxEvidenceRegistry {
  if (!getAllowedEvidenceCodes().has(code)) {
    return registry;
  }
  const records = enabled
    ? [{ code, reviewedAt, reviewer: 'local-reviewer' as const }, ...registry.records.filter((record) => record.code !== code)]
    : registry.records.filter((record) => record.code !== code);
  return {
    kind: AGENT_SKILL_EXTERNAL_SANDBOX_EVIDENCE_REGISTRY_KIND,
    records,
  };
}

export function getAgentSkillExternalSandboxEvidenceCodes(
  registry: AgentSkillExternalSandboxEvidenceRegistry,
) {
  const allowed = getAllowedEvidenceCodes();
  return registry.records.map((record) => record.code).filter((code) => allowed.has(code));
}
