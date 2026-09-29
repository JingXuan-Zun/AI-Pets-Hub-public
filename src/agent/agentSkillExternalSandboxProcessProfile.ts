import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalSandboxProcessProfileStatus = 'blocked' | 'process-ready-if-bootstrap-enabled';

export interface AgentSkillExternalSandboxProcessProfile {
  id: 'external-skill-bootstrap-process-v1';
  ipcMode: 'permission-routed-json';
  nodeIntegration: 'disabled';
  packageCodeLoading: 'disabled';
  packageMount: 'read-only';
  processModel: 'dedicated-subprocess';
  receiptRedaction: 'enabled';
}

export interface AgentSkillExternalSandboxProcessProfileRow {
  issueCodes: string[];
  packageId: string;
  profileCodes: string[];
  profileId: string;
  requiredProfileCodes: string[];
  skillId: string;
  status: AgentSkillExternalSandboxProcessProfileStatus;
}

export interface AgentSkillExternalSandboxProcessProfileReport {
  rows: AgentSkillExternalSandboxProcessProfileRow[];
  summary: Record<AgentSkillExternalSandboxProcessProfileStatus, number> & {
    total: number;
  };
}

const REQUIRED_PROFILE_CODES = [
  'process-dedicated-subprocess',
  'process-readonly-package-mount',
  'process-node-integration-disabled',
  'process-permission-routed-json-ipc',
  'process-redacted-receipts',
  'process-package-code-loading-disabled',
] as const;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSummary(rows: AgentSkillExternalSandboxProcessProfileRow[]) {
  const summary = { blocked: 0, 'process-ready-if-bootstrap-enabled': 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function createProfileCodes(profile: AgentSkillExternalSandboxProcessProfile) {
  return [
    profile.processModel === 'dedicated-subprocess' ? 'process-dedicated-subprocess' : '',
    profile.packageMount === 'read-only' ? 'process-readonly-package-mount' : '',
    profile.nodeIntegration === 'disabled' ? 'process-node-integration-disabled' : '',
    profile.ipcMode === 'permission-routed-json' ? 'process-permission-routed-json-ipc' : '',
    profile.receiptRedaction === 'enabled' ? 'process-redacted-receipts' : '',
    profile.packageCodeLoading === 'disabled' ? 'process-package-code-loading-disabled' : '',
  ].filter(Boolean);
}

function createIssueCodes(profileCodes: readonly string[]) {
  const presentCodes = new Set(profileCodes);
  return REQUIRED_PROFILE_CODES
    .filter((code) => !presentCodes.has(code))
    .map((code) => `missing-${code}`);
}

export function createAgentSkillExternalSandboxBootstrapProcessProfile(): AgentSkillExternalSandboxProcessProfile {
  return {
    id: 'external-skill-bootstrap-process-v1',
    ipcMode: 'permission-routed-json',
    nodeIntegration: 'disabled',
    packageCodeLoading: 'disabled',
    packageMount: 'read-only',
    processModel: 'dedicated-subprocess',
    receiptRedaction: 'enabled',
  };
}

export function getAgentSkillExternalSandboxRequiredProcessProfileCodes() {
  return [...REQUIRED_PROFILE_CODES];
}

export function createAgentSkillExternalSandboxProcessProfileReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  profile?: AgentSkillExternalSandboxProcessProfile | null,
): AgentSkillExternalSandboxProcessProfileReport {
  const profileCodes = profile ? createProfileCodes(profile) : [];
  const issueCodes = unique([
    profile ? '' : 'bootstrap-process-profile-missing',
    ...createIssueCodes(profileCodes),
  ]);
  const status = issueCodes.length ? 'blocked' : 'process-ready-if-bootstrap-enabled';
  const rows = installedRegistry.packages.map((item): AgentSkillExternalSandboxProcessProfileRow => ({
    issueCodes,
    packageId: item.id,
    profileCodes,
    profileId: profile?.id ?? 'missing',
    requiredProfileCodes: getAgentSkillExternalSandboxRequiredProcessProfileCodes(),
    skillId: item.skillId,
    status,
  }));
  return { rows, summary: createSummary(rows) };
}
