import {
  createAgentSkillInstalledPackageHandlerContractReport,
  type AgentSkillInstalledPackageHandlerContractStatus,
} from './agentSkillInstalledPackageHandlerContract';
import { type AgentSkillInstalledPackageHandlerPreviewRegistry } from './agentSkillInstalledPackageHandlerPreviewRegistry';
import {
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  type AgentSkillInstalledPackageLoaderBoundaryOptions,
  type AgentSkillInstalledPackageLoaderBoundaryStatus,
} from './agentSkillInstalledPackageLoaderBoundary';
import { type AgentSkillInstalledPackageRegistry, type AgentSkillInstalledPackage } from './agentSkillPackageInstalledRegistry';
import { createAgentSkillManifest, type AgentSkillManifestEntry } from './agentSkillManifest';

export type AgentSkillExecutionScopeStatus = 'blocked' | 'review-required' | 'scoped';
export type AgentSkillExecutionScopeIssueSeverity = 'blocked' | 'warning';

export interface AgentSkillExecutionScopeIssue {
  code: string;
  detail: string;
  severity: AgentSkillExecutionScopeIssueSeverity;
}

export interface AgentSkillExecutionScopeRow {
  allowedInputKeys: string[];
  boundaryStatus: AgentSkillInstalledPackageLoaderBoundaryStatus | 'missing';
  contractStatus: AgentSkillInstalledPackageHandlerContractStatus;
  handlerRegistration: 'missing' | 'preview' | 'registered';
  issues: AgentSkillExecutionScopeIssue[];
  packageId: string;
  packageInputKeys: string[];
  permissionBoundary: string;
  permissionScope: string;
  requiredInputKeys: string[];
  runtime: string;
  sandboxBoundary: string;
  skillId: string;
  status: AgentSkillExecutionScopeStatus;
}

export interface AgentSkillExecutionScopeReport {
  rows: AgentSkillExecutionScopeRow[];
  summary: Record<AgentSkillExecutionScopeStatus, number> & { total: number };
}

export type AgentSkillExecutionScopeReportOptions = AgentSkillInstalledPackageLoaderBoundaryOptions;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createIssue(
  code: string,
  severity: AgentSkillExecutionScopeIssueSeverity,
  detail: string,
): AgentSkillExecutionScopeIssue {
  return { code, detail, severity };
}

function getPackageInputKeys(item: AgentSkillInstalledPackage) {
  const template = item.package.scaffold.inputTemplate;
  return isRecord(template) ? Object.keys(template).sort((a, b) => a.localeCompare(b)) : [];
}

function createManifestIssues(entry: AgentSkillManifestEntry | undefined, item: AgentSkillInstalledPackage) {
  if (!entry) {
    return [createIssue('manifest-missing', 'blocked', 'Installed package targets a Skill that is not in the local manifest.')];
  }
  const packageMetadata = item.package.scaffold.package;
  return [
    entry.package.runtime === packageMetadata.runtime
      ? null
      : createIssue('runtime-scope-differs', 'warning', `Manifest ${entry.package.runtime}, package ${packageMetadata.runtime}.`),
    entry.package.version === packageMetadata.version
      ? null
      : createIssue('version-scope-differs', 'warning', `Manifest ${entry.package.version}, package ${packageMetadata.version}.`),
  ].filter((issue): issue is AgentSkillExecutionScopeIssue => Boolean(issue));
}

function createInputIssues(entry: AgentSkillManifestEntry | undefined, packageInputKeys: string[]) {
  if (!entry) {
    return [];
  }
  const allowedKeys = new Set(entry.inputKeys);
  const packageKeys = new Set(packageInputKeys);
  const unknownKeys = packageInputKeys.filter((key) => !allowedKeys.has(key));
  const missingRequiredKeys = entry.requiredInputKeys.filter((key) => !packageKeys.has(key));
  return [
    unknownKeys.length
      ? createIssue('input-scope-unknown-key', 'blocked', `Unknown input key(s): ${unknownKeys.join(', ')}.`)
      : null,
    missingRequiredKeys.length
      ? createIssue('input-scope-required-missing', 'blocked', `Missing required input key(s): ${missingRequiredKeys.join(', ')}.`)
      : null,
  ].filter((issue): issue is AgentSkillExecutionScopeIssue => Boolean(issue));
}

