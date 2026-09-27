import {
  AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
  type AgentSkillInstalledPackage,
} from './agentSkillPackageInstalledRegistry';
import {
  type AgentSkillPackageLifecycleAction,
  type AgentSkillPackageLifecycleState,
} from './agentSkillPackageLifecycle';
import { AGENT_SKILL_PACKAGE_KIND, type AgentSkillPackageExport } from './agentSkillPackageExchange';

const MAX_AGENT_SKILL_INSTALLED_PACKAGES = 24;
const MAX_AGENT_SKILL_PACKAGE_LIFECYCLE_RECEIPTS = 96;

export interface AgentSkillSignedArchiveIdentity {
  packageId: string;
  publisherId: string;
  skillId: string;
  version: string;
}

export interface AgentSkillSignedArchiveInstallInput {
  identity: AgentSkillSignedArchiveIdentity;
  installedAt?: string;
  packageJson: string;
  status: 'installed' | 'updated';
}

export interface AgentSkillSignedArchiveInstallResult {
  action: 'installed' | 'replaced';
  error: string | null;
  package: AgentSkillInstalledPackage | null;
  state: AgentSkillPackageLifecycleState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseVerifiedPackage(
  packageJson: string,
  identity: AgentSkillSignedArchiveIdentity,
): AgentSkillPackageExport | null {
  try {
    const packageValue = JSON.parse(packageJson) as unknown;
    if (!isRecord(packageValue) || packageValue.kind !== AGENT_SKILL_PACKAGE_KIND) return null;
    const publisher = isRecord(packageValue.publisher) ? packageValue.publisher : null;
    const distribution = isRecord(packageValue.distribution) ? packageValue.distribution : null;
    const scaffold = isRecord(packageValue.scaffold) ? packageValue.scaffold : null;
    const skill = scaffold && isRecord(scaffold.skill) ? scaffold.skill : null;
    const packageMetadata = scaffold && isRecord(scaffold.package) ? scaffold.package : null;
    if (
      getString(publisher?.id) !== identity.publisherId
      || getString(distribution?.packageId) !== identity.packageId
      || getString(distribution?.publisherId) !== identity.publisherId
      || getString(distribution?.skillId) !== identity.skillId
      || getString(distribution?.version) !== identity.version
      || getString(skill?.id) !== identity.skillId
      || getString(packageMetadata?.version) !== identity.version
    ) return null;
    return packageValue as unknown as AgentSkillPackageExport;
  } catch {
    return null;
  }
}

export function applyAgentSkillSignedArchiveInstall(
  state: AgentSkillPackageLifecycleState,
  input: AgentSkillSignedArchiveInstallInput,
): AgentSkillSignedArchiveInstallResult {
  const packageValue = parseVerifiedPackage(input.packageJson, input.identity);
  const action = input.status === 'updated' ? 'replaced' : 'installed';
  if (!packageValue) {
    return { action, error: 'signed_archive_verified_package_invalid', package: null, state };
  }
  const installedAt = input.installedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(installedAt))) {
    return { action, error: 'signed_archive_install_timestamp_invalid', package: null, state };
  }
  const installedPackage: AgentSkillInstalledPackage = {
    id: input.identity.packageId,
    installedAt,
    package: packageValue,
    runtimeEnabled: false,
    skillId: input.identity.skillId,
    sourceDraftId: `signed-archive:${input.identity.packageId}@${input.identity.version}`,
  };
  const receiptAction: AgentSkillPackageLifecycleAction = action;
  const receipt = {
    action: receiptAction,
    at: installedAt,
    id: `${installedPackage.id}:${receiptAction}:${installedAt}`,
    issueCodes: ['main-process-signed-archive-verified'],
    packageId: installedPackage.id,
    skillId: installedPackage.skillId,
  };
  return {
    action,
    error: null,
    package: installedPackage,
    state: {
      ...state,
      auditReceipts: [receipt, ...state.auditReceipts]
        .slice(0, MAX_AGENT_SKILL_PACKAGE_LIFECYCLE_RECEIPTS),
      installedRegistry: {
        kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
        packages: [
          installedPackage,
          ...state.installedRegistry.packages.filter((item) => item.id !== installedPackage.id),
        ].slice(0, MAX_AGENT_SKILL_INSTALLED_PACKAGES),
      },
    },
  };
}
