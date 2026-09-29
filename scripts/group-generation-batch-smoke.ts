import assert from 'node:assert/strict';
import {
  cancelGroupGenerationBatch,
  createGroupGenerationBatch,
  markGroupGenerationBatchFailed,
  markGroupGenerationBatchPublished,
  startGroupGenerationBatch,
} from '../src/components/chat/group/orchestration/groupGenerationBatch';

let batch = createGroupGenerationBatch({
  batchId: 'batch-1', candidateRoleIds: ['a', 'b', 'a'], contextVersion: 'v1', sourceMessageId: 'user-1',
});
assert.deepEqual(batch.candidateRoleIds, ['a', 'b']);
batch = startGroupGenerationBatch(batch);
batch = markGroupGenerationBatchPublished(batch, 'a');
assert.equal(batch.status, 'publishing');
batch = markGroupGenerationBatchFailed(batch, 'b');
assert.equal(batch.status, 'completed');
assert.deepEqual(batch.failedRoleIds, ['b']);
assert.equal(cancelGroupGenerationBatch(batch).status, 'completed');
console.log('group generation batch smoke ok');
