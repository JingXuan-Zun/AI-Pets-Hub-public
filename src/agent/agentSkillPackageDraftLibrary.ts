import {
  type AgentSkillPackageExport,
  type AgentSkillPackageImportPreview,
  parseAgentSkillPackageImportJson,
} from './agentSkillPackageExchange';

export const AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND = 'agent-skill-package-draft-library.v1';
export const MAX_AGENT_SKILL_PACKAGE_DRAFTS = 24;

export interface AgentSkillPackageDraft {
  enabled: boolean;
  id: string;
  package: AgentSkillPackageExport;
  reviewedAt: string | null;
  savedAt: string;
  skillId: string;
  warnings: string[];
}

export interface AgentSkillPackageDraftLibrary {
  drafts: AgentSkillPackageDraft[];
  kind: typeof AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND;
}

export interface AgentSkillPackageDraftSaveResult {
  draft: AgentSkillPackageDraft | null;
  error: string | null;
  library: AgentSkillPackageDraftLibrary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createDraftId(packageExport: AgentSkillPackageExport) {
  return `${packageExport.scaffold.skill.id}@${packageExport.exportedAt || 'unknown'}`;
}

export function createEmptyAgentSkillPackageDraftLibrary(): AgentSkillPackageDraftLibrary {
  return {
    drafts: [],
    kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
  };
}

function normalizeDraft(value: unknown): AgentSkillPackageDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  const preview = parseAgentSkillPackageImportJson(JSON.stringify(value.package ?? null));
  if (!preview.ok || !preview.package) {
    return null;
  }

  return {
    enabled: value.enabled === true,
    id: getString(value.id) || createDraftId(preview.package),
    package: preview.package,
    reviewedAt: getString(value.reviewedAt) || null,
    savedAt: getString(value.savedAt) || new Date(0).toISOString(),
    skillId: preview.skillId,
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((item) => typeof item === 'string') : [],
  };
}

export function parseAgentSkillPackageDraftLibraryJson(rawText?: string | null): AgentSkillPackageDraftLibrary {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillPackageDraftLibrary();
  }

  const parsed = JSON.parse(rawText) as unknown;
  const drafts = isRecord(parsed) && Array.isArray(parsed.drafts)
    ? parsed.drafts.map(normalizeDraft).filter((draft): draft is AgentSkillPackageDraft => Boolean(draft))
    : [];
  return {
    drafts: drafts.slice(0, MAX_AGENT_SKILL_PACKAGE_DRAFTS),
    kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
  };
}

export function serializeAgentSkillPackageDraftLibrary(library: AgentSkillPackageDraftLibrary) {
  return JSON.stringify({
    drafts: library.drafts.slice(0, MAX_AGENT_SKILL_PACKAGE_DRAFTS),
    kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
  });
}

export function saveAgentSkillPackageImportPreviewToLibrary(
  library: AgentSkillPackageDraftLibrary,
  preview: AgentSkillPackageImportPreview | null,
  savedAt = new Date().toISOString(),
): AgentSkillPackageDraftSaveResult {
  if (!preview?.ok || !preview.package) {
    return { draft: null, error: 'Only a valid agent-skill-package.v1 preview can be saved.', library };
  }

  const draft = {
    enabled: false,
    id: createDraftId(preview.package),
    package: preview.package,
    reviewedAt: null,
    savedAt,
    skillId: preview.skillId,
    warnings: preview.warnings,
  };
  return {
    draft,
    error: null,
    library: {
      drafts: [draft, ...library.drafts.filter((item) => item.id !== draft.id)]
        .slice(0, MAX_AGENT_SKILL_PACKAGE_DRAFTS),
      kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
    },
  };
}

export function removeAgentSkillPackageDraft(
  library: AgentSkillPackageDraftLibrary,
  draftId: string,
): AgentSkillPackageDraftLibrary {
  return {
    drafts: library.drafts.filter((draft) => draft.id !== draftId),
    kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
  };
}
