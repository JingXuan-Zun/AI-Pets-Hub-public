import { type AgentSkillInstalledPackageHandlerPreviewRegistry } from './agentSkillInstalledPackageHandlerPreviewRegistry';
import {
  createAgentSkillInstalledPackageHandlerContractReport,
  type AgentSkillInstalledPackageHandlerContractStatus,
} from './agentSkillInstalledPackageHandlerContract';
import {
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  type AgentSkillInstalledPackageLoaderBoundaryOptions,
} from './agentSkillInstalledPackageLoaderBoundary';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillInstalledPackageRuntimePolicy } from './agentSkillInstalledPackageRuntimePolicy';
import {
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
} from './agentSkillInstalledPackageRuntimePolicy';

export type AgentSkillInstalledPackageRuntimeReadinessStatus =
  | 'blocked'
  | 'execution-ready'
  | 'handler-preview'
  | 'policy-ready'
  | 'unavailable';

export interface AgentSkillInstalledPackageRuntimeReadinessRow {
  boundaryId: string | null;
  contractStatus: AgentSkillInstalledPackageHandlerContractStatus;
  handlerRegistration: 'missing' | 'preview' | 'registered';
  packageId: string;
  policyFlags: {
    runtimeEnabled: boolean;
    sandboxed: boolean;
    trusted: boolean;
  };
  preflightIssueCodes: string[];
  reviewedAt: string | null;
  runtime: string;
  skillId: string;
  status: AgentSkillInstalledPackageRuntimeReadinessStatus;
}

export interface AgentSkillInstalledPackageRuntimeReadinessDashboard {
  rows: AgentSkillInstalledPackageRuntimeReadinessRow[];
  summary: Record<AgentSkillInstalledPackageRuntimeReadinessStatus, number> & { total: number };
}

export interface AgentSkillInstalledPackageRuntimeReadinessOptions {
  executableHandlerPackageIds?: readonly string[];
  trustedPackageIds?: readonly string[];
}

function getPolicyRecord(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  packageId: string,
) {
  return policy.records.find((record) => record.packageId === packageId) ?? null;
}

function createPolicyFlags(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  packageId: string,
) {
  const record = getPolicyRecord(policy, packageId);
  return {
    runtimeEnabled: Boolean(record?.runtimeEnabled),
    sandboxed: Boolean(record?.sandboxed),
    trusted: Boolean(record?.trusted),
  };
}

function getPreviewPackageIds(registry: AgentSkillInstalledPackageHandlerPreviewRegistry) {
  return registry.previews.map((preview) => preview.packageId);
}

function createBoundaryOptions(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  handlerPreviews: AgentSkillInstalledPackageHandlerPreviewRegistry,
  options: AgentSkillInstalledPackageRuntimeReadinessOptions,
): AgentSkillInstalledPackageLoaderBoundaryOptions {
  const policyOptions = createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(policy);
  return {
    ...policyOptions,
    executableHandlerPackageIds: options.executableHandlerPackageIds,
    previewHandlerPackageIds: getPreviewPackageIds(handlerPreviews),
    trustedPackageIds: options.trustedPackageIds ?? policyOptions.trustedPackageIds,
  };
}

function hasPolicyReady(flags: AgentSkillInstalledPackageRuntimeReadinessRow['policyFlags']) {
  return flags.runtimeEnabled && flags.sandboxed && flags.trusted;
}

function resolveReadinessStatus(
  boundaryStatus: string,
  handlerRegistration: AgentSkillInstalledPackageRuntimeReadinessRow['handlerRegistration'],
  policyFlags: AgentSkillInstalledPackageRuntimeReadinessRow['policyFlags'],
): AgentSkillInstalledPackageRuntimeReadinessStatus {
  if (boundaryStatus === 'execution-ready') {
    return 'execution-ready';
  }
  if (boundaryStatus === 'unavailable') {
    return 'unavailable';
  }
  if (!hasPolicyReady(policyFlags)) {
    return 'blocked';
  }
  if (handlerRegistration === 'preview') {
    return 'handler-preview';
  }
  return 'policy-ready';
}

function createSummary(rows: AgentSkillInstalledPackageRuntimeReadinessRow[]) {
  const summary = {
    blocked: 0,
    'execution-ready': 0,
    'handler-preview': 0,
    'policy-ready': 0,
    total: rows.length,
    unavailable: 0,
  };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  handlerPreviews: AgentSkillInstalledPackageHandlerPreviewRegistry,
  options: AgentSkillInstalledPackageRuntimeReadinessOptions = {},
): AgentSkillInstalledPackageRuntimeReadinessDashboard {
  const boundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(
    installedRegistry,
    createBoundaryOptions(policy, handlerPreviews, options),
  );
  const boundaryByPackageId = new Map(boundaryReport.rows.map((row) => [row.packageId, row]));
  const contractReport = createAgentSkillInstalledPackageHandlerContractReport(installedRegistry, handlerPreviews);
  const contractByPackageId = new Map(contractReport.rows.map((row) => [row.packageId, row]));
  const rows = installedRegistry.packages.map((item): AgentSkillInstalledPackageRuntimeReadinessRow => {
    const boundary = boundaryByPackageId.get(item.id);
    const contract = contractByPackageId.get(item.id);
    const policyFlags = createPolicyFlags(policy, item.id);
    return {
      boundaryId: boundary?.boundaryId ?? null,
      contractStatus: contract?.status ?? 'missing',
      handlerRegistration: boundary?.handlerRegistration ?? 'missing',
      packageId: item.id,
      policyFlags,
      preflightIssueCodes: boundary?.preflightIssueCodes ?? ['boundary-missing'],
      reviewedAt: getPolicyRecord(policy, item.id)?.reviewedAt ?? null,
      runtime: item.package.scaffold.package.runtime,
      skillId: item.skillId,
      status: resolveReadinessStatus(boundary?.status ?? 'unavailable', boundary?.handlerRegistration ?? 'missing', policyFlags),
    };
  });
  return { rows, summary: createSummary(rows) };
}
