import { type AgentSkillDefinition } from './agentSkillDefinitions';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import {
  createAgentSkillInstalledPackageRuntimePreflightReport,
  type AgentSkillInstalledPackageRuntimePreflightOptions,
  type AgentSkillInstalledPackageRuntimePreflightStatus,
} from './agentSkillInstalledPackageRuntimePreflight';

type AgentSkillPackageRuntime = AgentSkillDefinition['package']['runtime'];

export type AgentSkillInstalledPackageLoaderBoundaryStatus =
  | 'execution-ready'
  | 'metadata-only'
  | 'review-required'
  | 'unavailable';

export interface AgentSkillInstalledPackageLoaderBoundaryOptions
  extends Omit<AgentSkillInstalledPackageRuntimePreflightOptions, 'loaderPackageIds'> {
  executableHandlerPackageIds?: readonly string[];
  previewHandlerPackageIds?: readonly string[];
}

export interface AgentSkillPackageLoaderBoundaryDescriptor {
  boundaryId: string;
  boundaryMode: 'metadata-only';
  permissionBoundary: string;
  runtime: AgentSkillPackageRuntime;
  sandboxBoundary: string;
}

export interface AgentSkillInstalledPackageLoaderBoundaryRow {
  boundaryId: string | null;
  boundaryMode: 'metadata-only' | 'none';
  executableHandlerRegistered: boolean;
  handlerRegistration: 'missing' | 'preview' | 'registered';
  packageId: string;
  permissionBoundary: string;
  preflightIssueCodes: string[];
  preflightIssueCount: number;
  preflightStatus: AgentSkillInstalledPackageRuntimePreflightStatus;
  runtime: string;
  sandboxBoundary: string;
  skillId: string;
  status: AgentSkillInstalledPackageLoaderBoundaryStatus;
}

export interface AgentSkillInstalledPackageLoaderBoundaryReport {
  rows: AgentSkillInstalledPackageLoaderBoundaryRow[];
  summary: Record<AgentSkillInstalledPackageLoaderBoundaryStatus, number> & { total: number };
}

const LOADER_BOUNDARY_BY_RUNTIME: Record<AgentSkillPackageRuntime, AgentSkillPackageLoaderBoundaryDescriptor> = {
  'external-mcp': {
    boundaryId: 'mcp-tool-boundary',
    boundaryMode: 'metadata-only',
    permissionBoundary: 'mcp-approval-policy',
    runtime: 'external-mcp',
    sandboxBoundary: 'stdio-mcp-session-pool',
  },
  hybrid: {
    boundaryId: 'hybrid-agent-mcp-boundary',
    boundaryMode: 'metadata-only',
    permissionBoundary: 'agent-action-and-mcp-policy',
    runtime: 'hybrid',
    sandboxBoundary: 'agent-runtime-plus-mcp-approval',
  },
  local: {
    boundaryId: 'local-agent-boundary',
    boundaryMode: 'metadata-only',
    permissionBoundary: 'agent-action-policy',
    runtime: 'local',
    sandboxBoundary: 'local-agent-runtime',
  },
  'platform-tool': {
    boundaryId: 'platform-tool-boundary',
    boundaryMode: 'metadata-only',
    permissionBoundary: 'agent-tool-policy',
    runtime: 'platform-tool',
    sandboxBoundary: 'agent-tool-permission-router',
  },
};

function resolveBoundaryDescriptor(runtime: string) {
  return Object.prototype.hasOwnProperty.call(LOADER_BOUNDARY_BY_RUNTIME, runtime)
    ? LOADER_BOUNDARY_BY_RUNTIME[runtime as AgentSkillPackageRuntime]
    : null;
}

function resolveBoundaryStatus(
  descriptor: AgentSkillPackageLoaderBoundaryDescriptor | null,
  preflightStatus: AgentSkillInstalledPackageRuntimePreflightStatus,
): AgentSkillInstalledPackageLoaderBoundaryStatus {
  if (!descriptor) {
    return 'unavailable';
  }
  if (preflightStatus === 'preflight-passed') {
    return 'execution-ready';
  }
  return preflightStatus === 'review-required' ? 'review-required' : 'metadata-only';
}

function createSummary(rows: AgentSkillInstalledPackageLoaderBoundaryRow[]) {
  const summary = { 'execution-ready': 0, 'metadata-only': 0, 'review-required': 0, total: rows.length, unavailable: 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function createAgentSkillInstalledPackageLoaderBoundaryReport(
  registry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillInstalledPackageLoaderBoundaryOptions = {},
): AgentSkillInstalledPackageLoaderBoundaryReport {
  const preflightReport = createAgentSkillInstalledPackageRuntimePreflightReport(registry, {
    loaderPackageIds: options.executableHandlerPackageIds,
    handlerPreviewPackageIds: options.previewHandlerPackageIds,
    runtimeEnabledPackageIds: options.runtimeEnabledPackageIds,
    sandboxedPackageIds: options.sandboxedPackageIds,
    trustedPackageIds: options.trustedPackageIds,
  });
  const preflightByPackageId = new Map(preflightReport.rows.map((row) => [row.packageId, row]));
  const rows = registry.packages.map((item): AgentSkillInstalledPackageLoaderBoundaryRow => {
    const runtime = item.package.scaffold.package.runtime;
    const descriptor = resolveBoundaryDescriptor(runtime);
    const preflight = preflightByPackageId.get(item.id);
    const preflightStatus = preflight?.status ?? 'blocked';
    const issueCodes = preflight?.issues.map((issue) => issue.code) ?? ['preflight-missing'];
    const handlerRegistration = options.executableHandlerPackageIds?.includes(item.id)
      ? 'registered'
      : options.previewHandlerPackageIds?.includes(item.id)
        ? 'preview'
        : 'missing';
    return {
      boundaryId: descriptor?.boundaryId ?? null,
      boundaryMode: descriptor?.boundaryMode ?? 'none',
      executableHandlerRegistered: handlerRegistration === 'registered',
      handlerRegistration,
      packageId: item.id,
      permissionBoundary: descriptor?.permissionBoundary ?? 'unavailable',
      preflightIssueCodes: issueCodes,
      preflightIssueCount: issueCodes.length,
      preflightStatus,
      runtime,
      sandboxBoundary: descriptor?.sandboxBoundary ?? 'unavailable',
      skillId: item.skillId,
      status: resolveBoundaryStatus(descriptor, preflightStatus),
    };
  });
  return { rows, summary: createSummary(rows) };
}
