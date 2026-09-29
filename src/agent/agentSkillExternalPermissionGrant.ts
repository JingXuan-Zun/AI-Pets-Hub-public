import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';

export const AGENT_SKILL_EXTERNAL_PERMISSION_GRANT_KIND = 'agent-skill-external-permission-grant.v1';
const MAX_PERMISSION_GRANTS = 24;

export const AGENT_SKILL_EXTERNAL_PERMISSION_SCOPES = [
  'filesystem.read',
  'filesystem.write',
  'network.connect',
  'screen.read',
  'desktop.control',
  'message.send',
  'commerce.execute',
  'process.execute',
  'storage.read',
  'storage.write',
] as const;

export type AgentSkillExternalPermissionScope = (typeof AGENT_SKILL_EXTERNAL_PERMISSION_SCOPES)[number];
export type AgentSkillExternalPermissionDecisionStatus = 'allowed' | 'denied';

export interface AgentSkillExternalPermissionGrant {
  packageId: string;
  reviewedAt: string;
  scopes: AgentSkillExternalPermissionScope[];
  skillId: string;
}

export interface AgentSkillExternalPermissionGrantRegistry {
  grants: AgentSkillExternalPermissionGrant[];
  kind: typeof AGENT_SKILL_EXTERNAL_PERMISSION_GRANT_KIND;
}

export interface AgentSkillExternalPermissionDecision {
  allowedScopes: AgentSkillExternalPermissionScope[];
  issueCodes: string[];
  packageId: string;
  requestedScopes: string[];
  status: AgentSkillExternalPermissionDecisionStatus;
}

export interface AgentSkillExternalPermissionGrantResult {
  error: string | null;
  registry: AgentSkillExternalPermissionGrantRegistry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isScope(value: string): value is AgentSkillExternalPermissionScope {
  return (AGENT_SKILL_EXTERNAL_PERMISSION_SCOPES as readonly string[]).includes(value);
}

function uniqueScopes(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(isScope))];
}

function normalizeGrant(value: unknown): AgentSkillExternalPermissionGrant | null {
  if (!isRecord(value)) {
    return null;
  }
  const packageId = text(value.packageId);
  const skillId = text(value.skillId);
  if (!packageId || !skillId) {
    return null;
  }
  return {
    packageId,
    reviewedAt: text(value.reviewedAt) || new Date(0).toISOString(),
    scopes: uniqueScopes(Array.isArray(value.scopes) ? value.scopes.filter((item): item is string => typeof item === 'string') : []),
    skillId,
  };
}

function findPackage(registry: AgentSkillInstalledPackageRegistry, packageId: string) {
  return registry.packages.find((item) => item.id === packageId) ?? null;
}

export function createEmptyAgentSkillExternalPermissionGrantRegistry(): AgentSkillExternalPermissionGrantRegistry {
  return { grants: [], kind: AGENT_SKILL_EXTERNAL_PERMISSION_GRANT_KIND };
}

export function parseAgentSkillExternalPermissionGrantRegistryJson(
  rawText?: string | null,
): AgentSkillExternalPermissionGrantRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillExternalPermissionGrantRegistry();
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    const grants = isRecord(parsed) && Array.isArray(parsed.grants)
      ? parsed.grants.map(normalizeGrant).filter((item): item is AgentSkillExternalPermissionGrant => Boolean(item))
      : [];
    return { grants: grants.slice(0, MAX_PERMISSION_GRANTS), kind: AGENT_SKILL_EXTERNAL_PERMISSION_GRANT_KIND };
  } catch {
    return createEmptyAgentSkillExternalPermissionGrantRegistry();
  }
}

export function serializeAgentSkillExternalPermissionGrantRegistry(
  registry: AgentSkillExternalPermissionGrantRegistry,
) {
  return JSON.stringify({
    grants: registry.grants.slice(0, MAX_PERMISSION_GRANTS),
    kind: AGENT_SKILL_EXTERNAL_PERMISSION_GRANT_KIND,
  });
}

export function setAgentSkillExternalPermissionGrant(
  registry: AgentSkillExternalPermissionGrantRegistry,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  packageId: string,
  scopes: readonly string[],
  reviewedAt = new Date().toISOString(),
): AgentSkillExternalPermissionGrantResult {
  const packageItem = findPackage(installedRegistry, packageId);
  if (!packageItem) {
    return { error: 'Installed package record was not found.', registry };
  }
  const requestedScopes = scopes.map((scope) => scope.trim()).filter(Boolean);
  if (requestedScopes.some((scope) => !isScope(scope))) {
    return { error: 'Permission grant contains an unsupported scope.', registry };
  }
  const grant = { packageId, reviewedAt, scopes: uniqueScopes(requestedScopes), skillId: packageItem.skillId };
  return {
    error: null,
    registry: {
      grants: [grant, ...registry.grants.filter((item) => item.packageId !== packageId)].slice(0, MAX_PERMISSION_GRANTS),
      kind: AGENT_SKILL_EXTERNAL_PERMISSION_GRANT_KIND,
    },
  };
}

export function createAgentSkillExternalPermissionDecision(
  registry: AgentSkillExternalPermissionGrantRegistry,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  packageId: string,
  requestedScopes: readonly string[],
): AgentSkillExternalPermissionDecision {
  const packageItem = findPackage(installedRegistry, packageId);
  const grant = registry.grants.find((item) => item.packageId === packageId);
  const requested = requestedScopes.map((scope) => scope.trim()).filter(Boolean);
  const unknownScopes = requested.filter((scope) => !isScope(scope));
  const allowedScopes = grant?.scopes ?? [];
  const missingScopes = requested.filter((scope) => !allowedScopes.includes(scope as AgentSkillExternalPermissionScope));
  const issueCodes = [
    packageItem ? '' : 'permission-package-not-installed',
    grant && grant.skillId === packageItem?.skillId ? '' : 'permission-grant-missing-or-stale',
    unknownScopes.length ? 'permission-scope-unsupported' : '',
    missingScopes.length ? 'permission-scope-not-granted' : '',
  ].filter(Boolean);
  return {
    allowedScopes,
    issueCodes,
    packageId,
    requestedScopes: requested,
    status: issueCodes.length ? 'denied' : 'allowed',
  };
}
