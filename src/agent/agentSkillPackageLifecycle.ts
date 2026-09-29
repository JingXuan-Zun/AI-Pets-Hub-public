import { type AgentSkillPackageDraft, type AgentSkillPackageDraftLibrary } from './agentSkillPackageDraftLibrary';
import {
  createAgentSkillInstalledPackageFromDraft,
  createEmptyAgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackage,
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';
import {
  createAgentSkillSignedPackageUpdateApplicationPreviewReport,
  type AgentSkillSignedPackageUpdateApplicationPreviewOptions,
} from './agentSkillSignedPackageUpdateApplicationPreview';

export const AGENT_SKILL_PACKAGE_LIFECYCLE_KIND = 'agent-skill-package-lifecycle.v1';
const MAX_AUDIT_RECEIPTS = 96;
const MAX_QUARANTINED_PACKAGES = 24;
const MAX_ROLLBACK_SNAPSHOTS = 48;

export type AgentSkillPackageLifecycleAction =
  | 'blocked'
  | 'installed'
  | 'quarantined'
  | 'replaced'
  | 'restored'
  | 'rolled-back'
  | 'uninstalled'
  | 'unchanged';

export interface AgentSkillPackageLifecycleReceipt {
  action: AgentSkillPackageLifecycleAction;
  at: string;
  id: string;
  issueCodes: string[];
  packageId: string;
  skillId: string;
}

export interface AgentSkillPackageQuarantineRecord {
  package: AgentSkillInstalledPackage;
  quarantinedAt: string;
  reasonCodes: string[];
}

export interface AgentSkillPackageRollbackSnapshot {
  createdAt: string;
  id: string;
  package: AgentSkillInstalledPackage;
  replacementPackageId: string;
}

export interface AgentSkillPackageUninstallSnapshot {
  createdAt: string;
  id: string;
  package: AgentSkillInstalledPackage;
}

export interface AgentSkillPackageLifecycleState {
  auditReceipts: AgentSkillPackageLifecycleReceipt[];
  installedRegistry: AgentSkillInstalledPackageRegistry;
  kind: typeof AGENT_SKILL_PACKAGE_LIFECYCLE_KIND;
  quarantinedPackages: AgentSkillPackageQuarantineRecord[];
  rollbackSnapshots: AgentSkillPackageRollbackSnapshot[];
  uninstallSnapshots: AgentSkillPackageUninstallSnapshot[];
}

export interface AgentSkillPackageLifecycleResult {
  action: AgentSkillPackageLifecycleAction;
  issueCodes: string[];
  state: AgentSkillPackageLifecycleState;
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function createReceipt(
  action: AgentSkillPackageLifecycleAction,
  packageItem: AgentSkillInstalledPackage,
  issueCodes: readonly string[],
  at: string,
): AgentSkillPackageLifecycleReceipt {
  return {
    action,
    at,
    id: `${packageItem.id}:${action}:${at}`,
    issueCodes: unique(issueCodes),
    packageId: packageItem.id,
    skillId: packageItem.skillId,
  };
}

function withReceipt(
  state: AgentSkillPackageLifecycleState,
  action: AgentSkillPackageLifecycleAction,
  packageItem: AgentSkillInstalledPackage,
  issueCodes: readonly string[],
  at: string,
): AgentSkillPackageLifecycleState {
  return {
    ...state,
    auditReceipts: [createReceipt(action, packageItem, issueCodes, at), ...state.auditReceipts]
      .slice(0, MAX_AUDIT_RECEIPTS),
  };
}

function findDraft(library: AgentSkillPackageDraftLibrary, draftId: string) {
  return library.drafts.find((item) => item.id === draftId) ?? null;
}

function replaceInstalledPackage(
  registry: AgentSkillInstalledPackageRegistry,
  targetPackageId: string,
  replacement: AgentSkillInstalledPackage,
): AgentSkillInstalledPackageRegistry {
  return {
    kind: registry.kind,
    packages: [replacement, ...registry.packages.filter((item) => item.id !== targetPackageId)],
  };
}

function snapshotFor(
  packageItem: AgentSkillInstalledPackage,
  replacementPackageId: string,
  at: string,
): AgentSkillPackageRollbackSnapshot {
  return {
    createdAt: at,
    id: `${packageItem.id}:rollback:${at}`,
    package: packageItem,
    replacementPackageId,
  };
}

function blockedResult(
  state: AgentSkillPackageLifecycleState,
  issueCodes: readonly string[],
): AgentSkillPackageLifecycleResult {
  return { action: 'blocked', issueCodes: unique(issueCodes), state };
}

function applyInstall(
  state: AgentSkillPackageLifecycleState,
  draft: AgentSkillPackageDraft,
  at: string,
): AgentSkillPackageLifecycleResult {
  const installed = createAgentSkillInstalledPackageFromDraft(draft, at);
  const next = withReceipt({
    ...state,
    installedRegistry: {
      kind: state.installedRegistry.kind,
      packages: [installed, ...state.installedRegistry.packages.filter((item) => item.id !== installed.id)],
    },
  }, 'installed', installed, [], at);
  return { action: 'installed', issueCodes: [], state: next };
}

function applyReplacement(
  state: AgentSkillPackageLifecycleState,
  draft: AgentSkillPackageDraft,
  target: AgentSkillInstalledPackage,
  at: string,
): AgentSkillPackageLifecycleResult {
  const replacement = createAgentSkillInstalledPackageFromDraft(draft, at);
  const snapshot = snapshotFor(target, replacement.id, at);
  const next = withReceipt({
    ...state,
    installedRegistry: replaceInstalledPackage(state.installedRegistry, target.id, replacement),
    rollbackSnapshots: [snapshot, ...state.rollbackSnapshots].slice(0, MAX_ROLLBACK_SNAPSHOTS),
  }, 'replaced', replacement, [], at);
  return { action: 'replaced', issueCodes: [], state: next };
}

export function createEmptyAgentSkillPackageLifecycleState(): AgentSkillPackageLifecycleState {
  return {
    auditReceipts: [],
    installedRegistry: createEmptyAgentSkillInstalledPackageRegistry(),
    kind: AGENT_SKILL_PACKAGE_LIFECYCLE_KIND,
    quarantinedPackages: [],
    rollbackSnapshots: [],
    uninstallSnapshots: [],
  };
}

export function createAgentSkillPackageLifecycleState(
  installedRegistry = createEmptyAgentSkillInstalledPackageRegistry(),
): AgentSkillPackageLifecycleState {
  return { ...createEmptyAgentSkillPackageLifecycleState(), installedRegistry };
}

export function replaceAgentSkillPackageLifecycleInstalledRegistry(
  state: AgentSkillPackageLifecycleState,
  installedRegistry: AgentSkillInstalledPackageRegistry,
): AgentSkillPackageLifecycleState {
  return { ...state, installedRegistry };
}

export function applyAgentSkillPackageMetadataUpdate(
  state: AgentSkillPackageLifecycleState,
  library: AgentSkillPackageDraftLibrary,
  candidateDraftId: string,
  options: AgentSkillSignedPackageUpdateApplicationPreviewOptions = {},
  appliedAt = new Date().toISOString(),
): AgentSkillPackageLifecycleResult {
  const report = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
    library,
    state.installedRegistry,
    options,
  );
  const row = report.rows.find((item) => item.candidateDraftId === candidateDraftId);
  const draft = findDraft(library, candidateDraftId);
  if (!row || !draft || row.status === 'blocked') {
    return blockedResult(state, row?.issueCodes ?? ['update-candidate-not-found-or-not-eligible']);
  }
  if (row.status === 'unchanged') {
    return { action: 'unchanged', issueCodes: [], state };
  }
  if (row.status === 'install-planned') {
    return applyInstall(state, draft, appliedAt);
  }
  const target = state.installedRegistry.packages.find((item) => item.id === row.targetInstalledPackageId);
  return target ? applyReplacement(state, draft, target, appliedAt) : blockedResult(state, ['replace-target-package-missing']);
}

export function rollbackAgentSkillPackageMetadataUpdate(
  state: AgentSkillPackageLifecycleState,
  snapshotId: string,
  rolledBackAt = new Date().toISOString(),
): AgentSkillPackageLifecycleResult {
  const snapshot = state.rollbackSnapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    return blockedResult(state, ['rollback-snapshot-not-found']);
  }
  const next = withReceipt({
    ...state,
    installedRegistry: replaceInstalledPackage(state.installedRegistry, snapshot.replacementPackageId, snapshot.package),
  }, 'rolled-back', snapshot.package, [], rolledBackAt);
  return { action: 'rolled-back', issueCodes: [], state: next };
}

