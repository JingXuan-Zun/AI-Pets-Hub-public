import {
  createAgentSkillExternalPackageLoaderBoundaryReport,
  type AgentSkillExternalPackageLoaderBoundaryOptions,
} from './agentSkillExternalPackageLoaderBoundary';
import {
  type AgentSkillInstalledPackageRuntimePolicy,
} from './agentSkillInstalledPackageRuntimePolicy';
import {
  type AgentSkillTrustEvidenceRegistry,
} from './agentSkillInstalledPackageTrustEvidence';
import {
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalSandboxIsolationStatus = 'blocked' | 'isolated-if-loader-enabled';

export interface AgentSkillExternalSandboxIsolationRow {
  boundaryReadiness: string;
  evidenceCodes: string[];
  issueCodes: string[];
  loaderState: 'disabled';
  packageId: string;
  requiredEvidenceCodes: string[];
  skillId: string;
  status: AgentSkillExternalSandboxIsolationStatus;
}

export interface AgentSkillExternalSandboxIsolationReport {
  rows: AgentSkillExternalSandboxIsolationRow[];
  summary: Record<AgentSkillExternalSandboxIsolationStatus, number> & {
    disabled: number;
    total: number;
  };
}

export interface AgentSkillExternalSandboxIsolationOptions
  extends AgentSkillExternalPackageLoaderBoundaryOptions {
  evidenceCodes?: readonly string[];
}

const REQUIRED_EVIDENCE_CODES = [
  'sandbox-process-isolation',
  'sandbox-readonly-package-fs',
  'sandbox-no-node-integration',
  'sandbox-permission-ipc',
  'sandbox-receipt-redaction',
] as const;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createMissingEvidenceCodes(evidenceCodes: readonly string[]) {
  const evidence = new Set(evidenceCodes);
  return REQUIRED_EVIDENCE_CODES
    .filter((code) => !evidence.has(code))
    .map((code) => `missing-${code}`);
}

function resolveStatus(issueCodes: readonly string[]): AgentSkillExternalSandboxIsolationStatus {
  return issueCodes.length ? 'blocked' : 'isolated-if-loader-enabled';
}

function createSummary(rows: AgentSkillExternalSandboxIsolationRow[]) {
  const summary = { blocked: 0, disabled: rows.length, 'isolated-if-loader-enabled': 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function getAgentSkillExternalSandboxRequiredEvidenceCodes() {
  return [...REQUIRED_EVIDENCE_CODES];
}

export function createAgentSkillExternalSandboxIsolationReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalSandboxIsolationOptions = {},
): AgentSkillExternalSandboxIsolationReport {
  const boundaryReport = createAgentSkillExternalPackageLoaderBoundaryReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    options,
  );
  const boundaryByPackageId = new Map(boundaryReport.rows.map((row) => [row.packageId, row]));
  const missingEvidenceCodes = createMissingEvidenceCodes(options.evidenceCodes ?? []);
  const rows = installedRegistry.packages.map((item): AgentSkillExternalSandboxIsolationRow => {
    const boundary = boundaryByPackageId.get(item.id);
    const issueCodes = unique([
      ...(boundary?.blockingIssueCodes ?? ['external-loader-boundary-missing']),
      ...missingEvidenceCodes,
    ]);
    return {
      boundaryReadiness: boundary?.readinessStatus ?? 'missing',
      evidenceCodes: [...(options.evidenceCodes ?? [])],
      issueCodes,
      loaderState: 'disabled',
      packageId: item.id,
      requiredEvidenceCodes: getAgentSkillExternalSandboxRequiredEvidenceCodes(),
      skillId: item.skillId,
      status: resolveStatus(issueCodes.filter((code) => code !== 'external-package-loader-disabled')),
    };
  });
  return { rows, summary: createSummary(rows) };
}
