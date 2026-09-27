import {
  type AgentSkillPackageDraft,
  type AgentSkillPackageDraftLibrary,
} from './agentSkillPackageDraftLibrary';
import { createAgentSkillPackageDraftReview } from './agentSkillPackageDraftReview';
import { type AgentSkillPackageExport } from './agentSkillPackageExchange';

export const AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND = 'agent-skill-installed-package-registry.v1';
const MAX_AGENT_SKILL_INSTALLED_PACKAGES = 24;

export interface AgentSkillInstalledPackage {
  id: string;
  installedAt: string;
  package: AgentSkillPackageExport;
  runtimeEnabled: false;
  skillId: string;
  sourceDraftId: string;
}

export interface AgentSkillInstalledPackageRegistry {
  kind: typeof AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND;
  packages: AgentSkillInstalledPackage[];
}

export interface AgentSkillInstalledPackageGateResult {
  installedCount: number;
  registry: AgentSkillInstalledPackageRegistry;
  skippedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createInstalledPackageId(draft: AgentSkillPackageDraft) {
  return `${draft.skillId}@${draft.id}`;
}

function normalizeInstalledPackage(value: unknown): AgentSkillInstalledPackage | null {
  if (!isRecord(value) || !isRecord(value.package)) {
    return null;
  }

  const skillId = getString(value.skillId);
  const sourceDraftId = getString(value.sourceDraftId);
  if (!skillId || !sourceDraftId) {
    return null;
  }

  return {
    id: getString(value.id) || `${skillId}@${sourceDraftId}`,
    installedAt: getString(value.installedAt) || new Date(0).toISOString(),
    package: value.package as unknown as AgentSkillPackageExport,
    runtimeEnabled: false,
    skillId,
    sourceDraftId,
  };
}

export function createEmptyAgentSkillInstalledPackageRegistry(): AgentSkillInstalledPackageRegistry {
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
    packages: [],
  };
}

export function parseAgentSkillInstalledPackageRegistryJson(
  rawText?: string | null,
): AgentSkillInstalledPackageRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillInstalledPackageRegistry();
  }

  const parsed = JSON.parse(rawText) as unknown;
  const packages = isRecord(parsed) && Array.isArray(parsed.packages)
    ? parsed.packages
      .map(normalizeInstalledPackage)
      .filter((item): item is AgentSkillInstalledPackage => Boolean(item))
    : [];
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
    packages: packages.slice(0, MAX_AGENT_SKILL_INSTALLED_PACKAGES),
  };
}

export function serializeAgentSkillInstalledPackageRegistry(
  registry: AgentSkillInstalledPackageRegistry,
) {
  return JSON.stringify({
    kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
    packages: registry.packages.slice(0, MAX_AGENT_SKILL_INSTALLED_PACKAGES),
  });
}

export function createAgentSkillInstalledPackageFromDraft(
  draft: AgentSkillPackageDraft,
  installedAt: string,
): AgentSkillInstalledPackage {
  return {
    id: createInstalledPackageId(draft),
    installedAt,
    package: draft.package,
    runtimeEnabled: false,
    skillId: draft.skillId,
    sourceDraftId: draft.id,
  };
}

export function gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  draftLibrary: AgentSkillPackageDraftLibrary,
  registry: AgentSkillInstalledPackageRegistry,
  installedAt = new Date().toISOString(),
): AgentSkillInstalledPackageGateResult {
  const existingIds = new Set(registry.packages.map((item) => item.id));
  const installableDrafts = draftLibrary.drafts.filter((draft) => {
    const review = createAgentSkillPackageDraftReview(draftLibrary, draft.id);
    return draft.enabled && review?.eligible && !existingIds.has(createInstalledPackageId(draft));
  });
  const nextPackages = [
    ...installableDrafts.map((draft) => createAgentSkillInstalledPackageFromDraft(draft, installedAt)),
    ...registry.packages,
  ].slice(0, MAX_AGENT_SKILL_INSTALLED_PACKAGES);

  return {
    installedCount: installableDrafts.length,
    registry: {
      kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
      packages: nextPackages,
    },
    skippedCount: draftLibrary.drafts.filter((draft) => draft.enabled).length - installableDrafts.length,
  };
}

export function removeAgentSkillInstalledPackage(
  registry: AgentSkillInstalledPackageRegistry,
  packageId: string,
): AgentSkillInstalledPackageRegistry {
  return {
    kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
    packages: registry.packages.filter((item) => item.id !== packageId),
  };
}
