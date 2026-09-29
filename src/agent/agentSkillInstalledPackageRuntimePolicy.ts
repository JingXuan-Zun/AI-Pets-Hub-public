import {
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';
import {
  type AgentSkillInstalledPackageRuntimePreflightOptions,
} from './agentSkillInstalledPackageRuntimePreflight';

export const AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND = 'agent-skill-installed-runtime-policy.v1';
const MAX_AGENT_SKILL_RUNTIME_POLICY_RECORDS = 24;

export interface AgentSkillInstalledPackageRuntimePolicyRecord {
  packageId: string;
  reviewedAt: string | null;
  runtimeEnabled: boolean;
  sandboxed: boolean;
  skillId: string;
  trusted: boolean;
}

export interface AgentSkillInstalledPackageRuntimePolicy {
  kind: typeof AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND;
  records: AgentSkillInstalledPackageRuntimePolicyRecord[];
}

export interface AgentSkillInstalledPackageRuntimePolicyPatch {
  runtimeEnabled?: boolean;
  sandboxed?: boolean;
  trusted?: boolean;
}

export interface AgentSkillInstalledPackageRuntimePolicyResult {
  error: string | null;
  policy: AgentSkillInstalledPackageRuntimePolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePolicyRecord(value: unknown): AgentSkillInstalledPackageRuntimePolicyRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const packageId = getString(value.packageId);
  const skillId = getString(value.skillId);
  if (!packageId || !skillId) {
    return null;
  }
  return {
    packageId,
    reviewedAt: getString(value.reviewedAt) || null,
    runtimeEnabled: value.runtimeEnabled === true,
    sandboxed: value.sandboxed === true,
    skillId,
    trusted: value.trusted === true,
  };
}

export function createEmptyAgentSkillInstalledPackageRuntimePolicy(): AgentSkillInstalledPackageRuntimePolicy {
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND,
    records: [],
  };
}

export function parseAgentSkillInstalledPackageRuntimePolicyJson(
  rawText?: string | null,
): AgentSkillInstalledPackageRuntimePolicy {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillInstalledPackageRuntimePolicy();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const records = isRecord(parsed) && Array.isArray(parsed.records)
    ? parsed.records
      .map(normalizePolicyRecord)
      .filter((record): record is AgentSkillInstalledPackageRuntimePolicyRecord => Boolean(record))
    : [];
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND,
    records: records.slice(0, MAX_AGENT_SKILL_RUNTIME_POLICY_RECORDS),
  };
}

export function serializeAgentSkillInstalledPackageRuntimePolicy(
  policy: AgentSkillInstalledPackageRuntimePolicy,
) {
  return JSON.stringify({
    kind: AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND,
    records: policy.records.slice(0, MAX_AGENT_SKILL_RUNTIME_POLICY_RECORDS),
  });
}

function findInstalledPackage(registry: AgentSkillInstalledPackageRegistry, packageId: string) {
  return registry.packages.find((item) => item.id === packageId) ?? null;
}

function mergePolicyRecord(
  current: AgentSkillInstalledPackageRuntimePolicyRecord | undefined,
  packageId: string,
  skillId: string,
  patch: AgentSkillInstalledPackageRuntimePolicyPatch,
  reviewedAt: string,
): AgentSkillInstalledPackageRuntimePolicyRecord {
  return {
    packageId,
    reviewedAt,
    runtimeEnabled: patch.runtimeEnabled ?? current?.runtimeEnabled ?? false,
    sandboxed: patch.sandboxed ?? current?.sandboxed ?? false,
    skillId,
    trusted: patch.trusted ?? current?.trusted ?? false,
  };
}

export function setAgentSkillInstalledPackageRuntimePolicyRecord(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  registry: AgentSkillInstalledPackageRegistry,
  packageId: string,
  patch: AgentSkillInstalledPackageRuntimePolicyPatch,
  reviewedAt = new Date().toISOString(),
): AgentSkillInstalledPackageRuntimePolicyResult {
  const installedPackage = findInstalledPackage(registry, packageId);
  if (!installedPackage) {
    return { error: 'Installed package record was not found.', policy };
  }
  const current = policy.records.find((record) => record.packageId === packageId);
  const nextRecord = mergePolicyRecord(current, packageId, installedPackage.skillId, patch, reviewedAt);
  return {
    error: null,
    policy: {
      kind: AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND,
      records: [
        nextRecord,
        ...policy.records.filter((record) => record.packageId !== packageId),
      ].slice(0, MAX_AGENT_SKILL_RUNTIME_POLICY_RECORDS),
    },
  };
}

export function removeAgentSkillInstalledPackageRuntimePolicyRecord(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  packageId: string,
): AgentSkillInstalledPackageRuntimePolicy {
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND,
    records: policy.records.filter((record) => record.packageId !== packageId),
  };
}

export function pruneAgentSkillInstalledPackageRuntimePolicy(
  policy: AgentSkillInstalledPackageRuntimePolicy,
  registry: AgentSkillInstalledPackageRegistry,
): AgentSkillInstalledPackageRuntimePolicy {
  const installedIds = new Set(registry.packages.map((item) => item.id));
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_RUNTIME_POLICY_KIND,
    records: policy.records.filter((record) => installedIds.has(record.packageId)),
  };
}

export function createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(
  policy: AgentSkillInstalledPackageRuntimePolicy,
): AgentSkillInstalledPackageRuntimePreflightOptions {
  return {
    runtimeEnabledPackageIds: policy.records.filter((record) => record.runtimeEnabled).map((record) => record.packageId),
    sandboxedPackageIds: policy.records.filter((record) => record.sandboxed).map((record) => record.packageId),
    trustedPackageIds: policy.records.filter((record) => record.trusted).map((record) => record.packageId),
  };
}
