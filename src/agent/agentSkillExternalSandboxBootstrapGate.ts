import {
  createAgentSkillExternalSandboxBootstrapDryRunReport,
  type AgentSkillExternalSandboxBootstrapDryRunOptions,
} from './agentSkillExternalSandboxBootstrapDryRun';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import { type AgentSkillTrustEvidenceRegistry } from './agentSkillInstalledPackageTrustEvidence';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalSandboxBootstrapGateStatus = 'blocked-disabled';

export interface AgentSkillExternalSandboxBootstrapGateRow {
  bootstrapPlanId: string;
  issueCodes: string[];
  packageId: string;
  sandboxProfile: 'external-skill-package-v1';
  skillId: string;
  started: false;
  status: AgentSkillExternalSandboxBootstrapGateStatus;
}

export interface AgentSkillExternalSandboxBootstrapGateReport {
  rows: AgentSkillExternalSandboxBootstrapGateRow[];
  summary: Record<AgentSkillExternalSandboxBootstrapGateStatus, number> & {
    started: number;
    total: number;
  };
}

export type AgentSkillExternalSandboxBootstrapGateOptions = AgentSkillExternalSandboxBootstrapDryRunOptions;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSummary(rows: AgentSkillExternalSandboxBootstrapGateRow[]) {
  return {
    'blocked-disabled': rows.length,
    started: 0,
    total: rows.length,
  };
}

export function createAgentSkillExternalSandboxBootstrapGateReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalSandboxBootstrapGateOptions = {},
): AgentSkillExternalSandboxBootstrapGateReport {
  const dryRun = createAgentSkillExternalSandboxBootstrapDryRunReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    options,
  );
  const rows = dryRun.rows.map((row): AgentSkillExternalSandboxBootstrapGateRow => ({
    bootstrapPlanId: row.bootstrapPlanId,
    issueCodes: unique(['external-package-loader-disabled', ...row.issueCodes]),
    packageId: row.packageId,
    sandboxProfile: row.sandboxProfile,
    skillId: row.skillId,
    started: false,
    status: 'blocked-disabled',
  }));
  return { rows, summary: createSummary(rows) };
}
