export type RelationshipEvidenceWindowReadiness =
  | 'insufficient-evidence'
  | 'sustained-shadow'
  | 'volatile-shadow';

export type RelationshipEvidenceWindowReason =
  | 'contradictory-signals'
  | 'high-rejection-rate'
  | 'high-rollback-rate'
  | 'insufficient-distinct-messages'
  | 'insufficient-signals'
  | 'short-duration'
  | 'sustained-pattern'
  | 'unresolved-target';

export type RelationshipEvidenceDimensionSummary = {
  consistency: number;
  negativeCount: number;
  netDelta: number;
  neutralCount: number;
  positiveCount: number;
};

export type RelationshipEvidenceWindow = {
  approvalCount: number;
  blockedCount: number;
  claimLevel: 'shadow-observation-only';
  correctionAuditCount: number;
  dimensions: {
    intimacy: RelationshipEvidenceDimensionSummary;
    trust: RelationshipEvidenceDimensionSummary;
    vigilance: RelationshipEvidenceDimensionSummary;
  };
  distinctSourceMessageCount: number;
  durationMs: number;
  eligibleSignalCount: number;
  readiness: RelationshipEvidenceWindowReadiness;
  reasons: RelationshipEvidenceWindowReason[];
  rejectionCount: number;
  rejectionRate: number;
  retainedHistoryMayBeTruncated: boolean;
  relationshipId: string;
  rollbackCount: number;
  rollbackRate: number;
  sampleCount: number;
  sourceRoleId: string;
  sourceRoleName: string;
  targetResolved: boolean;
  targetRoleId: string;
  targetRoleName: string;
  windowEndAt: number;
  windowStartAt: number;
};

export type RelationshipEvidenceWindowScopeReason =
  | 'ambiguous-formal-memory-link'
  | 'formal-memory-link'
  | 'no-formal-memory-link';

export type RelationshipEvidenceScopeProvenance = {
  capturedAt: number;
  effectiveGroupId: string;
  effectiveRecordId: string;
  latestCorrectionId: string | null;
  originalGroupId: string;
  recordId: string;
  source: 'candidate-approval' | 'manual-save';
  sourceMessageId: string;
};

export type ScopedRelationshipEvidenceWindow = RelationshipEvidenceWindow & {
  correctionAuditScope: 'relationship-wide-not-grouped';
  memoryGroupId: string | null;
  scopeProvenance: RelationshipEvidenceScopeProvenance[];
  scopeReason: RelationshipEvidenceWindowScopeReason;
  windowId: string;
};
