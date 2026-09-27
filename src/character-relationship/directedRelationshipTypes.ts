export const DIRECTED_RELATIONSHIP_SCHEMA_VERSION = 4 as const;

export type DirectedRelationshipDimensions = {
  intimacy: number;
  trust: number;
  vigilance: number;
};

export type DirectedRelationshipUpdateSource = 'correction' | 'import' | 'manual';
export type DirectedRelationshipOperationKind =
  | 'invalidate'
  | 'remove-role'
  | 'restore'
  | 'rollback'
  | 'upsert';

export type DirectedRelationshipRecord = {
  createdAt: number;
  dimensions: DirectedRelationshipDimensions;
  evidenceSummary: string;
  id: string;
  invalidatedAt?: number;
  sourceRoleId: string;
  targetRoleId: string;
  targetRoleName?: string;
  updatedAt: number;
};

export type DirectedRelationshipAuditEntry = {
  after: DirectedRelationshipRecord | null;
  before: DirectedRelationshipRecord | null;
  id: string;
  kind: DirectedRelationshipOperationKind;
  reason: string;
  recordedAt: number;
  relationshipId: string;
  revertsAuditId?: string;
  source: DirectedRelationshipUpdateSource;
};

export type DirectedRelationshipCandidateStatus = 'approved' | 'pending' | 'rejected';
export type DirectedRelationshipScreeningDecision = 'blocked' | 'manual-review';
export type DirectedRelationshipScreeningReason =
  | 'empty-evidence'
  | 'no-dimension-change'
  | 'question-like'
  | 'self-relationship'
  | 'target-not-active'
  | 'transient-language'
  | 'valid-change-requires-review';

export type DirectedRelationshipCandidate = {
  baseDimensions: DirectedRelationshipDimensions;
  baseUpdatedAt: number | null;
  createdAt: number;
  deltas: DirectedRelationshipDimensions;
  evidenceExcerpt: string;
  id: string;
  proposedDimensions: DirectedRelationshipDimensions;
  reason: string;
  reviewedAt?: number;
  screeningDecision: DirectedRelationshipScreeningDecision;
  screeningReasons: DirectedRelationshipScreeningReason[];
  sourceMessageId: string;
  sourceRoleId: string;
  sourceRoleName: string;
  status: DirectedRelationshipCandidateStatus;
  targetRoleId: string;
  targetRoleName: string;
};

export type DirectedRelationshipCandidateReviewReceipt = {
  candidateId: string;
  decision: 'approve' | 'reject' | 'rollback';
  id: string;
  nextStatus: DirectedRelationshipCandidateStatus;
  occurredAt: number;
  previousStatus: DirectedRelationshipCandidateStatus;
  recordAfter: DirectedRelationshipRecord | null;
  recordBefore: DirectedRelationshipRecord | null;
  relationshipAuditId?: string;
  revertsReceiptId?: string;
};

export type DirectedRelationshipShadowObservation = {
  candidateId: string;
  decision: DirectedRelationshipScreeningDecision;
  mode: 'shadow';
  observedAt: number;
  reasons: DirectedRelationshipScreeningReason[];
};

export type DirectedRelationshipBehaviorPolicy = {
  addressStyle: 'familiar-warm' | 'neutral-polite' | 'formal-distance';
  disagreementStyle: 'evidence-first' | 'firm-boundary' | 'warm-clarification';
  engagementStyle: 'acknowledge-and-build' | 'direct-and-limited' | 'normal-response';
  policyVersion: 1;
  relationshipId: string;
  sharingStyle: 'open-with-boundaries' | 'minimal' | 'selective';
  sourceDimensions: DirectedRelationshipDimensions;
  sourceUpdatedAt: number;
  supportStyle: 'independent-evaluation' | 'support-with-evidence' | 'withhold-automatic-defense';
  targetRoleId: string;
  targetRoleName: string;
  verificationStyle: 'cooperative-verify' | 'standard-verify' | 'strict-verify';
};

export type DirectedRelationshipBehaviorTrace = {
  addressedRoleIds: string[];
  claimLevel: 'policy-supplied-only';
  eventKind: 'relationship-behavior-context';
  groupSessionId: string;
  id: string;
  occurredAt: number;
  outputExcerpt: string;
  policies: DirectedRelationshipBehaviorPolicy[];
  sourceMessageId: string;
  sourceRoleId: string;
  sourceRoleName: string;
  topicId: string | null;
};

export type DirectedRelationshipRepositoryData = {
  auditTrail: DirectedRelationshipAuditEntry[];
  behaviorTraces: DirectedRelationshipBehaviorTrace[];
  candidateReviewReceipts: DirectedRelationshipCandidateReviewReceipt[];
  candidates: DirectedRelationshipCandidate[];
  records: DirectedRelationshipRecord[];
  schemaVersion: typeof DIRECTED_RELATIONSHIP_SCHEMA_VERSION;
  shadowObservations: DirectedRelationshipShadowObservation[];
};

export const EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY: DirectedRelationshipRepositoryData = {
  auditTrail: [],
  behaviorTraces: [],
  candidateReviewReceipts: [],
  candidates: [],
  records: [],
  schemaVersion: DIRECTED_RELATIONSHIP_SCHEMA_VERSION,
  shadowObservations: [],
};
