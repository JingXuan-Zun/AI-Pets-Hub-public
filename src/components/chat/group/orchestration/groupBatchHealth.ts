import type { GroupGenerationBatch } from './groupGenerationBatch';

export function hasGroupBatchMajorityFailed(batch: GroupGenerationBatch | null) {
  if (!batch || batch.candidateRoleIds.length === 0) return false;
  return batch.failedRoleIds.length > batch.candidateRoleIds.length / 2;
}
