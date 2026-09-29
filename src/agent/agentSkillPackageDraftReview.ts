import {
  type AgentSkillPackageDraft,
  type AgentSkillPackageDraftLibrary,
} from './agentSkillPackageDraftLibrary';
import { createAgentSkillManifest } from './agentSkillManifest';

export type AgentSkillPackageDraftReviewSeverity = 'blocked' | 'info' | 'warning';
export type AgentSkillPackageDraftReviewStatus = 'blocked' | 'ready' | 'warning';

export interface AgentSkillPackageDraftReviewIssue {
  code: string;
  detail: string;
  severity: AgentSkillPackageDraftReviewSeverity;
}

export interface AgentSkillPackageDraftReview {
  eligible: boolean;
  enabled: boolean;
  issues: AgentSkillPackageDraftReviewIssue[];
  reviewed: boolean;
  skillId: string;
  status: AgentSkillPackageDraftReviewStatus;
}

export interface AgentSkillPackageDraftEnableResult {
  error: string | null;
  library: AgentSkillPackageDraftLibrary;
  review: AgentSkillPackageDraftReview | null;
}

function createIssue(
  code: string,
  severity: AgentSkillPackageDraftReviewSeverity,
  detail: string,
): AgentSkillPackageDraftReviewIssue {
  return { code, detail, severity };
}

function resolveStatus(issues: AgentSkillPackageDraftReviewIssue[]): AgentSkillPackageDraftReviewStatus {
  if (issues.some((issue) => issue.severity === 'blocked')) {
    return 'blocked';
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'warning';
  }
  return 'ready';
}

function findDraft(library: AgentSkillPackageDraftLibrary, draftId: string) {
  return library.drafts.find((draft) => draft.id === draftId) ?? null;
}

function createMetadataIssues(draft: AgentSkillPackageDraft) {
  const entry = createAgentSkillManifest().entries.find((item) => item.id === draft.skillId);
  if (!entry) {
    return [createIssue('unknown-skill', 'blocked', `Skill ${draft.skillId} is not registered.`)];
  }

  return [
    entry.package.version === draft.package.scaffold.package.version
      ? null
      : createIssue('version-differs', 'warning', `Registry ${entry.package.version}, draft ${draft.package.scaffold.package.version}.`),
    entry.package.runtime === draft.package.scaffold.package.runtime
      ? null
      : createIssue('runtime-differs', 'warning', `Registry ${entry.package.runtime}, draft ${draft.package.scaffold.package.runtime}.`),
    entry.package.installStatus === 'bundled'
      ? createIssue('bundled-shadow', 'warning', 'Draft targets a bundled Skill and will not override runtime until installer support exists.')
      : null,
  ].filter((issue): issue is AgentSkillPackageDraftReviewIssue => Boolean(issue));
}

function createDuplicateIssues(library: AgentSkillPackageDraftLibrary, draft: AgentSkillPackageDraft) {
  const duplicate = library.drafts.find((item) => item.id !== draft.id && item.skillId === draft.skillId && item.enabled);
  return duplicate
    ? [createIssue('enabled-duplicate', 'blocked', `Another draft for ${draft.skillId} is already enabled.`)]
    : [];
}

export function createAgentSkillPackageDraftReview(
  library: AgentSkillPackageDraftLibrary,
  draftId: string,
): AgentSkillPackageDraftReview | null {
  const draft = findDraft(library, draftId);
  if (!draft) {
    return null;
  }

  const issues = [
    ...createMetadataIssues(draft),
    ...createDuplicateIssues(library, draft),
  ];
  const status = resolveStatus(issues);
  return {
    eligible: status !== 'blocked',
    enabled: draft.enabled,
    issues,
    reviewed: Boolean(draft.reviewedAt),
    skillId: draft.skillId,
    status,
  };
}

export function setAgentSkillPackageDraftEnabled(
  library: AgentSkillPackageDraftLibrary,
  draftId: string,
  enabled: boolean,
  reviewedAt = new Date().toISOString(),
): AgentSkillPackageDraftEnableResult {
  const review = createAgentSkillPackageDraftReview(library, draftId);
  if (!review) {
    return { error: 'Skill package draft was not found.', library, review: null };
  }

  if (enabled && !review.eligible) {
    return { error: review.issues.find((issue) => issue.severity === 'blocked')?.detail ?? 'Draft is blocked.', library, review };
  }

  const nextLibrary = {
    drafts: library.drafts.map((draft) => (
      draft.id === draftId
        ? { ...draft, enabled, reviewedAt: enabled ? reviewedAt : draft.reviewedAt }
        : draft
    )),
    kind: library.kind,
  };
  return {
    error: null,
    library: nextLibrary,
    review: createAgentSkillPackageDraftReview(nextLibrary, draftId),
  };
}
