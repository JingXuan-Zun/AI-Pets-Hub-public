export type GroupGenerationBatchStatus = 'planning' | 'publishing' | 'completed' | 'cancelled';

export type GroupGenerationBatch = {
  batchId: string;
  candidateRoleIds: string[];
  contextVersion: string;
  failedRoleIds: string[];
  publishedRoleIds: string[];
  sourceMessageId: string | null;
  status: GroupGenerationBatchStatus;
};

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function createGroupGenerationBatch(options: {
  batchId: string;
  candidateRoleIds: string[];
  contextVersion: string;
  sourceMessageId: string | null;
}): GroupGenerationBatch {
  return {
    batchId: options.batchId,
    candidateRoleIds: unique(options.candidateRoleIds),
    contextVersion: options.contextVersion,
    failedRoleIds: [],
    publishedRoleIds: [],
    sourceMessageId: options.sourceMessageId,
    status: 'planning',
  };
}

export function startGroupGenerationBatch(batch: GroupGenerationBatch) {
  return batch.status === 'planning' ? { ...batch, status: 'publishing' as const } : batch;
}

export function markGroupGenerationBatchPublished(batch: GroupGenerationBatch, roleId: string) {
  if (!batch.candidateRoleIds.includes(roleId) || batch.publishedRoleIds.includes(roleId)) return batch;
  const publishedRoleIds = [...batch.publishedRoleIds, roleId];
  return {
    ...batch,
    publishedRoleIds,
    status: publishedRoleIds.length + batch.failedRoleIds.length >= batch.candidateRoleIds.length
      ? 'completed' as const : 'publishing' as const,
  };
}

export function markGroupGenerationBatchFailed(batch: GroupGenerationBatch, roleId: string) {
  if (!batch.candidateRoleIds.includes(roleId) || batch.failedRoleIds.includes(roleId)) return batch;
  const failedRoleIds = [...batch.failedRoleIds, roleId];
  return {
    ...batch,
    failedRoleIds,
    status: batch.publishedRoleIds.length + failedRoleIds.length >= batch.candidateRoleIds.length
      ? 'completed' as const : 'publishing' as const,
  };
}

export function cancelGroupGenerationBatch(batch: GroupGenerationBatch) {
  return batch.status === 'completed' ? batch : { ...batch, status: 'cancelled' as const };
}
