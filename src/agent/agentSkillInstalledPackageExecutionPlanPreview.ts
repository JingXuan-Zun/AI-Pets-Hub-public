import {
  createAgentSkillExecutableHandlerGuardReport,
} from './agentSkillInstalledPackageExecutableHandlerGuard';
import {
  createAgentSkillInstalledPackageHandlerContractReport,
} from './agentSkillInstalledPackageHandlerContract';
import { type AgentSkillInstalledPackageHandlerPreviewRegistry } from './agentSkillInstalledPackageHandlerPreviewRegistry';
import {
  createAgentSkillInstalledPackageLoaderBoundaryReport,
} from './agentSkillInstalledPackageLoaderBoundary';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import {
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
  type AgentSkillInstalledPackageRuntimePolicy,
} from './agentSkillInstalledPackageRuntimePolicy';

export const AGENT_SKILL_EXECUTION_PLAN_PREVIEW_KIND = 'agent-skill-execution-plan-preview.v1';

export interface AgentSkillExecutionPlanPreviewRow {
  boundaryId: string | null;
  contractStatus: string;
  guardIssueCodes: string[];
  packageId: string;
  planned: boolean;
  skillId: string;
}

export interface AgentSkillExecutionPlanPreview {
  createdAt: string;
  kind: typeof AGENT_SKILL_EXECUTION_PLAN_PREVIEW_KIND;
  rows: AgentSkillExecutionPlanPreviewRow[];
  summary: {
    blocked: number;
    planned: number;
    total: number;
  };
}

export interface AgentSkillExecutionPlanPreviewOptions {
  executableHandlerPackageIds?: readonly string[];
  trustedPackageIds?: readonly string[];
}

function getPreviewPackageIds(previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry) {
  return previewRegistry.previews.map((preview) => preview.packageId);
}

function createBoundaryByPackageId(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  options: AgentSkillExecutionPlanPreviewOptions,
) {
  const policyOptions = createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(policy);
  const boundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(installedRegistry, {
    ...policyOptions,
    executableHandlerPackageIds: options.executableHandlerPackageIds,
    previewHandlerPackageIds: getPreviewPackageIds(previewRegistry),
    trustedPackageIds: options.trustedPackageIds ?? policyOptions.trustedPackageIds,
  });
  return new Map(boundaryReport.rows.map((row) => [row.packageId, row]));
}

function createContractStatusByPackageId(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
) {
  const contractReport = createAgentSkillInstalledPackageHandlerContractReport(installedRegistry, previewRegistry);
  return new Map(contractReport.rows.map((row) => [row.packageId, row.status]));
}

function createSummary(rows: AgentSkillExecutionPlanPreviewRow[]) {
  const planned = rows.filter((row) => row.planned).length;
  return {
    blocked: rows.length - planned,
    planned,
    total: rows.length,
  };
}

export function createAgentSkillExecutionPlanPreview(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  policy: AgentSkillInstalledPackageRuntimePolicy,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  createdAt = new Date().toISOString(),
  options: AgentSkillExecutionPlanPreviewOptions = {},
): AgentSkillExecutionPlanPreview {
  const guardReport = createAgentSkillExecutableHandlerGuardReport(installedRegistry, policy, previewRegistry, {
    trustedPackageIds: options.trustedPackageIds,
  });
  const guardByPackageId = new Map(guardReport.rows.map((row) => [row.packageId, row]));
  const boundaryByPackageId = createBoundaryByPackageId(installedRegistry, policy, previewRegistry, options);
  const contractStatusByPackageId = createContractStatusByPackageId(installedRegistry, previewRegistry);
  const rows = installedRegistry.packages.map((item): AgentSkillExecutionPlanPreviewRow => {
    const guard = guardByPackageId.get(item.id);
    return {
      boundaryId: boundaryByPackageId.get(item.id)?.boundaryId ?? null,
      contractStatus: contractStatusByPackageId.get(item.id) ?? 'missing',
      guardIssueCodes: guard?.guardIssueCodes ?? ['guard-missing'],
      packageId: item.id,
      planned: Boolean(guard?.canRegister),
      skillId: item.skillId,
    };
  });
  return {
    createdAt,
    kind: AGENT_SKILL_EXECUTION_PLAN_PREVIEW_KIND,
    rows,
    summary: createSummary(rows),
  };
}
