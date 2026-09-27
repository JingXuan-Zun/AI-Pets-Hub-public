import {
  type AgentSkillPackageDraft,
  type AgentSkillPackageDraftLibrary,
} from './agentSkillPackageDraftLibrary';
import { createAgentSkillManifest } from './agentSkillManifest';

export type AgentSkillPackageSourceKind = 'bundled' | 'enabled-draft' | 'saved-draft';

export interface AgentSkillPackageSourceRow {
  draftCount: number;
  enabledDraftCount: number;
  installStatus: string;
  primarySource: AgentSkillPackageSourceKind;
  runtime: string;
  skillId: string;
  title: string;
  version: string;
}

export interface AgentSkillPackageSourceView {
  rows: AgentSkillPackageSourceRow[];
  summary: Record<AgentSkillPackageSourceKind, number> & { total: number };
}

function countDrafts(drafts: AgentSkillPackageDraft[], skillId: string, enabledOnly: boolean) {
  return drafts.filter((draft) => draft.skillId === skillId && (!enabledOnly || draft.enabled)).length;
}

function resolvePrimarySource(draftCount: number, enabledDraftCount: number): AgentSkillPackageSourceKind {
  if (enabledDraftCount > 0) {
    return 'enabled-draft';
  }
  if (draftCount > 0) {
    return 'saved-draft';
  }
  return 'bundled';
}

export function createAgentSkillPackageSourceView(
  library: AgentSkillPackageDraftLibrary,
): AgentSkillPackageSourceView {
  const rows = createAgentSkillManifest().entries.map((entry) => {
    const draftCount = countDrafts(library.drafts, entry.id, false);
    const enabledDraftCount = countDrafts(library.drafts, entry.id, true);
    return {
      draftCount,
      enabledDraftCount,
      installStatus: entry.package.installStatus,
      primarySource: resolvePrimarySource(draftCount, enabledDraftCount),
      runtime: entry.package.runtime,
      skillId: entry.id,
      title: entry.title,
      version: entry.package.version,
    };
  });
  const summary = { bundled: 0, 'enabled-draft': 0, 'saved-draft': 0, total: rows.length };
  rows.forEach((row) => {
    summary[row.primarySource] += 1;
  });

  return { rows, summary };
}
