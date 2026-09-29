import {
  type AgentSkillInstalledPackageHandlerPreview,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
} from './agentSkillInstalledPackageHandlerPreviewRegistry';
import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export type AgentSkillInstalledPackageHandlerContractStatus = 'invalid' | 'missing' | 'valid';

export interface AgentSkillInstalledPackageHandlerContract {
  handlerId: string;
  inputContract: 'json-object';
  packageId: string;
  permissionScope: string;
  receiptShape: 'agent-runtime-result';
  sandboxBoundary: string;
  skillId: string;
}

export interface AgentSkillInstalledPackageHandlerContractRow {
  contract: AgentSkillInstalledPackageHandlerContract | null;
  issues: string[];
  packageId: string;
  skillId: string;
  status: AgentSkillInstalledPackageHandlerContractStatus;
}

export interface AgentSkillInstalledPackageHandlerContractReport {
  rows: AgentSkillInstalledPackageHandlerContractRow[];
  summary: Record<AgentSkillInstalledPackageHandlerContractStatus, number> & { total: number };
}

function resolvePermissionScope(runtime: string) {
  if (runtime === 'external-mcp') {
    return 'mcp-approval-policy';
  }
  if (runtime === 'platform-tool') {
    return 'agent-tool-policy';
  }
  return runtime === 'hybrid' ? 'agent-action-and-mcp-policy' : 'agent-action-policy';
}

function resolveSandboxBoundary(runtime: string) {
  if (runtime === 'external-mcp') {
    return 'stdio-mcp-session-pool';
  }
  if (runtime === 'platform-tool') {
    return 'agent-tool-permission-router';
  }
  return runtime === 'hybrid' ? 'agent-runtime-plus-mcp-approval' : 'local-agent-runtime';
}

function getInstalledRuntime(installedRegistry: AgentSkillInstalledPackageRegistry, packageId: string) {
  return installedRegistry.packages.find((item) => item.id === packageId)?.package.scaffold.package.runtime ?? '';
}

function createContract(
  preview: AgentSkillInstalledPackageHandlerPreview,
  installedRegistry: AgentSkillInstalledPackageRegistry,
): AgentSkillInstalledPackageHandlerContract | null {
  const runtime = getInstalledRuntime(installedRegistry, preview.packageId);
  if (!runtime) {
    return null;
  }
  return {
    handlerId: preview.handlerId,
    inputContract: 'json-object',
    packageId: preview.packageId,
    permissionScope: resolvePermissionScope(runtime),
    receiptShape: 'agent-runtime-result',
    sandboxBoundary: resolveSandboxBoundary(runtime),
    skillId: preview.skillId,
  };
}

function validateContract(contract: AgentSkillInstalledPackageHandlerContract | null) {
  if (!contract) {
    return ['contract-missing'];
  }
  return [
    contract.inputContract === 'json-object' ? '' : 'input-contract-missing',
    contract.permissionScope ? '' : 'permission-scope-missing',
    contract.receiptShape === 'agent-runtime-result' ? '' : 'receipt-shape-missing',
    contract.sandboxBoundary ? '' : 'sandbox-boundary-missing',
  ].filter(Boolean);
}

function createSummary(rows: AgentSkillInstalledPackageHandlerContractRow[]) {
  const summary = { invalid: 0, missing: 0, total: rows.length, valid: 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

function resolveStatus(issues: string[]): AgentSkillInstalledPackageHandlerContractStatus {
  if (issues.includes('contract-missing')) {
    return 'missing';
  }
  return issues.length ? 'invalid' : 'valid';
}

export function createAgentSkillInstalledPackageHandlerContractReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
): AgentSkillInstalledPackageHandlerContractReport {
  const previewByPackageId = new Map(previewRegistry.previews.map((preview) => [preview.packageId, preview]));
  const rows = installedRegistry.packages.map((item): AgentSkillInstalledPackageHandlerContractRow => {
    const preview = previewByPackageId.get(item.id) ?? null;
    const contract = preview ? createContract(preview, installedRegistry) : null;
    const issues = validateContract(contract);
    return {
      contract,
      issues,
      packageId: item.id,
      skillId: item.skillId,
      status: resolveStatus(issues),
    };
  });
  return { rows, summary: createSummary(rows) };
}
