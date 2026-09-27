import type { DirectedRelationshipRepositoryData } from './directedRelationshipTypes';

export type DirectedRelationshipShadowReport = {
  approvedCount: number;
  blockedCount: number;
  manualReviewCount: number;
  pendingCount: number;
  rejectedCount: number;
  sampleCount: number;
  writeMode: 'manual-approval-only';
};

export function buildDirectedRelationshipShadowReport(
  repository: DirectedRelationshipRepositoryData,
): DirectedRelationshipShadowReport {
  const observations = repository.shadowObservations;
  return {
    approvedCount: repository.candidates.filter((item) => item.status === 'approved').length,
    blockedCount: observations.filter((item) => item.decision === 'blocked').length,
    manualReviewCount: observations.filter((item) => item.decision === 'manual-review').length,
    pendingCount: repository.candidates.filter((item) => item.status === 'pending').length,
    rejectedCount: repository.candidates.filter((item) => item.status === 'rejected').length,
    sampleCount: observations.length,
    writeMode: 'manual-approval-only',
  };
}
