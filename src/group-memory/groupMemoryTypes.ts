export const CURRENT_GROUP_MEMORY_GROUP_ID = 'current-group';

export type StoredGroupMemoryKind =
  | 'discussion-summary'
  | 'role-perspective'
  | 'verified-fact';

export interface StoredGroupMemoryRecord {
  confidence: number;
  createdAt: number;
  groupId: string;
  id: string;
  invalidatedAt?: number;
  kind: StoredGroupMemoryKind;
  sourceRoleId: string;
  summary: string;
  supersedesId?: string;
  topicId: string | null;
  updatedAt: number;
  visibility: 'group';
}

export interface StoredGroupMemorySubgroup {
  createdAt: number;
  id: string;
  invalidatedAt?: number;
  memberRoleIds: string[];
  name: string;
  updatedAt: number;
}

export type GroupMemorySubgroupOperationKind =
  | 'create'
  | 'invalidate'
  | 'restore'
  | 'update-members';

export interface GroupMemorySubgroupAuditEntry {
  after: StoredGroupMemorySubgroup | null;
  before: StoredGroupMemorySubgroup | null;
  groupId: string;
  id: string;
  kind: GroupMemorySubgroupOperationKind;
  occurredAt: number;
}

export type GroupMemoryOperationKind =
  | 'invalidate'
  | 'move-group'
  | 'restore'
  | 'resolve-conflict'
  | 'rollback';

export interface GroupMemoryRecordChange {
  after: StoredGroupMemoryRecord | null;
  before: StoredGroupMemoryRecord | null;
  recordId: string;
}

export interface GroupMemoryOperationReceipt {
  changes: GroupMemoryRecordChange[];
  id: string;
  kind: GroupMemoryOperationKind;
  occurredAt: number;
  revertsReceiptId?: string;
}

export interface GroupMemoryReceiptArchive {
  archivedAt: number;
  count: number;
  firstOccurredAt: number;
  firstReceiptId: string;
  id: string;
  lastOccurredAt: number;
  lastReceiptId: string;
  operationCounts: Partial<Record<GroupMemoryOperationKind, number>>;
}

export type GroupMemoryCandidateStatus = 'pending' | 'approved' | 'rejected';
export type GroupMemoryCandidateEvidenceKind = 'chat-message' | 'task-result';

export interface GroupMemoryCandidateEvidence {
  capturedAt: number;
  excerpt: string;
  kind: GroupMemoryCandidateEvidenceKind;
  sourceMessageId: string;
  sourceRoleId: string;
  topicId: string | null;
}

export interface GroupMemoryCandidate {
  createdAt: number;
  evidence: GroupMemoryCandidateEvidence;
  id: string;
  proposedRecord: StoredGroupMemoryRecord;
  reviewedAt?: number;
  status: GroupMemoryCandidateStatus;
}

export type GroupMemoryEvidenceScopeSnapshotSource = 'candidate-approval' | 'manual-save';

export interface GroupMemoryEvidenceScopeSnapshot {
  capturedAt: number;
  groupId: string;
  id: string;
  recordId: string;
  source: GroupMemoryEvidenceScopeSnapshotSource;
  sourceMessageId: string;
  sourceRoleId: string;
  topicId: string | null;
}

export interface GroupMemoryEvidenceScopeCorrection {
  correctedGroupId: string;
  correctedRecordId: string;
  id: string;
  occurredAt: number;
  reason: string;
  snapshotId: string;
  supersedesCorrectionId?: string;
}

export type GroupMemoryCandidateReviewDecision = 'approve' | 'reject' | 'rollback';

export interface GroupMemoryCandidateReviewReceipt {
  candidateId: string;
  decision: GroupMemoryCandidateReviewDecision;
  id: string;
  nextStatus: GroupMemoryCandidateStatus;
  occurredAt: number;
  previousStatus: GroupMemoryCandidateStatus;
  recordAfter: StoredGroupMemoryRecord | null;
  recordBefore: StoredGroupMemoryRecord | null;
  revertsReceiptId?: string;
}

export interface GroupMemoryCandidateArchive {
  approvedCount: number;
  archivedAt: number;
  candidateCount: number;
  firstCandidateId: string;
  firstCreatedAt: number;
  id: string;
  lastCandidateId: string;
  lastReviewedAt: number;
  rejectedCount: number;
  reviewReceiptCount: number;
}

export interface GroupMemoryRepositoryData {
  candidateArchives: GroupMemoryCandidateArchive[];
  candidateReviewReceipts: GroupMemoryCandidateReviewReceipt[];
  candidates: GroupMemoryCandidate[];
  evidenceScopeCorrections: GroupMemoryEvidenceScopeCorrection[];
  evidenceScopeSnapshots: GroupMemoryEvidenceScopeSnapshot[];
  receiptArchives: GroupMemoryReceiptArchive[];
  receipts: GroupMemoryOperationReceipt[];
  records: StoredGroupMemoryRecord[];
  schemaVersion: 8;
  subgroupAuditTrail: GroupMemorySubgroupAuditEntry[];
  subgroups: StoredGroupMemorySubgroup[];
}

export const EMPTY_GROUP_MEMORY_REPOSITORY: GroupMemoryRepositoryData = {
  candidateArchives: [],
  candidateReviewReceipts: [],
  candidates: [],
  evidenceScopeCorrections: [],
  evidenceScopeSnapshots: [],
  receiptArchives: [],
  receipts: [],
  records: [],
  schemaVersion: 8,
  subgroupAuditTrail: [],
  subgroups: [],
};
