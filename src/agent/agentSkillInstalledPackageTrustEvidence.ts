import { type AgentSkillInstalledPackageRegistry, type AgentSkillInstalledPackage } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';

export const AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND = 'agent-skill-trust-evidence-registry.v1';
const MAX_AGENT_SKILL_TRUST_EVIDENCE_RECORDS = 24;

export type AgentSkillTrustEvidenceStatus = 'missing' | 'stale' | 'valid';

export interface AgentSkillTrustEvidenceRecord {
  evidenceId: string;
  note: string;
  packageFingerprint: string;
  packageId: string;
  reviewedAt: string;
  reviewer: string;
  skillId: string;
  source: 'manual-review';
}

export interface AgentSkillTrustEvidenceRegistry {
  kind: typeof AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND;
  records: AgentSkillTrustEvidenceRecord[];
}

export interface AgentSkillTrustEvidenceRow {
  evidence: AgentSkillTrustEvidenceRecord | null;
  issueCodes: string[];
  packageId: string;
  skillId: string;
  status: AgentSkillTrustEvidenceStatus;
}

export interface AgentSkillTrustEvidenceReport {
  rows: AgentSkillTrustEvidenceRow[];
  summary: Record<AgentSkillTrustEvidenceStatus, number> & { total: number };
}

export interface AgentSkillTrustEvidenceResult {
  error: string | null;
  registry: AgentSkillTrustEvidenceRegistry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createEvidenceId(packageId: string, reviewedAt: string) {
  return `${packageId}:trust:${reviewedAt}`;
}

function createPackageFingerprint(item: AgentSkillInstalledPackage) {
  const packageMetadata = item.package.scaffold.package;
  return [
    item.package.kind,
    item.skillId,
    packageMetadata.version,
    packageMetadata.runtime,
    item.package.exportedAt,
    item.sourceDraftId,
  ].join('|');
}

function normalizeEvidence(value: unknown): AgentSkillTrustEvidenceRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const packageId = getString(value.packageId);
  const skillId = getString(value.skillId);
  const packageFingerprint = getString(value.packageFingerprint);
  if (!packageId || !skillId || !packageFingerprint) {
    return null;
  }
  const reviewedAt = getString(value.reviewedAt) || new Date(0).toISOString();
  return {
    evidenceId: getString(value.evidenceId) || createEvidenceId(packageId, reviewedAt),
    note: getString(value.note),
    packageFingerprint,
    packageId,
    reviewedAt,
    reviewer: getString(value.reviewer) || 'local-reviewer',
    skillId,
    source: 'manual-review',
  };
}

function findInstalledPackage(registry: AgentSkillInstalledPackageRegistry, packageId: string) {
  return registry.packages.find((item) => item.id === packageId) ?? null;
}

function resolveEvidenceStatus(
  installedPackage: AgentSkillInstalledPackage,
  evidence: AgentSkillTrustEvidenceRecord | null,
) {
  if (!evidence) {
    return { issueCodes: ['trust-evidence-missing'], status: 'missing' as const };
  }
  if (evidence.skillId !== installedPackage.skillId || evidence.packageFingerprint !== createPackageFingerprint(installedPackage)) {
    return { issueCodes: ['trust-evidence-stale'], status: 'stale' as const };
  }
  return { issueCodes: [], status: 'valid' as const };
}

function createSummary(rows: AgentSkillTrustEvidenceRow[]) {
  const summary = { missing: 0, stale: 0, total: rows.length, valid: 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function createEmptyAgentSkillTrustEvidenceRegistry(): AgentSkillTrustEvidenceRegistry {
  return {
    kind: AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND,
    records: [],
  };
}

export function parseAgentSkillTrustEvidenceRegistryJson(
  rawText?: string | null,
): AgentSkillTrustEvidenceRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillTrustEvidenceRegistry();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const records = isRecord(parsed) && Array.isArray(parsed.records)
    ? parsed.records
      .map(normalizeEvidence)
      .filter((record): record is AgentSkillTrustEvidenceRecord => Boolean(record))
    : [];
  return {
    kind: AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND,
    records: records.slice(0, MAX_AGENT_SKILL_TRUST_EVIDENCE_RECORDS),
  };
}

export function serializeAgentSkillTrustEvidenceRegistry(registry: AgentSkillTrustEvidenceRegistry) {
  return JSON.stringify({
    kind: AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND,
    records: registry.records.slice(0, MAX_AGENT_SKILL_TRUST_EVIDENCE_RECORDS),
  });
}

export function createAgentSkillTrustEvidence(
  registry: AgentSkillTrustEvidenceRegistry,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  packageId: string,
  reviewedAt = new Date().toISOString(),
): AgentSkillTrustEvidenceResult {
  const installedPackage = findInstalledPackage(installedRegistry, packageId);
  if (!installedPackage) {
    return { error: 'Installed package record was not found.', registry };
  }
  const evidence = {
    evidenceId: createEvidenceId(packageId, reviewedAt),
    note: 'Local manual review evidence for runtime trust.',
    packageFingerprint: createPackageFingerprint(installedPackage),
    packageId,
    reviewedAt,
    reviewer: 'local-reviewer',
    skillId: installedPackage.skillId,
    source: 'manual-review',
  } satisfies AgentSkillTrustEvidenceRecord;
  return {
    error: null,
    registry: {
      kind: AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND,
      records: [
        evidence,
        ...registry.records.filter((record) => record.packageId !== packageId),
      ].slice(0, MAX_AGENT_SKILL_TRUST_EVIDENCE_RECORDS),
    },
  };
}

export function removeAgentSkillTrustEvidence(
  registry: AgentSkillTrustEvidenceRegistry,
  packageId: string,
): AgentSkillTrustEvidenceRegistry {
  return {
    kind: AGENT_SKILL_TRUST_EVIDENCE_REGISTRY_KIND,
    records: registry.records.filter((record) => record.packageId !== packageId),
  };
}

export function createAgentSkillTrustEvidenceReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  registry: AgentSkillTrustEvidenceRegistry,
): AgentSkillTrustEvidenceReport {
  const evidenceByPackageId = new Map(registry.records.map((record) => [record.packageId, record]));
  const rows = installedRegistry.packages.map((item): AgentSkillTrustEvidenceRow => {
    const evidence = evidenceByPackageId.get(item.id) ?? null;
    const status = resolveEvidenceStatus(item, evidence);
    return {
      evidence,
      issueCodes: status.issueCodes,
      packageId: item.id,
      skillId: item.skillId,
      status: status.status,
    };
  });
  return { rows, summary: createSummary(rows) };
}

export function createAgentSkillEffectiveTrustedPackageIds(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
) {
  const report = createAgentSkillTrustEvidenceReport(installedRegistry, evidenceRegistry);
  const validEvidenceIds = new Set(report.rows.filter((row) => row.status === 'valid').map((row) => row.packageId));
  return policy.records
    .filter((record) => record.trusted && validEvidenceIds.has(record.packageId))
    .map((record) => record.packageId);
}