function createContractIssues(contractStatus: AgentSkillInstalledPackageHandlerContractStatus) {
  return contractStatus === 'valid'
    ? []
    : [createIssue('handler-contract-not-valid', 'blocked', `Handler contract is ${contractStatus}.`)];
}

function createBoundaryIssues(boundaryStatus: AgentSkillInstalledPackageLoaderBoundaryStatus | 'missing') {
  return boundaryStatus === 'execution-ready'
    ? []
    : [createIssue('execution-boundary-not-ready', 'blocked', `Execution boundary is ${boundaryStatus}.`)];
}

function createPermissionIssues(permissionScope: string, permissionBoundary: string) {
  if (!permissionScope || !permissionBoundary || permissionScope === permissionBoundary) {
    return [];
  }
  return [createIssue('permission-scope-mismatch', 'blocked', `${permissionScope} does not match ${permissionBoundary}.`)];
}

function createSandboxIssues(contractSandbox: string, boundarySandbox: string) {
  if (!contractSandbox || !boundarySandbox || contractSandbox === boundarySandbox) {
    return [];
  }
  return [createIssue('sandbox-scope-mismatch', 'blocked', `${contractSandbox} does not match ${boundarySandbox}.`)];
}

function resolveStatus(issues: AgentSkillExecutionScopeIssue[]): AgentSkillExecutionScopeStatus {
  if (issues.some((issue) => issue.severity === 'blocked')) {
    return 'blocked';
  }
  return issues.length ? 'review-required' : 'scoped';
}

function createSummary(rows: AgentSkillExecutionScopeRow[]) {
  const summary = { blocked: 0, 'review-required': 0, scoped: 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function createAgentSkillExecutionScopeReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  options: AgentSkillExecutionScopeReportOptions = {},
): AgentSkillExecutionScopeReport {
  const manifestById = new Map<string, AgentSkillManifestEntry>(
    createAgentSkillManifest().entries.map((entry) => [entry.id, entry]),
  );
  const contractReport = createAgentSkillInstalledPackageHandlerContractReport(installedRegistry, previewRegistry);
  const contractByPackageId = new Map(contractReport.rows.map((row) => [row.packageId, row]));
  const boundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(installedRegistry, options);
  const boundaryByPackageId = new Map(boundaryReport.rows.map((row) => [row.packageId, row]));
  const rows = installedRegistry.packages.map((item): AgentSkillExecutionScopeRow => {
    const entry = manifestById.get(item.skillId);
    const contract = contractByPackageId.get(item.id);
    const boundary = boundaryByPackageId.get(item.id);
    const packageInputKeys = getPackageInputKeys(item);
    const issues = [
      ...createManifestIssues(entry, item),
      ...createInputIssues(entry, packageInputKeys),
      ...createContractIssues(contract?.status ?? 'missing'),
      ...createBoundaryIssues(boundary?.status ?? 'missing'),
      ...createPermissionIssues(contract?.contract?.permissionScope ?? '', boundary?.permissionBoundary ?? ''),
      ...createSandboxIssues(contract?.contract?.sandboxBoundary ?? '', boundary?.sandboxBoundary ?? ''),
    ];
    return {
      allowedInputKeys: entry?.inputKeys ?? [],
      boundaryStatus: boundary?.status ?? 'missing',
      contractStatus: contract?.status ?? 'missing',
      handlerRegistration: boundary?.handlerRegistration ?? 'missing',
      issues,
      packageId: item.id,
      packageInputKeys,
      permissionBoundary: boundary?.permissionBoundary ?? 'unavailable',
      permissionScope: contract?.contract?.permissionScope ?? 'unavailable',
      requiredInputKeys: entry?.requiredInputKeys ?? [],
      runtime: item.package.scaffold.package.runtime,
      sandboxBoundary: boundary?.sandboxBoundary ?? 'unavailable',
      skillId: item.skillId,
      status: resolveStatus(issues),
    };
  });
  return { rows, summary: createSummary(rows) };
}
