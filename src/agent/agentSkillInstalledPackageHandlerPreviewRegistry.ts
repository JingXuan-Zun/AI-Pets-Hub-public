import {
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';

export const AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND = 'agent-skill-handler-preview-registry.v1';
const MAX_AGENT_SKILL_HANDLER_PREVIEWS = 24;

export interface AgentSkillInstalledPackageHandlerPreview {
  handlerId: string;
  packageId: string;
  previewedAt: string;
  skillId: string;
  source: 'local-preview' | 'package-manifest';
}

export interface AgentSkillInstalledPackageHandlerPreviewRegistry {
  kind: typeof AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND;
  previews: AgentSkillInstalledPackageHandlerPreview[];
}

export interface AgentSkillInstalledPackageHandlerPreviewResult {
  error: string | null;
  preview: AgentSkillInstalledPackageHandlerPreview | null;
  registry: AgentSkillInstalledPackageHandlerPreviewRegistry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createHandlerId(skillId: string, packageId: string) {
  return `${skillId}:${packageId}:preview`;
}

function normalizePreview(value: unknown): AgentSkillInstalledPackageHandlerPreview | null {
  if (!isRecord(value)) {
    return null;
  }
  const packageId = getString(value.packageId);
  const skillId = getString(value.skillId);
  if (!packageId || !skillId) {
    return null;
  }
  return {
    handlerId: getString(value.handlerId) || createHandlerId(skillId, packageId),
    packageId,
    previewedAt: getString(value.previewedAt) || new Date(0).toISOString(),
    skillId,
    source: value.source === 'package-manifest' ? 'package-manifest' : 'local-preview',
  };
}

export function createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry(): AgentSkillInstalledPackageHandlerPreviewRegistry {
  return {
    kind: AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND,
    previews: [],
  };
}

export function parseAgentSkillInstalledPackageHandlerPreviewRegistryJson(
  rawText?: string | null,
): AgentSkillInstalledPackageHandlerPreviewRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const previews = isRecord(parsed) && Array.isArray(parsed.previews)
    ? parsed.previews
      .map(normalizePreview)
      .filter((preview): preview is AgentSkillInstalledPackageHandlerPreview => Boolean(preview))
    : [];
  return {
    kind: AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND,
    previews: previews.slice(0, MAX_AGENT_SKILL_HANDLER_PREVIEWS),
  };
}

export function serializeAgentSkillInstalledPackageHandlerPreviewRegistry(
  registry: AgentSkillInstalledPackageHandlerPreviewRegistry,
) {
  return JSON.stringify({
    kind: AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND,
    previews: registry.previews.slice(0, MAX_AGENT_SKILL_HANDLER_PREVIEWS),
  });
}

export function createAgentSkillInstalledPackageHandlerPreview(
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  installedRegistry: AgentSkillInstalledPackageRegistry,
  packageId: string,
  previewedAt = new Date().toISOString(),
): AgentSkillInstalledPackageHandlerPreviewResult {
  const installedPackage = installedRegistry.packages.find((item) => item.id === packageId);
  if (!installedPackage) {
    return { error: 'Installed package record was not found.', preview: null, registry: previewRegistry };
  }
  const preview = {
    handlerId: createHandlerId(installedPackage.skillId, installedPackage.id),
    packageId: installedPackage.id,
    previewedAt,
    skillId: installedPackage.skillId,
    source: 'local-preview',
  } satisfies AgentSkillInstalledPackageHandlerPreview;
  return {
    error: null,
    preview,
    registry: {
      kind: AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND,
      previews: [
        preview,
        ...previewRegistry.previews.filter((item) => item.packageId !== packageId),
      ].slice(0, MAX_AGENT_SKILL_HANDLER_PREVIEWS),
    },
  };
}

export function removeAgentSkillInstalledPackageHandlerPreview(
  registry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  packageId: string,
): AgentSkillInstalledPackageHandlerPreviewRegistry {
  return {
    kind: AGENT_SKILL_HANDLER_PREVIEW_REGISTRY_KIND,
    previews: registry.previews.filter((preview) => preview.packageId !== packageId),
  };
}

export function getAgentSkillInstalledPackageHandlerPreviewPackageIds(
  registry: AgentSkillInstalledPackageHandlerPreviewRegistry,
) {
  return registry.previews.map((preview) => preview.packageId);
}
