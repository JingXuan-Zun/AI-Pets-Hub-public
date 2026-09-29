import {
  type AgentSkillExecutableHandlerRecord,
  type AgentSkillExecutableHandlerRegistry,
  getAgentSkillExecutableHandlerPackageIds,
} from './agentSkillInstalledPackageExecutableHandlerRegistry';
import {
  createAgentSkillExecutableHandlerGuardReport,
} from './agentSkillInstalledPackageExecutableHandlerGuard';
import { type AgentSkillInstalledPackageHandlerPreviewRegistry } from './agentSkillInstalledPackageHandlerPreviewRegistry';
import {
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  type AgentSkillInstalledPackageLoaderBoundaryStatus,
} from './agentSkillInstalledPackageLoaderBoundary';
import {
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
  type AgentSkillInstalledPackageRuntimePolicy,
} from './agentSkillInstalledPackageRuntimePolicy';
import {
  createAgentSkillPackageSignatureVerificationReport,
  type AgentSkillPackageSignatureStatus,
} from './agentSkillPackageSignatureVerification';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';
import {
  createAgentSkillExecutionScopeReport,
  type AgentSkillExecutionScopeStatus,
} from './agentSkillInstalledPackageExecutionScope';
import {
  type AgentSkillInstalledPackage,
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillTrustEvidenceReport,
  type AgentSkillTrustEvidenceRegistry,
  type AgentSkillTrustEvidenceStatus,
} from './agentSkillInstalledPackageTrustEvidence';

export type AgentSkillRuntimeModeDecisionStatus =
  | 'blocked'
  | 'local-resolver-active'
  | 'local-resolver-registerable';
export type AgentSkillRuntimeLocalResolverStatus = 'active' | 'blocked' | 'registerable';

export interface AgentSkillRuntimeModeDecisionRow {
  activeMode: 'local-skill-resolver' | 'none';
  blockingIssueCodes: string[];
  boundaryId: string | null;
  boundaryIssueCodes: string[];
  boundaryStatus: AgentSkillInstalledPackageLoaderBoundaryStatus | 'missing';
  externalPackageIssueCodes: string[];
  externalPackageStatus: 'disabled';
  handlerId: string | null;
  loaderKind: 'local-skill-resolver' | null;
  localResolverIssueCodes: string[];
  localResolverStatus: AgentSkillRuntimeLocalResolverStatus;
  packageId: string;
  scopeIssueCodes: string[];
  scopeStatus: AgentSkillExecutionScopeStatus | 'missing';
  signatureIssueCodes: string[];
  signatureStatus: AgentSkillPackageSignatureStatus | 'missing';
  skillId: string;
  status: AgentSkillRuntimeModeDecisionStatus;
  trustEvidenceIssueCodes: string[];
  trustEvidenceStatus: AgentSkillTrustEvidenceStatus | 'missing';
}

export interface AgentSkillRuntimeModeDecisionReport {
  rows: AgentSkillRuntimeModeDecisionRow[];
  summary: Record<AgentSkillRuntimeModeDecisionStatus, number> & {
    externalDisabled: number;
    total: number;
  };
}

export interface AgentSkillRuntimeModeDecisionOptions {
  executableHandlerRegistry?: AgentSkillExecutableHandlerRegistry;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}

