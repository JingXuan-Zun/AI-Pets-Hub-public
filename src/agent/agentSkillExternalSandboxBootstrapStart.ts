import {
  createAgentSkillExternalSandboxBootstrapGateReport,
  type AgentSkillExternalSandboxBootstrapGateOptions,
} from './agentSkillExternalSandboxBootstrapGate';
import {
  createAgentSkillExternalSandboxProcessProfileReport,
  type AgentSkillExternalSandboxProcessProfile,
} from './agentSkillExternalSandboxProcessProfile';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import { type AgentSkillTrustEvidenceRegistry } from './agentSkillInstalledPackageTrustEvidence';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export const AGENT_SKILL_EXTERNAL_SANDBOX_BOOTSTRAP_ENABLED = false;

export type AgentSkillExternalSandboxBootstrapStartStatus =
  | 'blocked-disabled'
  | 'blocked-process-profile';

export interface AgentSkillExternalSandboxBootstrapStartRow {
  bootstrapPlanId: string;
  featureFlagEnabled: false;
  issueCodes: string[];
  packageId: string;
  packageImportAttempted: false;
  processProfileStatus: string;
  sandboxProfile: 'external-skill-package-v1';
  skillId: string;
  spawnAttempted: false;
  status: AgentSkillExternalSandboxBootstrapStartStatus;
}

export interface AgentSkillExternalSandboxBootstrapStartReport {
  rows: AgentSkillExternalSandboxBootstrapStartRow[];
  summary: Record<AgentSkillExternalSandboxBootstrapStartStatus, number> & {
    packageImportAttempted: number;
    spawnAttempted: number;
    total: number;
  };
}

export interface AgentSkillExternalSandboxBootstrapStartOptions
  extends AgentSkillExternalSandboxBootstrapGateOptions {
  processProfile?: AgentSkillExternalSandboxProcessProfile | null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSummary(rows: AgentSkillExternalSandboxBootstrapStartRow[]) {
  const summary = {
    'blocked-disabled': 0,
    'blocked-process-profile': 0,
    packageImportAttempted: 0,
    spawnAttempted: 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function resolveStatus(processIssueCodes: readonly string[]): AgentSkillExternalSandboxBootstrapStartStatus {
  return processIssueCodes.length ? 'blocked-process-profile' : 'blocked-disabled';
}

export function createAgentSkillExternalSandboxBootstrapStartReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalSandboxBootstrapStartOptions = {},
): AgentSkillExternalSandboxBootstrapStartReport {
  const gateReport = createAgentSkillExternalSandboxBootstrapGateReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    options,
  );
  const profileReport = createAgentSkillExternalSandboxProcessProfileReport(installedRegistry, options.processProfile);
  const profileByPackageId = new Map(profileReport.rows.map((row) => [row.packageId, row]));
  const rows = gateReport.rows.map((row): AgentSkillExternalSandboxBootstrapStartRow => {
    const profile = profileByPackageId.get(row.packageId);
    const processIssueCodes = profile?.issueCodes ?? ['bootstrap-process-profile-report-missing'];
    return {
      bootstrapPlanId: row.bootstrapPlanId,
      featureFlagEnabled: AGENT_SKILL_EXTERNAL_SANDBOX_BOOTSTRAP_ENABLED,
      issueCodes: unique(['external-package-loader-disabled', ...row.issueCodes, ...processIssueCodes]),
      packageId: row.packageId,
      packageImportAttempted: false,
      processProfileStatus: profile?.status ?? 'missing',
      sandboxProfile: row.sandboxProfile,
      skillId: row.skillId,
      spawnAttempted: false,
      status: resolveStatus(processIssueCodes),
    };
  });
  return { rows, summary: createSummary(rows) };
}
