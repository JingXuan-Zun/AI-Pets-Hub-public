import { type AgentSkillPackageDraftLibrary } from './agentSkillPackageDraftLibrary';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';
import {
  createAgentSkillSignedPackageUpdatePreviewReport,
  type AgentSkillSignedPackageUpdatePreviewRow,
  type AgentSkillSignedPackageUpdatePreviewStatus,
} from './agentSkillSignedPackageUpdatePreview';

export type AgentSkillSignedPackageUpdateApplicationPreviewStatus =
  | 'blocked'
  | 'install-planned'
  | 'replace-planned'
  | 'unchanged';

export interface AgentSkillSignedPackageUpdateApplicationPreviewRow {
  applicationAttempted: false;
  applicationState: 'disabled-preview-only';
  candidateDraftId: string;
  candidateVersion: string;
  issueCodes: string[];
  plannedAction: 'blocked' | 'install' | 'none' | 'replace';
  registryMutated: false;
  rollbackSnapshotId: string | null;
  rollbackSourcePackageId: string | null;
  skillId: string;
  status: AgentSkillSignedPackageUpdateApplicationPreviewStatus;
  targetInstalledPackageId: string | null;
  updateStatus: AgentSkillSignedPackageUpdatePreviewStatus;
}

export interface AgentSkillSignedPackageUpdateApplicationPreviewReport {
  rows: AgentSkillSignedPackageUpdateApplicationPreviewRow[];
  summary: Record<AgentSkillSignedPackageUpdateApplicationPreviewStatus, number> & {
    applicationAttempted: number;
    registryMutated: number;
    total: number;
  };
}

export interface AgentSkillSignedPackageUpdateApplicationPreviewOptions {
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}

function createRollbackSnapshotId(row: AgentSkillSignedPackageUpdatePreviewRow) {
  if (!row.installedPackageId || !row.installedExportedAt) {
    return null;
  }
  return `${row.installedPackageId}:rollback:${row.installedExportedAt}`;
}

function createSummary(rows: AgentSkillSignedPackageUpdateApplicationPreviewRow[]) {
  const summary = {
    applicationAttempted: 0,
    blocked: 0,
    'install-planned': 0,
    registryMutated: 0,
    'replace-planned': 0,
    total: rows.length,
    unchanged: 0,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function resolvePlan(row: AgentSkillSignedPackageUpdatePreviewRow) {
  if (row.status === 'install-ready') {
    return { plannedAction: 'install' as const, status: 'install-planned' as const };
  }
  if (row.status === 'update-ready') {
    return { plannedAction: 'replace' as const, status: 'replace-planned' as const };
  }
  if (row.status === 'unchanged') {
    return { plannedAction: 'none' as const, status: 'unchanged' as const };
  }
  return { plannedAction: 'blocked' as const, status: 'blocked' as const };
}

function createRow(
  row: AgentSkillSignedPackageUpdatePreviewRow,
): AgentSkillSignedPackageUpdateApplicationPreviewRow {
  const plan = resolvePlan(row);
  return {
    applicationAttempted: false,
    applicationState: 'disabled-preview-only',
    candidateDraftId: row.candidateDraftId,
    candidateVersion: row.candidateVersion,
    issueCodes: row.issueCodes,
    plannedAction: plan.plannedAction,
    registryMutated: false,
    rollbackSnapshotId: plan.plannedAction === 'replace' ? createRollbackSnapshotId(row) : null,
    rollbackSourcePackageId: plan.plannedAction === 'replace' ? row.installedPackageId : null,
    skillId: row.skillId,
    status: plan.status,
    targetInstalledPackageId: row.installedPackageId,
    updateStatus: row.status,
  };
}

export function createAgentSkillSignedPackageUpdateApplicationPreviewReport(
  library: AgentSkillPackageDraftLibrary,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillSignedPackageUpdateApplicationPreviewOptions = {},
): AgentSkillSignedPackageUpdateApplicationPreviewReport {
  const updateReport = createAgentSkillSignedPackageUpdatePreviewReport(
    library,
    installedRegistry,
    { signatureVerifier: options.signatureVerifier },
  );
  const rows = updateReport.rows.map(createRow);
  return { rows, summary: createSummary(rows) };
}
