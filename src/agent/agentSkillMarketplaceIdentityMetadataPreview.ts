import { type AgentSkillPackageDraftLibrary } from './agentSkillPackageDraftLibrary';

export const AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND = 'agent-skill-marketplace-identity-metadata.v1';

export type AgentSkillMarketplaceIdentityChannel = 'beta' | 'local-review' | 'stable';
export type AgentSkillMarketplaceIdentityPreviewStatus = 'blocked' | 'ready' | 'warning';

export interface AgentSkillMarketplaceIdentityMetadataRecord {
  channel: AgentSkillMarketplaceIdentityChannel;
  draftId: string;
  packageVersion: string;
  publisherId: string;
  reviewedAt: string;
  reviewer: string;
  skillId: string;
  sourceId: string;
}

export interface AgentSkillMarketplaceIdentityMetadataPreviewRow {
  downloadAttempted: false;
  draftId: string;
  issueCodes: string[];
  packageVersion: string;
  registryMutated: false;
  skillId: string;
  sourceId: string;
  status: AgentSkillMarketplaceIdentityPreviewStatus;
}

export interface AgentSkillMarketplaceIdentityMetadataPreviewReport {
  kind: typeof AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND | string;
  parseError: string | null;
  rows: AgentSkillMarketplaceIdentityMetadataPreviewRow[];
  summary: Record<AgentSkillMarketplaceIdentityPreviewStatus, number> & {
    downloadAttempted: number;
    registryMutated: number;
    total: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChannel(value: unknown): AgentSkillMarketplaceIdentityChannel | '' {
  const channel = getString(value);
  return channel === 'stable' || channel === 'beta' || channel === 'local-review' ? channel : '';
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSummary(rows: AgentSkillMarketplaceIdentityMetadataPreviewRow[]) {
  const summary = { blocked: 0, downloadAttempted: 0, ready: 0, registryMutated: 0, total: rows.length, warning: 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function resolveStatus(issueCodes: readonly string[]): AgentSkillMarketplaceIdentityPreviewStatus {
  if (issueCodes.some((code) => code.startsWith('blocked-'))) {
    return 'blocked';
  }
  return issueCodes.length ? 'warning' : 'ready';
}

function normalizeRecord(value: unknown): AgentSkillMarketplaceIdentityMetadataRecord {
  const record = isRecord(value) ? value : {};
  return {
    channel: normalizeChannel(record.channel) || 'local-review',
    draftId: getString(record.draftId),
    packageVersion: getString(record.packageVersion),
    publisherId: getString(record.publisherId),
    reviewedAt: getString(record.reviewedAt),
    reviewer: getString(record.reviewer),
    skillId: getString(record.skillId),
    sourceId: getString(record.sourceId),
  };
}

function createIssueCodes(
  library: AgentSkillPackageDraftLibrary,
  record: AgentSkillMarketplaceIdentityMetadataRecord,
  rawValue: unknown,
) {
  const draft = library.drafts.find((item) => item.id === record.draftId) ?? null;
  return unique([
    isRecord(rawValue) ? '' : 'blocked-record-invalid',
    record.draftId ? '' : 'blocked-draft-id-missing',
    draft ? '' : 'blocked-draft-not-found',
    record.skillId ? '' : 'blocked-skill-id-missing',
    draft && record.skillId && draft.skillId !== record.skillId ? 'blocked-skill-id-mismatch' : '',
    record.sourceId ? '' : 'blocked-source-id-missing',
    record.publisherId ? '' : 'blocked-publisher-id-missing',
    record.packageVersion ? '' : 'blocked-package-version-missing',
    draft && record.packageVersion !== draft.package.scaffold.package.version ? 'blocked-package-version-mismatch' : '',
    record.reviewer ? '' : 'reviewer-missing',
    record.reviewedAt ? '' : 'reviewed-at-missing',
  ]);
}

function createRow(
  library: AgentSkillPackageDraftLibrary,
  rawValue: unknown,
): AgentSkillMarketplaceIdentityMetadataPreviewRow {
  const record = normalizeRecord(rawValue);
  const issueCodes = createIssueCodes(library, record, rawValue);
  return {
    downloadAttempted: false,
    draftId: record.draftId,
    issueCodes,
    packageVersion: record.packageVersion,
    registryMutated: false,
    skillId: record.skillId,
    sourceId: record.sourceId,
    status: resolveStatus(issueCodes),
  };
}

function createEmptyReport(parseError: string | null, kind = AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND) {
  return { kind, parseError, rows: [], summary: createSummary([]) };
}

function createParsedReport(
  parsed: unknown,
  library: AgentSkillPackageDraftLibrary,
): AgentSkillMarketplaceIdentityMetadataPreviewReport {
  const kind = isRecord(parsed) ? getString(parsed.kind) : '';
  const records = isRecord(parsed) && Array.isArray(parsed.records) ? parsed.records : [];
  if (kind !== AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND) {
    return createEmptyReport('Input is not marketplace identity metadata.', kind);
  }
  const rows = records.map((record) => createRow(library, record));
  return { kind, parseError: null, rows, summary: createSummary(rows) };
}

export function createAgentSkillMarketplaceIdentityMetadataPreviewReport(
  rawText: string,
  library: AgentSkillPackageDraftLibrary,
): AgentSkillMarketplaceIdentityMetadataPreviewReport {
  if (!rawText.trim()) {
    return createEmptyReport(null);
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return createParsedReport(parsed, library);
  } catch (error) {
    return createEmptyReport(error instanceof Error ? error.message : 'Invalid marketplace identity metadata JSON.', '');
  }
}
