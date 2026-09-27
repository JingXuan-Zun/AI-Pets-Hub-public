import { type AgentSkillPackageDraft, type AgentSkillPackageDraftLibrary } from './agentSkillPackageDraftLibrary';
import {
  type AgentSkillInstalledPackage,
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';
import {
  createAgentSkillPackageSignatureVerificationReport,
  type AgentSkillPackageSignatureStatus,
} from './agentSkillPackageSignatureVerification';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';

export type AgentSkillSignedPackageUpdatePreviewStatus =
  | 'blocked'
  | 'install-ready'
  | 'unchanged'
  | 'update-ready';

export interface AgentSkillSignedPackageUpdatePreviewRow {
  candidateDraftId: string;
  candidateExportedAt: string;
  candidateVersion: string;
  installedExportedAt: string | null;
  installedPackageId: string | null;
  installedVersion: string | null;
  issueCodes: string[];
  packageId: string;
  signatureIssueCodes: string[];
  signatureStatus: AgentSkillPackageSignatureStatus;
  skillId: string;
  status: AgentSkillSignedPackageUpdatePreviewStatus;
}

export interface AgentSkillSignedPackageUpdatePreviewReport {
  rows: AgentSkillSignedPackageUpdatePreviewRow[];
  summary: Record<AgentSkillSignedPackageUpdatePreviewStatus, number> & { total: number };
}

export interface AgentSkillSignedPackageUpdatePreviewOptions {
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}

function compareVersionLike(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index]! : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index]! : 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }
  return left.localeCompare(right);
}

function comparePackageFreshness(candidate: AgentSkillPackageDraft, installed: AgentSkillInstalledPackage | null) {
  if (!installed) {
    return 1;
  }
  const versionCompare = compareVersionLike(
    candidate.package.scaffold.package.version,
    installed.package.scaffold.package.version,
  );
  if (versionCompare !== 0) {
    return versionCompare;
  }
  return candidate.package.exportedAt.localeCompare(installed.package.exportedAt);
}

function createSignatureIssueCodes(status: AgentSkillPackageSignatureStatus, issueCodes: string[]) {
  if (status === 'verified') {
    return [];
  }
  return [
    status === 'unsigned' ? 'package-signature-missing' : `signature-${status}`,
    ...issueCodes,
  ];
}

function resolveStatus(options: {
  freshness: number;
  installed: AgentSkillInstalledPackage | null;
  signatureIssues: readonly string[];
}): AgentSkillSignedPackageUpdatePreviewStatus {
  if (options.signatureIssues.length || options.freshness < 0) {
    return 'blocked';
  }
  if (!options.installed) {
    return 'install-ready';
  }
  if (options.freshness === 0) {
    return 'unchanged';
  }
  return 'update-ready';
}

function createSummary(rows: AgentSkillSignedPackageUpdatePreviewRow[]) {
  const summary = { blocked: 0, 'install-ready': 0, total: rows.length, unchanged: 0, 'update-ready': 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function createCandidateRegistry(drafts: readonly AgentSkillPackageDraft[]) {
  return {
    kind: 'agent-skill-installed-package-registry.v1' as const,
    packages: drafts.map((draft) => ({
      id: draft.id,
      installedAt: draft.savedAt,
      package: draft.package,
      runtimeEnabled: false as const,
      skillId: draft.skillId,
      sourceDraftId: draft.id,
    })),
  };
}

export function createAgentSkillSignedPackageUpdatePreviewReport(
  library: AgentSkillPackageDraftLibrary,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillSignedPackageUpdatePreviewOptions = {},
): AgentSkillSignedPackageUpdatePreviewReport {
  const enabledDrafts = library.drafts.filter((draft) => draft.enabled);
  const signatureReport = createAgentSkillPackageSignatureVerificationReport(
    createCandidateRegistry(enabledDrafts),
    { verifier: options.signatureVerifier },
  );
  const signatureByDraftId = new Map(signatureReport.rows.map((row) => [row.packageId, row]));
  const installedBySkillId = new Map(installedRegistry.packages.map((item) => [item.skillId, item]));
  const rows = enabledDrafts.map((draft): AgentSkillSignedPackageUpdatePreviewRow => {
    const installed = installedBySkillId.get(draft.skillId) ?? null;
    const signature = signatureByDraftId.get(draft.id);
    const signatureIssueCodes = createSignatureIssueCodes(
      signature?.status ?? 'blocked',
      signature?.issueCodes ?? ['signature-report-missing'],
    );
    const freshness = comparePackageFreshness(draft, installed);
    const status = resolveStatus({ freshness, installed, signatureIssues: signatureIssueCodes });
    const issueCodes = [
      ...signatureIssueCodes,
      freshness < 0 ? 'candidate-older-than-installed' : '',
    ].filter(Boolean);
    return {
      candidateDraftId: draft.id,
      candidateExportedAt: draft.package.exportedAt,
      candidateVersion: draft.package.scaffold.package.version,
      installedExportedAt: installed?.package.exportedAt ?? null,
      installedPackageId: installed?.id ?? null,
      installedVersion: installed?.package.scaffold.package.version ?? null,
      issueCodes,
      packageId: draft.id,
      signatureIssueCodes,
      signatureStatus: signature?.status ?? 'blocked',
      skillId: draft.skillId,
      status,
    };
  });
  return { rows, summary: createSummary(rows) };
}
