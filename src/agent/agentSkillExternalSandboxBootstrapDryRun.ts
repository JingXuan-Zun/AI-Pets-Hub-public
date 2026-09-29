import {
  createAgentSkillExternalLoaderIpcContractPreviewReport,
  type AgentSkillExternalLoaderIpcContractPreviewOptions,
} from './agentSkillExternalLoaderIpcContractPreview';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import { type AgentSkillTrustEvidenceRegistry } from './agentSkillInstalledPackageTrustEvidence';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalSandboxBootstrapDryRunStatus = 'blocked' | 'ready-if-loader-enabled';

export interface AgentSkillExternalSandboxBootstrapDryRunRow {
  attempted: false;
  bootstrapPlanId: string;
  contractStatus: string;
  issueCodes: string[];
  loaderState: 'disabled';
  packageId: string;
  sandboxProfile: 'external-skill-package-v1';
  skillId: string;
  status: AgentSkillExternalSandboxBootstrapDryRunStatus;
}

export interface AgentSkillExternalSandboxBootstrapDryRunReport {
  rows: AgentSkillExternalSandboxBootstrapDryRunRow[];
  summary: Record<AgentSkillExternalSandboxBootstrapDryRunStatus, number> & {
    attempted: number;
    disabled: number;
    total: number;
  };
}

export type AgentSkillExternalSandboxBootstrapDryRunOptions = AgentSkillExternalLoaderIpcContractPreviewOptions;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function resolveStatus(issueCodes: readonly string[]): AgentSkillExternalSandboxBootstrapDryRunStatus {
  return issueCodes.length ? 'blocked' : 'ready-if-loader-enabled';
}

function createSummary(rows: AgentSkillExternalSandboxBootstrapDryRunRow[]) {
  const summary = { attempted: 0, blocked: 0, disabled: rows.length, 'ready-if-loader-enabled': 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function createPlanId(skillId: string, packageId: string) {
  return `${skillId}:${packageId}:external-sandbox-bootstrap-dry-run`;
}

export function createAgentSkillExternalSandboxBootstrapDryRunReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalSandboxBootstrapDryRunOptions = {},
): AgentSkillExternalSandboxBootstrapDryRunReport {
  const contractReport = createAgentSkillExternalLoaderIpcContractPreviewReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    options,
  );
  const contractByPackageId = new Map(contractReport.rows.map((row) => [row.packageId, row]));
  const rows = installedRegistry.packages.map((item): AgentSkillExternalSandboxBootstrapDryRunRow => {
    const contract = contractByPackageId.get(item.id);
    const issueCodes = unique((contract?.issueCodes ?? ['external-loader-ipc-contract-missing'])
      .filter((code) => code !== 'external-package-loader-disabled'));
    return {
      attempted: false,
      bootstrapPlanId: createPlanId(item.skillId, item.id),
      contractStatus: contract?.status ?? 'missing',
      issueCodes: unique(['external-package-loader-disabled', ...issueCodes]),
      loaderState: 'disabled',
      packageId: item.id,
      sandboxProfile: 'external-skill-package-v1',
      skillId: item.skillId,
      status: resolveStatus(issueCodes),
    };
  });
  return { rows, summary: createSummary(rows) };
}
