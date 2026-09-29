import { type AgentSkillPackageDraftLibrary } from './agentSkillPackageDraftLibrary';
import { createAgentSkillPackageDraftReview } from './agentSkillPackageDraftReview';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';
import { type AgentSkillMarketplaceIdentityMetadataPreviewRow } from './agentSkillMarketplaceIdentityMetadataPreview';
import {
  createAgentSkillSignedPackageUpdatePreviewReport,
  type AgentSkillSignedPackageUpdatePreviewStatus,
} from './agentSkillSignedPackageUpdatePreview';

export type AgentSkillMarketplaceInstallReadinessStatus =
  | 'blocked'
  | 'install-ready-if-marketplace-enabled'
  | 'review-required';

export interface AgentSkillMarketplaceInstallReadinessRow {
  candidateDraftId: string;
  channelPolicy: 'local-draft-review';
  downloadAttempted: false;
  installAttempted: false;
  issueCodes: string[];
  marketplaceEnabled: false;
  registryMutated: false;
  reviewStatus: string;
  signatureStatus: string;
  skillId: string;
  sourceIdentity: 'local-draft' | 'marketplace-identity-missing';
  status: AgentSkillMarketplaceInstallReadinessStatus;
  updateStatus: AgentSkillSignedPackageUpdatePreviewStatus;
  versionPolicy: 'install-or-update-preview';
}

export interface AgentSkillMarketplaceInstallReadinessReport {
  rows: AgentSkillMarketplaceInstallReadinessRow[];
  summary: Record<AgentSkillMarketplaceInstallReadinessStatus, number> & {
    downloadAttempted: number;
    installAttempted: number;
    registryMutated: number;
    total: number;
  };
}

export interface AgentSkillMarketplaceInstallReadinessOptions {
  identityRows?: readonly AgentSkillMarketplaceIdentityMetadataPreviewRow[];
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSummary(rows: AgentSkillMarketplaceInstallReadinessRow[]) {
  const summary = {
    blocked: 0,
    downloadAttempted: 0,
    'install-ready-if-marketplace-enabled': 0,
    installAttempted: 0,
    registryMutated: 0,
    'review-required': 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function resolveStatus(issueCodes: readonly string[]): AgentSkillMarketplaceInstallReadinessStatus {
  if (issueCodes.some((code) => code.startsWith('blocked-')
    || code === 'candidate-older-than-installed'
    || code.startsWith('signature-')
    || code === 'package-signature-missing')) {
    return 'blocked';
  }
  if (issueCodes.length) {
    return 'review-required';
  }
  return 'install-ready-if-marketplace-enabled';
}

function createIdentityIssueCodes(identity?: AgentSkillMarketplaceIdentityMetadataPreviewRow) {
  if (!identity) {
    return ['marketplace-source-identity-missing'];
  }
  return identity.status === 'ready' ? [] : identity.issueCodes;
}

function createRowContext(
  library: AgentSkillPackageDraftLibrary,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillMarketplaceInstallReadinessOptions,
) {
  const updateReport = createAgentSkillSignedPackageUpdatePreviewReport(
    library,
    installedRegistry,
    { signatureVerifier: options.signatureVerifier },
  );
  return {
    identityByDraftId: new Map((options.identityRows ?? []).map((row) => [row.draftId, row])),
    updateByDraftId: new Map(updateReport.rows.map((row) => [row.candidateDraftId, row])),
  };
}

function createReadinessRow(
  library: AgentSkillPackageDraftLibrary,
  draft: AgentSkillPackageDraftLibrary['drafts'][number],
  context: ReturnType<typeof createRowContext>,
): AgentSkillMarketplaceInstallReadinessRow {
  const review = createAgentSkillPackageDraftReview(library, draft.id);
  const identity = context.identityByDraftId.get(draft.id);
  const update = context.updateByDraftId.get(draft.id);
  const issueCodes = unique([
    'marketplace-disabled',
    ...createIdentityIssueCodes(identity),
    ...(review?.issues.map((issue) => `${issue.severity}-${issue.code}`) ?? ['blocked-draft-review-missing']),
    ...(update?.issueCodes ?? ['blocked-update-preview-missing']),
  ]);
  return {
    candidateDraftId: draft.id,
    channelPolicy: 'local-draft-review',
    downloadAttempted: false,
    installAttempted: false,
    issueCodes,
    marketplaceEnabled: false,
    registryMutated: false,
    reviewStatus: review?.status ?? 'missing',
    signatureStatus: update?.signatureStatus ?? 'missing',
    skillId: draft.skillId,
    sourceIdentity: identity?.status === 'ready' ? 'local-draft' : 'marketplace-identity-missing',
    status: resolveStatus(issueCodes),
    updateStatus: update?.status ?? 'blocked',
    versionPolicy: 'install-or-update-preview',
  };
}

export function createAgentSkillMarketplaceInstallReadinessPreviewReport(
  library: AgentSkillPackageDraftLibrary,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillMarketplaceInstallReadinessOptions = {},
): AgentSkillMarketplaceInstallReadinessReport {
  const context = createRowContext(library, installedRegistry, options);
  const rows = library.drafts
    .filter((draft) => draft.enabled)
    .map((draft) => createReadinessRow(library, draft, context));
  return { rows, summary: createSummary(rows) };
}
