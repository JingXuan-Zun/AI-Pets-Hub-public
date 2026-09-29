import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { createAgentSkillManifest, type AgentSkillManifestEntry } from './agentSkillManifest';

export type AgentSkillInstalledPackageRuntimePreflightStatus = 'blocked' | 'preflight-passed' | 'review-required';
export type AgentSkillInstalledPackageRuntimePreflightIssueSeverity = 'blocked' | 'warning';

export interface AgentSkillInstalledPackageRuntimePreflightIssue {
  code: string;
  detail: string;
  severity: AgentSkillInstalledPackageRuntimePreflightIssueSeverity;
}

export interface AgentSkillInstalledPackageRuntimePreflightOptions {
  handlerPreviewPackageIds?: readonly string[];
  loaderPackageIds?: readonly string[];
  runtimeEnabledPackageIds?: readonly string[];
  sandboxedPackageIds?: readonly string[];
  trustedPackageIds?: readonly string[];
}

export interface AgentSkillInstalledPackageRuntimePreflightRow {
  handlerSource: 'none' | 'preview' | 'registered-loader';
  issues: AgentSkillInstalledPackageRuntimePreflightIssue[];
  packageId: string;
  permissionRoute: string;
  runtimeGateEnabled: boolean;
  sandboxBoundary: 'declared' | 'missing';
  skillId: string;
  status: AgentSkillInstalledPackageRuntimePreflightStatus;
  trustState: 'trusted' | 'untrusted' | 'unknown-skill';
}

export interface AgentSkillInstalledPackageRuntimePreflightReport {
  rows: AgentSkillInstalledPackageRuntimePreflightRow[];
  summary: Record<AgentSkillInstalledPackageRuntimePreflightStatus, number> & { total: number };
}

function createIssue(
  code: string,
  severity: AgentSkillInstalledPackageRuntimePreflightIssueSeverity,
  detail: string,
): AgentSkillInstalledPackageRuntimePreflightIssue {
  return { code, detail, severity };
}

function hasId(ids: readonly string[] | undefined, packageId: string) {
  return Boolean(ids?.includes(packageId));
}

function resolvePermissionRoute(entry: AgentSkillManifestEntry | undefined) {
  if (!entry) {
    return 'unavailable';
  }
  if (entry.risk === 'action') {
    return 'agent-action-approval';
  }
  return entry.risk === 'visual' ? 'agent-visual-approval' : 'agent-read-policy';
}

function createMetadataIssues(
  entry: AgentSkillManifestEntry | undefined,
  runtime: string,
  version: string,
) {
  if (!entry) {
    return [createIssue('unknown-skill', 'blocked', 'Installed package targets an unregistered Skill.')];
  }
  return [
    entry.package.runtime === runtime
      ? null
      : createIssue('runtime-differs', 'warning', `Registry ${entry.package.runtime}, package ${runtime}.`),
    entry.package.version === version
      ? null
      : createIssue('version-differs', 'warning', `Registry ${entry.package.version}, package ${version}.`),
  ].filter((issue): issue is AgentSkillInstalledPackageRuntimePreflightIssue => Boolean(issue));
}

function createGateIssues(options: {
  handlerReady: boolean;
  handlerPreview: boolean;
  runtimeGateEnabled: boolean;
  sandboxReady: boolean;
  trusted: boolean;
}) {
  return [
    options.runtimeGateEnabled
      ? null
      : createIssue('runtime-enable-missing', 'blocked', 'Runtime enablement must come from a separate trusted policy, not installation alone.'),
    options.trusted
      ? null
      : createIssue('trust-missing', 'blocked', 'No trusted reviewer/source/signature evidence is attached to this package.'),
    options.sandboxReady
      ? null
      : createIssue('sandbox-missing', 'blocked', 'No sandbox boundary has been declared for executable package loading.'),
    options.handlerReady
      ? null
      : options.handlerPreview
        ? createIssue('loader-preview-only', 'blocked', 'A handler preview is registered, but no executable loader is available.')
        : createIssue('loader-missing', 'blocked', 'No executable Skill package loader is registered for this package.'),
  ].filter((issue): issue is AgentSkillInstalledPackageRuntimePreflightIssue => Boolean(issue));
}

function resolveStatus(
  issues: AgentSkillInstalledPackageRuntimePreflightIssue[],
): AgentSkillInstalledPackageRuntimePreflightStatus {
  if (issues.some((issue) => issue.severity === 'blocked')) {
    return 'blocked';
  }
  return issues.length ? 'review-required' : 'preflight-passed';
}

export function createAgentSkillInstalledPackageRuntimePreflightReport(
  registry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillInstalledPackageRuntimePreflightOptions = {},
): AgentSkillInstalledPackageRuntimePreflightReport {
  const manifestById = new Map<string, AgentSkillManifestEntry>(
    createAgentSkillManifest().entries.map((entry) => [entry.id, entry]),
  );
  const rows = registry.packages.map((item): AgentSkillInstalledPackageRuntimePreflightRow => {
    const entry = manifestById.get(item.skillId);
    const runtimeGateEnabled = hasId(options.runtimeEnabledPackageIds, item.id) || Boolean(item.runtimeEnabled);
    const trusted = hasId(options.trustedPackageIds, item.id);
    const sandboxReady = hasId(options.sandboxedPackageIds, item.id);
    const handlerReady = hasId(options.loaderPackageIds, item.id);
    const handlerPreview = hasId(options.handlerPreviewPackageIds, item.id);
    const issues = [
      ...createMetadataIssues(entry, item.package.scaffold.package.runtime, item.package.scaffold.package.version),
      ...createGateIssues({ handlerPreview, handlerReady, runtimeGateEnabled, sandboxReady, trusted }),
    ];
    return {
      handlerSource: handlerReady ? 'registered-loader' : handlerPreview ? 'preview' : 'none',
      issues,
      packageId: item.id,
      permissionRoute: resolvePermissionRoute(entry),
      runtimeGateEnabled,
      sandboxBoundary: sandboxReady ? 'declared' : 'missing',
      skillId: item.skillId,
      status: resolveStatus(issues),
      trustState: entry ? (trusted ? 'trusted' : 'untrusted') : 'unknown-skill',
    };
  });
  const summary = { blocked: 0, 'preflight-passed': 0, 'review-required': 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return { rows, summary };
}
