import type { DirectedRelationshipRepositoryData } from '../character-relationship';
import type { GroupMemoryRepositoryData } from '../group-memory';
import type { GroupTopicRepositoryData } from '../group-topic';

export type SocialEventSource = 'group-memory' | 'relationship' | 'topic';

export type SocialEventKind =
  | 'group-memory-evidence-scope'
  | 'group-memory-evidence-scope-correction'
  | 'group-memory-operation'
  | 'group-memory-review'
  | 'relationship-behavior-context'
  | 'relationship-operation'
  | 'relationship-review'
  | 'topic-transition';

export type SocialEventEvidenceKind =
  | 'candidate-reference'
  | 'chat-message'
  | 'evidence-scope-snapshot'
  | 'record-snapshot'
  | 'relationship-policy'
  | 'task-result'
  | 'transition-reason';

export type SocialEventEvidenceReference = {
  excerpt: string;
  kind: SocialEventEvidenceKind;
  referenceId: string | null;
};

export type SocialEventLinkRelation =
  | 'corrected-by'
  | 'corrects'
  | 'derived-from'
  | 'derived-into'
  | 'reverted-by'
  | 'reverts'
  | 'superseded-by'
  | 'supersedes';

export type SocialEventLink = {
  relation: SocialEventLinkRelation;
  targetEventId: string | null;
  targetReferenceId: string;
};

export type SocialEventMemoryScope = {
  capturedGroupId: string;
  currentGroupId: string | null;
  currentScopeStatus: 'active' | 'group-disabled' | 'record-invalidated' | 'record-unavailable';
  effectiveGroupId: string;
  effectiveRecordId: string;
  latestCorrectionId: string | null;
  recordId: string;
  snapshotSource: 'candidate-approval' | 'manual-save';
};

export type SocialEventTimelineEntry = {
  claimLevel: 'audited-operation' | 'policy-supplied-only';
  evidence: SocialEventEvidenceReference[];
  groupSessionId: string | null;
  id: string;
  kind: SocialEventKind;
  links: SocialEventLink[];
  memoryScope?: SocialEventMemoryScope;
  memoryGroupIds: string[];
  occurredAt: number;
  roleIds: string[];
  source: SocialEventSource;
  summary: string;
  title: string;
  topicId: string | null;
};

export type SocialEventTimelineRepositories = {
  directedRelationshipRepository: DirectedRelationshipRepositoryData;
  groupMemoryRepository: GroupMemoryRepositoryData;
  groupTopicRepository: GroupTopicRepositoryData;
};
