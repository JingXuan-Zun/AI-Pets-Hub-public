import {
  AGENT_SKILL_PACKAGE_LIFECYCLE_KIND,
  createEmptyAgentSkillPackageLifecycleState,
  type AgentSkillPackageLifecycleAction,
  type AgentSkillPackageLifecycleReceipt,
  type AgentSkillPackageLifecycleState,
  type AgentSkillPackageQuarantineRecord,
  type AgentSkillPackageRollbackSnapshot,
  type AgentSkillPackageUninstallSnapshot,
} from './agentSkillPackageLifecycle';
import {
  parseAgentSkillInstalledPackageRegistryJson,
  type AgentSkillInstalledPackage,
} from './agentSkillPackageInstalledRegistry';

const MAX_AUDIT_RECEIPTS = 96;
const MAX_QUARANTINED_PACKAGES = 24;
const MAX_ROLLBACK_SNAPSHOTS = 48;
const VALID_ACTIONS = new Set<AgentSkillPackageLifecycleAction>([
  'blocked', 'installed', 'quarantined', 'replaced', 'restored', 'rolled-back', 'uninstalled', 'unchanged',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

function parsePackage(value: unknown): AgentSkillInstalledPackage | null {
  const registry = parseAgentSkillInstalledPackageRegistryJson(JSON.stringify({ packages: [value] }));
  return registry.packages[0] ?? null;
}

function parseReceipt(value: unknown): AgentSkillPackageLifecycleReceipt | null {
  if (!isRecord(value) || !VALID_ACTIONS.has(value.action as AgentSkillPackageLifecycleAction)) {
    return null;
  }
  const id = text(value.id);
  const packageId = text(value.packageId);
  const skillId = text(value.skillId);
  if (!id || !packageId || !skillId) {
    return null;
  }
  return { action: value.action as AgentSkillPackageLifecycleAction, at: text(value.at), id, issueCodes: textList(value.issueCodes), packageId, skillId };
}

function parseQuarantine(value: unknown): AgentSkillPackageQuarantineRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const packageItem = parsePackage(value.package);
  return packageItem ? { package: packageItem, quarantinedAt: text(value.quarantinedAt), reasonCodes: textList(value.reasonCodes) } : null;
}

function parseSnapshot(value: unknown): AgentSkillPackageRollbackSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = text(value.id);
  const replacementPackageId = text(value.replacementPackageId);
  const packageItem = parsePackage(value.package);
  if (!id || !replacementPackageId || !packageItem) {
    return null;
  }
  return { createdAt: text(value.createdAt), id, package: packageItem, replacementPackageId };
}

function parseUninstallSnapshot(value: unknown): AgentSkillPackageUninstallSnapshot | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const packageItem = parsePackage(value.package);
  return id && packageItem ? { createdAt: text(value.createdAt), id, package: packageItem } : null;
}

function parseRows<T>(value: unknown, parse: (item: unknown) => T | null, max: number) {
  return Array.isArray(value) ? value.map(parse).filter((item): item is T => Boolean(item)).slice(0, max) : [];
}

export function serializeAgentSkillPackageLifecycleState(state: AgentSkillPackageLifecycleState) {
  return JSON.stringify({
    auditReceipts: state.auditReceipts.slice(0, MAX_AUDIT_RECEIPTS),
    installedRegistry: state.installedRegistry,
    kind: AGENT_SKILL_PACKAGE_LIFECYCLE_KIND,
    quarantinedPackages: state.quarantinedPackages.slice(0, MAX_QUARANTINED_PACKAGES),
    rollbackSnapshots: state.rollbackSnapshots.slice(0, MAX_ROLLBACK_SNAPSHOTS),
    uninstallSnapshots: state.uninstallSnapshots.slice(0, MAX_ROLLBACK_SNAPSHOTS),
  });
}

export function parseAgentSkillPackageLifecycleState(rawText?: string | null): AgentSkillPackageLifecycleState {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillPackageLifecycleState();
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!isRecord(parsed) || parsed.kind !== AGENT_SKILL_PACKAGE_LIFECYCLE_KIND) {
      return createEmptyAgentSkillPackageLifecycleState();
    }
    return {
      auditReceipts: parseRows(parsed.auditReceipts, parseReceipt, MAX_AUDIT_RECEIPTS),
      installedRegistry: parseAgentSkillInstalledPackageRegistryJson(JSON.stringify(parsed.installedRegistry ?? {})),
      kind: AGENT_SKILL_PACKAGE_LIFECYCLE_KIND,
      quarantinedPackages: parseRows(parsed.quarantinedPackages, parseQuarantine, MAX_QUARANTINED_PACKAGES),
      rollbackSnapshots: parseRows(parsed.rollbackSnapshots, parseSnapshot, MAX_ROLLBACK_SNAPSHOTS),
      uninstallSnapshots: parseRows(parsed.uninstallSnapshots, parseUninstallSnapshot, MAX_ROLLBACK_SNAPSHOTS),
    };
  } catch {
    return createEmptyAgentSkillPackageLifecycleState();
  }
}
