import {
  createAgentSkillExternalSandboxIsolationReport,
  type AgentSkillExternalSandboxIsolationOptions,
} from './agentSkillExternalSandboxIsolationEvidence';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import { type AgentSkillTrustEvidenceRegistry } from './agentSkillInstalledPackageTrustEvidence';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalLoaderIpcContractStatus = 'blocked' | 'contract-ready-if-loader-enabled';

export interface AgentSkillExternalLoaderIpcContractRow {
  contractCodes: string[];
  issueCodes: string[];
  loaderState: 'disabled';
  packageId: string;
  requiredContractCodes: string[];
  sandboxStatus: string;
  skillId: string;
  status: AgentSkillExternalLoaderIpcContractStatus;
}

export interface AgentSkillExternalLoaderIpcContractReport {
  rows: AgentSkillExternalLoaderIpcContractRow[];
  summary: Record<AgentSkillExternalLoaderIpcContractStatus, number> & {
    disabled: number;
    total: number;
  };
}

export interface AgentSkillExternalLoaderIpcContractPreviewOptions
  extends AgentSkillExternalSandboxIsolationOptions {
  contractCodes?: readonly string[];
}

const REQUIRED_CONTRACT_CODES = [
  'ipc-json-request-schema',
  'ipc-permission-request-channel',
  'ipc-result-receipt-schema',
  'ipc-timeout-cancel-channel',
  'ipc-log-redaction-channel',
] as const;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createMissingContractCodes(contractCodes: readonly string[]) {
  const contracts = new Set(contractCodes);
  return REQUIRED_CONTRACT_CODES
    .filter((code) => !contracts.has(code))
    .map((code) => `missing-${code}`);
}

function resolveStatus(issueCodes: readonly string[]): AgentSkillExternalLoaderIpcContractStatus {
  return issueCodes.length ? 'blocked' : 'contract-ready-if-loader-enabled';
}

function createSummary(rows: AgentSkillExternalLoaderIpcContractRow[]) {
  const summary = { blocked: 0, 'contract-ready-if-loader-enabled': 0, disabled: rows.length, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function getAgentSkillExternalLoaderRequiredIpcContractCodes() {
  return [...REQUIRED_CONTRACT_CODES];
}

export function createAgentSkillExternalLoaderIpcContractPreviewReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalLoaderIpcContractPreviewOptions = {},
): AgentSkillExternalLoaderIpcContractReport {
  const isolationReport = createAgentSkillExternalSandboxIsolationReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    options,
  );
  const isolationByPackageId = new Map(isolationReport.rows.map((row) => [row.packageId, row]));
  const missingContractCodes = createMissingContractCodes(options.contractCodes ?? []);
  const rows = installedRegistry.packages.map((item): AgentSkillExternalLoaderIpcContractRow => {
    const isolation = isolationByPackageId.get(item.id);
    const isolationIssues = isolation?.issueCodes.filter((code) => code !== 'external-package-loader-disabled')
      ?? ['sandbox-isolation-report-missing'];
    const issueCodes = unique([...isolationIssues, ...missingContractCodes]);
    return {
      contractCodes: [...(options.contractCodes ?? [])],
      issueCodes: unique(['external-package-loader-disabled', ...issueCodes]),
      loaderState: 'disabled',
      packageId: item.id,
      requiredContractCodes: getAgentSkillExternalLoaderRequiredIpcContractCodes(),
      sandboxStatus: isolation?.status ?? 'missing',
      skillId: item.skillId,
      status: resolveStatus(issueCodes),
    };
  });
  return { rows, summary: createSummary(rows) };
}