interface AgentSkillRuntimeModeDecisionContext {
  boundaryByPackageId: Map<string, ReturnType<typeof createAgentSkillInstalledPackageLoaderBoundaryReport>['rows'][number]>;
  evidenceByPackageId: Map<string, ReturnType<typeof createAgentSkillTrustEvidenceReport>['rows'][number]>;
  externalGuardByPackageId: Map<string, ReturnType<typeof createAgentSkillExecutableHandlerGuardReport>['rows'][number]>;
  handlerByPackageId: Map<string, AgentSkillExecutableHandlerRecord>;
  localGuardByPackageId: Map<string, ReturnType<typeof createAgentSkillExecutableHandlerGuardReport>['rows'][number]>;
  scopeByPackageId: Map<string, ReturnType<typeof createAgentSkillExecutionScopeReport>['rows'][number]>;
  signatureByPackageId: Map<string, ReturnType<typeof createAgentSkillPackageSignatureVerificationReport>['rows'][number]>;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getPreviewPackageIds(previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry) {
  return previewRegistry.previews.map((preview) => preview.packageId);
}

function createHandlerByPackageId(registry?: AgentSkillExecutableHandlerRegistry) {
  return new Map((registry?.handlers ?? []).map((handler) => [handler.packageId, handler]));
}

function createExecutableHandlerPackageIds(registry?: AgentSkillExecutableHandlerRegistry) {
  return registry ? getAgentSkillExecutableHandlerPackageIds(registry) : [];
}

function resolveTrustedPackageIds(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillRuntimeModeDecisionOptions,
) {
  return options.trustedPackageIds
    ?? createAgentSkillEffectiveTrustedPackageIds(policy, installedRegistry, evidenceRegistry);
}

function resolveLocalStatus(
  handler: AgentSkillExecutableHandlerRecord | undefined,
  canRegister: boolean,
): AgentSkillRuntimeLocalResolverStatus {
  if (handler && canRegister) {
    return 'active';
  }
  return canRegister ? 'registerable' : 'blocked';
}

function resolveDecisionStatus(
  localStatus: AgentSkillRuntimeLocalResolverStatus,
): AgentSkillRuntimeModeDecisionStatus {
  if (localStatus === 'active') {
    return 'local-resolver-active';
  }
  return localStatus === 'registerable' ? 'local-resolver-registerable' : 'blocked';
}

function createBoundaryIssueCodes(
  status: AgentSkillInstalledPackageLoaderBoundaryStatus | 'missing',
  issueCodes: string[],
) {
  return unique([
    status === 'execution-ready' ? '' : `loader-boundary-${status}`,
    ...issueCodes,
  ]);
}

function createSummary(rows: AgentSkillRuntimeModeDecisionRow[]) {
  const summary = {
    blocked: 0,
    externalDisabled: rows.length,
    'local-resolver-active': 0,
    'local-resolver-registerable': 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function createDecisionContext(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillRuntimeModeDecisionOptions,
) {
  const trustedPackageIds = resolveTrustedPackageIds(installedRegistry, policy, evidenceRegistry, options);
  const policyOptions = createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(policy);
  const executableHandlerPackageIds = createExecutableHandlerPackageIds(options.executableHandlerRegistry);
  const previewHandlerPackageIds = getPreviewPackageIds(previewRegistry);
  const loaderOptions = { ...policyOptions, executableHandlerPackageIds, previewHandlerPackageIds, trustedPackageIds };
  const localGuard = createAgentSkillExecutableHandlerGuardReport(installedRegistry, policy, previewRegistry, { trustedPackageIds });
  const externalGuard = createAgentSkillExecutableHandlerGuardReport(installedRegistry, policy, previewRegistry, {
    signatureMode: 'external-package',
    signatureVerifier: options.signatureVerifier,
    trustedPackageIds,
  });
  const signatureReport = createAgentSkillPackageSignatureVerificationReport(installedRegistry, {
    verifier: options.signatureVerifier,
  });
  const evidenceReport = createAgentSkillTrustEvidenceReport(installedRegistry, evidenceRegistry);
  const boundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(installedRegistry, loaderOptions);
  const scopeReport = createAgentSkillExecutionScopeReport(installedRegistry, previewRegistry, loaderOptions);
  return {
    boundaryByPackageId: new Map(boundaryReport.rows.map((row) => [row.packageId, row])),
    evidenceByPackageId: new Map(evidenceReport.rows.map((row) => [row.packageId, row])),
    externalGuardByPackageId: new Map(externalGuard.rows.map((row) => [row.packageId, row])),
    handlerByPackageId: createHandlerByPackageId(options.executableHandlerRegistry),
    localGuardByPackageId: new Map(localGuard.rows.map((row) => [row.packageId, row])),
    scopeByPackageId: new Map(scopeReport.rows.map((row) => [row.packageId, row])),
    signatureByPackageId: new Map(signatureReport.rows.map((row) => [row.packageId, row])),
  } satisfies AgentSkillRuntimeModeDecisionContext;
}

function createDecisionRow(
  item: AgentSkillInstalledPackage,
  context: AgentSkillRuntimeModeDecisionContext,
): AgentSkillRuntimeModeDecisionRow {
  const handler = context.handlerByPackageId.get(item.id);
  const guard = context.localGuardByPackageId.get(item.id);
  const localStatus = resolveLocalStatus(handler, Boolean(guard?.canRegister));
  const boundary = context.boundaryByPackageId.get(item.id);
  const scope = context.scopeByPackageId.get(item.id);
  const signature = context.signatureByPackageId.get(item.id);
  const evidence = context.evidenceByPackageId.get(item.id);
  const external = context.externalGuardByPackageId.get(item.id);
  const boundaryIssueCodes = createBoundaryIssueCodes(
    boundary?.status ?? 'missing',
    boundary?.preflightIssueCodes ?? ['loader-boundary-missing'],
  );
  const scopeIssueCodes = scope?.issues.map((issue) => issue.code) ?? ['execution-scope-missing'];
  const blockingIssueCodes = unique([
    ...(guard?.guardIssueCodes ?? ['guard-missing']),
    ...(evidence?.issueCodes ?? []),
    ...scopeIssueCodes,
    ...boundaryIssueCodes,
  ]);
  return {
    activeMode: localStatus === 'active' ? 'local-skill-resolver' : 'none',
    blockingIssueCodes,
    boundaryId: boundary?.boundaryId ?? null,
    boundaryIssueCodes,
    boundaryStatus: boundary?.status ?? 'missing',
    externalPackageIssueCodes: unique([
      'external-package-loader-disabled',
      ...(external?.guardIssueCodes ?? []),
      ...(signature?.issueCodes ?? []),
    ]),
    externalPackageStatus: 'disabled',
    handlerId: handler?.handlerId ?? null,
    loaderKind: handler?.loaderKind ?? null,
    localResolverIssueCodes: guard?.guardIssueCodes ?? ['guard-missing'],
    localResolverStatus: localStatus,
    packageId: item.id,
    scopeIssueCodes,
    scopeStatus: scope?.status ?? 'missing',
    signatureIssueCodes: signature?.issueCodes ?? ['signature-report-missing'],
    signatureStatus: signature?.status ?? 'missing',
    skillId: item.skillId,
    status: resolveDecisionStatus(localStatus),
    trustEvidenceIssueCodes: evidence?.issueCodes ?? ['trust-evidence-report-missing'],
    trustEvidenceStatus: evidence?.status ?? 'missing',
  };
}

export function createAgentSkillRuntimeModeDecisionReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  evidenceRegistry: AgentSkillTrustEvidenceRegistry,
  options: AgentSkillRuntimeModeDecisionOptions = {},
): AgentSkillRuntimeModeDecisionReport {
  const context = createDecisionContext(installedRegistry, policy, previewRegistry, evidenceRegistry, options);
  const rows = installedRegistry.packages.map((item) => createDecisionRow(item, context));
  return { rows, summary: createSummary(rows) };
}
