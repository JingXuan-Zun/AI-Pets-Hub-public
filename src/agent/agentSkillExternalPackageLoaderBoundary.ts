import {
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
  type AgentSkillInstalledPackageRuntimePolicy,
} from './agentSkillInstalledPackageRuntimePolicy';
import {
  createAgentSkillInstalledPackageRuntimePreflightReport,
  type AgentSkillInstalledPackageRuntimePreflightIssue,
  type AgentSkillInstalledPackageRuntimePreflightStatus,
} from './agentSkillInstalledPackageRuntimePreflight';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillTrustEvidenceReport,
  type AgentSkillTrustEvidenceRegistry,
  type AgentSkillTrustEvidenceStatus,
} from './agentSkillInstalledPackageTrustEvidence';
import {
  createAgentSkillPackageSignatureVerificationReport,
  type AgentSkillPackageSignatureStatus,
} from './agentSkillPackageSignatureVerification';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';
import {
  type AgentSkillInstalledPackage,
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';

export type AgentSkillExternalPackageLoaderBoundaryReadinessStatus =
  | 'blocked'
  | 'ready-if-loader-enabled'
  | 'review-required';

export interface AgentSkillExternalPackageLoaderBoundaryRow {
  blockingIssueCodes: string[];
  boundaryId: 'external-package-sandbox-loader';
  boundaryMode: 'non-executing-report';
  loaderState: 'disabled';
  packageId: string;
  permissionBoundary: string;
  preflightIssueCodes: string[];
  preflightStatus: AgentSkillInstalledPackageRuntimePreflightStatus | 'missing';
  readinessIssueCodes: string[];
  readinessStatus: AgentSkillExternalPackageLoaderBoundaryReadinessStatus;
  runtime: string;
  sandboxBoundary: 'declared' | 'missing';
  signatureIssueCodes: string[];
  signatureStatus: AgentSkillPackageSignatureStatus | 'missing';
  skillId: string;
  trustEvidenceIssueCodes: string[];
  trustEvidenceStatus: AgentSkillTrustEvidenceStatus | 'missing';
}

export interface AgentSkillExternalPackageLoaderBoundaryReport {
  rows: AgentSkillExternalPackageLoaderBoundaryRow[];
  summary: Record<AgentSkillExternalPackageLoaderBoundaryReadinessStatus, number> & {
    disabled: number;
    total: number;
  };
}

export interface AgentSkillExternalPackageLoaderBoundaryOptions {
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createSignatureIssueCodes(
  signature?: ReturnType<typeof createAgentSkillPackageSignatureVerificationReport>['rows'][number],
) {
  if (!signature) {
    return ['signature-report-missing'];
  }
  if (signature.status === 'verified') {
    return [];
  }
  return unique([
    signature.status === 'unsigned' ? 'package-signature-missing' : `signature-${signature.status}`,
    ...signature.issueCodes,
  ]);
}

function createTrustIssueCodes(
  evidence?: ReturnType<typeof createAgentSkillTrustEvidenceReport>['rows'][number],
) {
  if (!evidence) {
    return ['trust-evidence-report-missing'];
  }
  return evidence.status === 'valid' ? [] : unique([`trust-evidence-${evidence.status}`, ...evidence.issueCodes]);
}

function resolveReadinessStatus(
  preflightIssues: readonly AgentSkillInstalledPackageRuntimePreflightIssue[],
  signatureIssues: readonly string[],
  trustIssues: readonly string[],
): AgentSkillExternalPackageLoaderBoundaryReadinessStatus {
  if (signatureIssues.length || trustIssues.length || preflightIssues.some((issue) => issue.severity === 'blocked')) {
    return 'blocked';
  }
  return preflightIssues.length ? 'review-required' : 'ready-if-loader-enabled';
}

function createSummary(rows: AgentSkillExternalPackageLoaderBoundaryRow[]) {
  const summary = {
    blocked: 0,
    disabled: rows.length,
    'ready-if-loader-enabled': 0,
    'review-required': 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.readinessStatus] += 1;
  });
  return summary;
}

function createReportContext(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalPackageLoaderBoundaryOptions,
) {
  const packageIds = installedRegistry.packages.map((item) => item.id);
  const policyOptions = createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(policy);
  const trustedPackageIds = options.trustedPackageIds
    ?? createAgentSkillEffectiveTrustedPackageIds(policy, installedRegistry, evidenceRegistry);
  const preflight = createAgentSkillInstalledPackageRuntimePreflightReport(installedRegistry, {
    ...policyOptions,
    loaderPackageIds: packageIds,
    trustedPackageIds,
  });
  const signatures = createAgentSkillPackageSignatureVerificationReport(installedRegistry, {
    verifier: options.signatureVerifier,
  });
  const evidence = createAgentSkillTrustEvidenceReport(installedRegistry, evidenceRegistry);
  return {
    evidenceByPackageId: new Map(evidence.rows.map((row) => [row.packageId, row])),
    preflightByPackageId: new Map(preflight.rows.map((row) => [row.packageId, row])),
    signatureByPackageId: new Map(signatures.rows.map((row) => [row.packageId, row])),
  };
}

function createRow(
  item: AgentSkillInstalledPackage,
  context: ReturnType<typeof createReportContext>,
): AgentSkillExternalPackageLoaderBoundaryRow {
  const preflight = context.preflightByPackageId.get(item.id);
  const signature = context.signatureByPackageId.get(item.id);
  const evidence = context.evidenceByPackageId.get(item.id);
  const preflightIssues = preflight?.issues ?? [];
  const signatureIssueCodes = createSignatureIssueCodes(signature);
  const trustEvidenceIssueCodes = createTrustIssueCodes(evidence);
  const readinessIssueCodes = unique([
    ...preflightIssues.map((issue) => issue.code),
    ...signatureIssueCodes,
    ...trustEvidenceIssueCodes,
  ]);
  return {
    blockingIssueCodes: unique(['external-package-loader-disabled', ...readinessIssueCodes]),
    boundaryId: 'external-package-sandbox-loader',
    boundaryMode: 'non-executing-report',
    loaderState: 'disabled',
    packageId: item.id,
    permissionBoundary: preflight?.permissionRoute ?? 'unavailable',
    preflightIssueCodes: preflightIssues.map((issue) => issue.code),
    preflightStatus: preflight?.status ?? 'missing',
    readinessIssueCodes,
    readinessStatus: resolveReadinessStatus(preflightIssues, signatureIssueCodes, trustEvidenceIssueCodes),
    runtime: item.package.scaffold.package.runtime,
    sandboxBoundary: preflight?.sandboxBoundary ?? 'missing',
    signatureIssueCodes,
    signatureStatus: signature?.status ?? 'missing',
    skillId: item.skillId,
    trustEvidenceIssueCodes,
    trustEvidenceStatus: evidence?.status ?? 'missing',
  };
}

export function createAgentSkillExternalPackageLoaderBoundaryReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillExternalPackageLoaderBoundaryOptions = {},
): AgentSkillExternalPackageLoaderBoundaryReport {
  const context = createReportContext(installedRegistry, policy, evidenceRegistry, options);
  const rows = installedRegistry.packages.map((item) => createRow(item, context));
  return { rows, summary: createSummary(rows) };
}
