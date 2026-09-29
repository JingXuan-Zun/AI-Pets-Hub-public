import { type AgentSkillPackageDraftLibrary } from './agentSkillPackageDraftLibrary';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';
import {
  createAgentSkillSignedPackageUpdateApplicationPreviewReport,
  type AgentSkillSignedPackageUpdateApplicationPreviewRow,
} from './agentSkillSignedPackageUpdateApplicationPreview';

export type AgentSkillSignedPackageUpdateRollbackPreviewStatus =
  | 'blocked'
  | 'not-needed'
  | 'rollback-ready-if-applied';

export interface AgentSkillSignedPackageUpdateRollbackPreviewRow {
  auditReceiptId: string | null;
  auditWritten: false;
  candidateDraftId: string;
  issueCodes: string[];
  registryMutated: false;
  rollbackAttempted: false;
  rollbackSnapshotId: string | null;
  rollbackSourcePackageId: string | null;
  skillId: string;
  status: AgentSkillSignedPackageUpdateRollbackPreviewStatus;
  updateAction: string;
}

export interface AgentSkillSignedPackageUpdateRollbackPreviewReport {
  rows: AgentSkillSignedPackageUpdateRollbackPreviewRow[];
  summary: Record<AgentSkillSignedPackageUpdateRollbackPreviewStatus, number> & {
    auditWritten: number;
    registryMutated: number;
    rollbackAttempted: number;
    total: number;
  };
}

export interface AgentSkillSignedPackageUpdateRollbackPreviewOptions {
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}

function createAuditReceiptId(row: AgentSkillSignedPackageUpdateApplicationPreviewRow) {
  if (!row.rollbackSnapshotId) {
    return null;
  }
  return `${row.rollbackSnapshotId}:audit-preview`;
}

function createSummary(rows: AgentSkillSignedPackageUpdateRollbackPreviewRow[]) {
  const summary = {
    auditWritten: 0,
    blocked: 0,
    'not-needed': 0,
    registryMutated: 0,
    'rollback-ready-if-applied': 0,
    rollbackAttempted: 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function resolveStatus(
  row: AgentSkillSignedPackageUpdateApplicationPreviewRow,
): AgentSkillSignedPackageUpdateRollbackPreviewStatus {
  if (row.status === 'replace-planned' && row.rollbackSnapshotId) {
    return 'rollback-ready-if-applied';
  }
  return row.status === 'blocked' ? 'blocked' : 'not-needed';
}

function createRow(
  row: AgentSkillSignedPackageUpdateApplicationPreviewRow,
): AgentSkillSignedPackageUpdateRollbackPreviewRow {
  const status = resolveStatus(row);
  return {
    auditReceiptId: status === 'rollback-ready-if-applied' ? createAuditReceiptId(row) : null,
    auditWritten: false,
    candidateDraftId: row.candidateDraftId,
    issueCodes: row.issueCodes,
    registryMutated: false,
    rollbackAttempted: false,
    rollbackSnapshotId: status === 'rollback-ready-if-applied' ? row.rollbackSnapshotId : null,
    rollbackSourcePackageId: status === 'rollback-ready-if-applied' ? row.rollbackSourcePackageId : null,
    skillId: row.skillId,
    status,
    updateAction: row.plannedAction,
  };
}

export function createAgentSkillSignedPackageUpdateRollbackPreviewReport(
  library: AgentSkillPackageDraftLibrary,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillSignedPackageUpdateRollbackPreviewOptions = {},
): AgentSkillSignedPackageUpdateRollbackPreviewReport {
  const applicationReport = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
    library,
    installedRegistry,
    { signatureVerifier: options.signatureVerifier },
  );
  const rows = applicationReport.rows.map(createRow);
  return { rows, summary: createSummary(rows) };
}
