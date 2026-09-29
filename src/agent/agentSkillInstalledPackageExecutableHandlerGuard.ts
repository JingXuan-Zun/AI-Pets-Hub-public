import {
  createAgentSkillInstalledPackageHandlerContractReport,
} from './agentSkillInstalledPackageHandlerContract';
import { type AgentSkillInstalledPackageHandlerPreviewRegistry } from './agentSkillInstalledPackageHandlerPreviewRegistry';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import {
  createAgentSkillInstalledPackageRuntimePreflightReport,
} from './agentSkillInstalledPackageRuntimePreflight';
import {
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
  type AgentSkillInstalledPackageRuntimePolicy,
} from './agentSkillInstalledPackageRuntimePolicy';
import {
  createAgentSkillPackageSignatureVerificationReport,
} from './agentSkillPackageSignatureVerification';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';

export type AgentSkillExecutableHandlerGuardStatus = 'blocked' | 'registerable';

export interface AgentSkillExecutableHandlerGuardRow {
  canRegister: boolean;
  contractIssueCodes: string[];
  guardIssueCodes: string[];
  packageId: string;
  preflightIssueCodes: string[];
  skillId: string;
  status: AgentSkillExecutableHandlerGuardStatus;
}

export interface AgentSkillExecutableHandlerGuardReport {
  rows: AgentSkillExecutableHandlerGuardRow[];
  summary: Record<AgentSkillExecutableHandlerGuardStatus, number> & { total: number };
}

export interface AgentSkillExecutableHandlerGuardOptions {
  signatureMode?: 'external-package' | 'local-resolver';
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}

function getPreviewPackageIds(previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry) {
  return previewRegistry.previews.map((preview) => preview.packageId);
}

function createPreflightIssueCodes(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  options: AgentSkillExecutableHandlerGuardOptions,
) {
  const policyOptions = createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(policy);
  const report = createAgentSkillInstalledPackageRuntimePreflightReport(installedRegistry, {
    ...policyOptions,
    handlerPreviewPackageIds: getPreviewPackageIds(previewRegistry),
    trustedPackageIds: options.trustedPackageIds ?? policyOptions.trustedPackageIds,
  });
  return new Map(report.rows.map((row) => [row.packageId, row.issues.map((issue) => issue.code)]));
}

function createContractIssueCodes(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
) {
  const report = createAgentSkillInstalledPackageHandlerContractReport(installedRegistry, previewRegistry);
  return new Map(report.rows.map((row) => [row.packageId, row.issues]));
}

function createSignatureIssueCodes(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillExecutableHandlerGuardOptions,
) {
  if (options.signatureMode !== 'external-package') {
    return new Map<string, string[]>();
  }
  const report = createAgentSkillPackageSignatureVerificationReport(installedRegistry, {
    verifier: options.signatureVerifier,
  });
  return new Map(report.rows.map((row) => [
    row.packageId,
    [
      'external-package-loader-disabled',
      row.status === 'unverified' ? 'signature-unverified' : '',
      row.status === 'invalid' ? 'signature-invalid' : '',
      row.status === 'verified' ? '' : row.status === 'blocked' ? 'signature-blocked' : '',
      ...row.issueCodes,
    ].filter(Boolean),
  ]));
}

function createGuardIssueCodes(preflightIssues: string[], contractIssues: string[], signatureIssues: string[]) {
  return [
    ...preflightIssues.filter((code) => code !== 'loader-preview-only'),
    ...contractIssues,
    ...signatureIssues,
  ];
}

function createSummary(rows: AgentSkillExecutableHandlerGuardRow[]) {
  const summary = { blocked: 0, registerable: 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function createAgentSkillExecutableHandlerGuardReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  options: AgentSkillExecutableHandlerGuardOptions = {},
): AgentSkillExecutableHandlerGuardReport {
  const preflightIssueCodes = createPreflightIssueCodes(installedRegistry, policy, previewRegistry, options);
  const contractIssueCodes = createContractIssueCodes(installedRegistry, previewRegistry);
  const signatureIssueCodes = createSignatureIssueCodes(installedRegistry, options);
  const rows = installedRegistry.packages.map((item): AgentSkillExecutableHandlerGuardRow => {
    const preflightIssues = preflightIssueCodes.get(item.id) ?? ['preflight-missing'];
    const contractIssues = contractIssueCodes.get(item.id) ?? ['contract-missing'];
    const signatureIssues = signatureIssueCodes.get(item.id) ?? [];
    const guardIssueCodes = createGuardIssueCodes(preflightIssues, contractIssues, signatureIssues);
    return {
      canRegister: guardIssueCodes.length === 0,
      contractIssueCodes: contractIssues,
      guardIssueCodes,
      packageId: item.id,
      preflightIssueCodes: preflightIssues,
      skillId: item.skillId,
      status: guardIssueCodes.length === 0 ? 'registerable' : 'blocked',
    };
  });
  return { rows, summary: createSummary(rows) };
}