export function quarantineAgentSkillPackage(
  state: AgentSkillPackageLifecycleState,
  packageId: string,
  reasonCodes: readonly string[],
  quarantinedAt = new Date().toISOString(),
): AgentSkillPackageLifecycleResult {
  const packageItem = state.installedRegistry.packages.find((item) => item.id === packageId);
  if (!packageItem) {
    return blockedResult(state, ['quarantine-package-not-found']);
  }
  const next = withReceipt({
    ...state,
    installedRegistry: {
      kind: state.installedRegistry.kind,
      packages: state.installedRegistry.packages.filter((item) => item.id !== packageId),
    },
    quarantinedPackages: [{ package: packageItem, quarantinedAt, reasonCodes: unique(reasonCodes) }, ...state.quarantinedPackages]
      .slice(0, MAX_QUARANTINED_PACKAGES),
  }, 'quarantined', packageItem, reasonCodes, quarantinedAt);
  return { action: 'quarantined', issueCodes: unique(reasonCodes), state: next };
}

export function restoreAgentSkillPackageFromQuarantine(
  state: AgentSkillPackageLifecycleState,
  packageId: string,
  restoredAt = new Date().toISOString(),
): AgentSkillPackageLifecycleResult {
  const quarantined = state.quarantinedPackages.find((item) => item.package.id === packageId);
  if (!quarantined) return blockedResult(state, ['quarantine-package-not-found']);
  if (state.installedRegistry.packages.some((item) => item.id === packageId)) {
    return blockedResult(state, ['restore-package-already-installed']);
  }
  const next = withReceipt({
    ...state,
    installedRegistry: {
      kind: state.installedRegistry.kind,
      packages: [quarantined.package, ...state.installedRegistry.packages],
    },
    quarantinedPackages: state.quarantinedPackages.filter((item) => item.package.id !== packageId),
  }, 'restored', quarantined.package, [], restoredAt);
  return { action: 'restored', issueCodes: [], state: next };
}

