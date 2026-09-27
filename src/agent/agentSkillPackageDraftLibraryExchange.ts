import {
  AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
  MAX_AGENT_SKILL_PACKAGE_DRAFTS,
  parseAgentSkillPackageDraftLibraryJson,
  type AgentSkillPackageDraft,
  type AgentSkillPackageDraftLibrary,
} from './agentSkillPackageDraftLibrary';

export const AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_EXPORT_KIND = 'agent-skill-package-draft-library-export.v1';

export interface AgentSkillPackageDraftLibraryExport {
  exportedAt: string;
  kind: typeof AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_EXPORT_KIND;
  library: AgentSkillPackageDraftLibrary;
}

export interface AgentSkillPackageDraftLibraryImportPreview {
  errors: string[];
  importedCount: number;
  inputCount: number;
  kind: string;
  library: AgentSkillPackageDraftLibrary | null;
  ok: boolean;
  skippedDuplicateCount: number;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractLibraryFromImport(value: unknown) {
  if (!isRecord(value)) {
    return { error: 'Input must be a JSON object.', kind: '', library: null };
  }

  if (value.kind === AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_EXPORT_KIND) {
    return { error: null, kind: getString(value.kind), library: value.library };
  }

  if (value.kind === AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND) {
    return { error: null, kind: getString(value.kind), library: value };
  }

  return { error: 'Input is not an agent-skill-package-draft-library export.', kind: getString(value.kind), library: null };
}

function mergeDraftLibraries(
  currentLibrary: AgentSkillPackageDraftLibrary,
  importedDrafts: AgentSkillPackageDraft[],
): {
  importedCount: number;
  library: AgentSkillPackageDraftLibrary;
  skippedDuplicateCount: number;
} {
  const currentIds = new Set(currentLibrary.drafts.map((draft) => draft.id));
  const nextDrafts = importedDrafts.filter((draft) => !currentIds.has(draft.id));
  return {
    importedCount: nextDrafts.length,
    library: {
      drafts: [...nextDrafts, ...currentLibrary.drafts].slice(0, MAX_AGENT_SKILL_PACKAGE_DRAFTS),
      kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
    },
    skippedDuplicateCount: importedDrafts.length - nextDrafts.length,
  };
}

export function createAgentSkillPackageDraftLibraryExport(
  library: AgentSkillPackageDraftLibrary,
  exportedAt = new Date().toISOString(),
): AgentSkillPackageDraftLibraryExport {
  return {
    exportedAt,
    kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_EXPORT_KIND,
    library: {
      drafts: library.drafts.slice(0, MAX_AGENT_SKILL_PACKAGE_DRAFTS),
      kind: AGENT_SKILL_PACKAGE_DRAFT_LIBRARY_KIND,
    },
  };
}

export function parseAgentSkillPackageDraftLibraryImportJson(
  inputJson: string,
  currentLibrary: AgentSkillPackageDraftLibrary,
): AgentSkillPackageDraftLibraryImportPreview {
  try {
    const parsed = JSON.parse(inputJson) as unknown;
    const extracted = extractLibraryFromImport(parsed);
    if (extracted.error || !extracted.library) {
      return {
        errors: [extracted.error ?? 'Draft library export is missing library data.'],
        importedCount: 0,
        inputCount: 0,
        kind: extracted.kind,
        library: null,
        ok: false,
        skippedDuplicateCount: 0,
        warnings: [],
      };
    }

    const importedLibrary = parseAgentSkillPackageDraftLibraryJson(JSON.stringify(extracted.library));
    const mergeResult = mergeDraftLibraries(currentLibrary, importedLibrary.drafts);
    return {
      errors: [],
      importedCount: mergeResult.importedCount,
      inputCount: importedLibrary.drafts.length,
      kind: extracted.kind,
      library: mergeResult.library,
      ok: true,
      skippedDuplicateCount: mergeResult.skippedDuplicateCount,
      warnings: mergeResult.importedCount === 0 ? ['No new package drafts would be imported.'] : [],
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'Invalid JSON.'],
      importedCount: 0,
      inputCount: 0,
      kind: '',
      library: null,
      ok: false,
      skippedDuplicateCount: 0,
      warnings: [],
    };
  }
}
