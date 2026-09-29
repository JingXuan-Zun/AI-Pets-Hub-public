import {
  createAgentSkillExternalSandboxBootstrapStartReport,
  type AgentSkillExternalSandboxBootstrapStartOptions,
} from './agentSkillExternalSandboxBootstrapStart';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import { type AgentSkillTrustEvidenceRegistry } from './agentSkillInstalledPackageTrustEvidence';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalSandboxSupervisorPreflightStatus =
  | 'blocked-bootstrap-start'
  | 'blocked-supervisor-contract'
  | 'supervisor-ready-if-bootstrap-enabled';

export interface AgentSkillExternalSandboxSupervisorContract {
  argumentShape: 'package-id-and-plan-id-only';
  cancelPolicy: 'ipc-cancel-token';
  environmentPolicy: 'allowlist-only';
  id: 'external-skill-sandbox-supervisor-v1';
  launchCommand: 'bundled-supervisor-entry';
  packageCodeLoading: 'disabled';
  receiptSchema: 'redacted-json-receipt-v1';
  secretEnvironment: 'blocked';
  timeoutPolicy: 'per-request-deadline';
  workingDirectory: 'ephemeral';
}

export interface AgentSkillExternalSandboxSupervisorPreflightRow {
  bootstrapPlanId: string;
  contractCodes: string[];
  issueCodes: string[];
  packageId: string;
  packageImportAttempted: false;
  requiredContractCodes: string[];
  skillId: string;
  spawnAttempted: false;
  startStatus: string;
  status: AgentSkillExternalSandboxSupervisorPreflightStatus;
  supervisorContractId: string;
  supervisorLaunchAttempted: false;
}

export interface AgentSkillExternalSandboxSupervisorPreflightReport {
  rows: AgentSkillExternalSandboxSupervisorPreflightRow[];
  summary: Record<AgentSkillExternalSandboxSupervisorPreflightStatus, number> & {
    disabled: number;
    supervisorLaunchAttempted: number;
    total: number;
  };
}

export interface AgentSkillExternalSandboxSupervisorPreflightOptions
  extends AgentSkillExternalSandboxBootstrapStartOptions {
  supervisorContract?: AgentSkillExternalSandboxSupervisorContract | null;
}

const REQUIRED_CONTRACT_CODES = [
  'supervisor-bundled-command',
  'supervisor-package-id-plan-id-args-only',
  'supervisor-env-allowlist-only',
  'supervisor-secret-env-blocked',
  'supervisor-timeout-deadline',
  'supervisor-cancel-token',
  'supervisor-redacted-receipt-schema',
  'supervisor-ephemeral-working-directory',
  'supervisor-package-code-loading-disabled',
] as const;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSummary(rows: AgentSkillExternalSandboxSupervisorPreflightRow[]) {
  const summary = {
    'blocked-bootstrap-start': 0,
    'blocked-supervisor-contract': 0,
    disabled: rows.length,
    'supervisor-ready-if-bootstrap-enabled': 0,
    supervisorLaunchAttempted: 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function createContractCodes(contract: AgentSkillExternalSandboxSupervisorContract) {
  return [
    contract.launchCommand === 'bundled-supervisor-entry' ? 'supervisor-bundled-command' : '',
    contract.argumentShape === 'package-id-and-plan-id-only' ? 'supervisor-package-id-plan-id-args-only' : '',
    contract.environmentPolicy === 'allowlist-only' ? 'supervisor-env-allowlist-only' : '',
    contract.secretEnvironment === 'blocked' ? 'supervisor-secret-env-blocked' : '',
    contract.timeoutPolicy === 'per-request-deadline' ? 'supervisor-timeout-deadline' : '',
    contract.cancelPolicy === 'ipc-cancel-token' ? 'supervisor-cancel-token' : '',
    contract.receiptSchema === 'redacted-json-receipt-v1' ? 'supervisor-redacted-receipt-schema' : '',
    contract.workingDirectory === 'ephemeral' ? 'supervisor-ephemeral-working-directory' : '',
    contract.packageCodeLoading === 'disabled' ? 'supervisor-package-code-loading-disabled' : '',
  ].filter(Boolean);
}

function createContractIssueCodes(contractCodes: readonly string[]) {
  const presentCodes = new Set(contractCodes);
  return REQUIRED_CONTRACT_CODES
    .filter((code) => !presentCodes.has(code))
    .map((code) => `missing-${code}`);
}

function resolveStatus(
  startStatus: string,
  contractIssueCodes: readonly string[],
): AgentSkillExternalSandboxSupervisorPreflightStatus {
  if (contractIssueCodes.length) {
    return 'blocked-supervisor-contract';
  }
  return startStatus === 'blocked-process-profile'
    ? 'blocked-bootstrap-start'
    : 'supervisor-ready-if-bootstrap-enabled';
}

export function createAgentSkillExternalSandboxSupervisorContract(): AgentSkillExternalSandboxSupervisorContract {
  return {
    argumentShape: 'package-id-and-plan-id-only',
    cancelPolicy: 'ipc-cancel-token',
    environmentPolicy: 'allowlist-only',
    id: 'external-skill-sandbox-supervisor-v1',
    launchCommand: 'bundled-supervisor-entry',
    packageCodeLoading: 'disabled',
    receiptSchema: 'redacted-json-receipt-v1',
    secretEnvironment: 'blocked',
    timeoutPolicy: 'per-request-deadline',
    workingDirectory: 'ephemeral',
  };
}

export function getAgentSkillExternalSandboxRequiredSupervisorContractCodes() {
  return [...REQUIRED_CONTRACT_CODES];
}

export function createAgentSkillExternalSandboxSupervisorPreflightReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalSandboxSupervisorPreflightOptions = {},
): AgentSkillExternalSandboxSupervisorPreflightReport {
  const startReport = createAgentSkillExternalSandboxBootstrapStartReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    options,
  );
  const contractCodes = options.supervisorContract ? createContractCodes(options.supervisorContract) : [];
  const contractIssueCodes = unique([
    options.supervisorContract ? '' : 'supervisor-contract-missing',
    ...createContractIssueCodes(contractCodes),
  ]);
  const rows = startReport.rows.map((row): AgentSkillExternalSandboxSupervisorPreflightRow => ({
    bootstrapPlanId: row.bootstrapPlanId,
    contractCodes,
    issueCodes: unique([...row.issueCodes, ...contractIssueCodes]),
    packageId: row.packageId,
    packageImportAttempted: false,
    requiredContractCodes: getAgentSkillExternalSandboxRequiredSupervisorContractCodes(),
    skillId: row.skillId,
    spawnAttempted: false,
    startStatus: row.status,
    status: resolveStatus(row.status, contractIssueCodes),
    supervisorContractId: options.supervisorContract?.id ?? 'missing',
    supervisorLaunchAttempted: false,
  }));
  return { rows, summary: createSummary(rows) };
}