export function uninstallAgentSkillPackage(
  state: AgentSkillPackageLifecycleState,
  packageId: string,
  snapshotId: string,
  uninstalledAt = new Date().toISOString(),
): AgentSkillPackageLifecycleResult {
  const packageItem = state.installedRegistry.packages.find((item) => item.id === packageId);
  if (!packageItem) return blockedResult(state, ['uninstall-package-not-found']);
  if (!snapshotId.trim()) return blockedResult(state, ['uninstall-snapshot-id-missing']);
  const snapshot = { createdAt: uninstalledAt, id: snapshotId, package: packageItem };
  const next = withReceipt({
    ...state,
    installedRegistry: {
      kind: state.installedRegistry.kind,
      packages: state.installedRegistry.packages.filter((item) => item.id !== packageId),
    },
    uninstallSnapshots: [snapshot, ...state.uninstallSnapshots].slice(0, MAX_ROLLBACK_SNAPSHOTS),
  }, 'uninstalled', packageItem, [], uninstalledAt);
  return { action: 'uninstalled', issueCodes: [], state: next };
}

export function rollbackAgentSkillPackageUninstall(
  state: AgentSkillPackageLifecycleState,
  snapshotId: string,
  restoredAt = new Date().toISOString(),
): AgentSkillPackageLifecycleResult {
  const snapshot = state.uninstallSnapshots.find((item) => item.id === snapshotId);
  if (!snapshot) return blockedResult(state, ['uninstall-snapshot-not-found']);
  if (state.installedRegistry.packages.some((item) => item.id === snapshot.package.id)) {
    return blockedResult(state, ['restore-package-already-installed']);
  }
  const next = withReceipt({
    ...state,
    installedRegistry: {
      kind: state.installedRegistry.kind,
      packages: [snapshot.package, ...state.installedRegistry.packages],
    },
    uninstallSnapshots: state.uninstallSnapshots.filter((item) => item.id !== snapshotId),
  }, 'restored', snapshot.package, ['uninstall-rollback'], restoredAt);
  return { action: 'restored', issueCodes: [], state: next };
}
