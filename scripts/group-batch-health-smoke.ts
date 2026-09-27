import assert from 'node:assert/strict';
import { hasGroupBatchMajorityFailed } from '../src/components/chat/group/orchestration/groupBatchHealth';
import { createGroupGenerationBatch } from '../src/components/chat/group/orchestration/groupGenerationBatch';

const batch = createGroupGenerationBatch({
  batchId: 'b', candidateRoleIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  contextVersion: 'v1', sourceMessageId: 'user',
});
assert.equal(hasGroupBatchMajorityFailed({ ...batch, failedRoleIds: ['a', 'b', 'c', 'd'] }), false);
assert.equal(hasGroupBatchMajorityFailed({ ...batch, failedRoleIds: ['a', 'b', 'c', 'd', 'e'] }), true);
console.log('group batch health smoke ok');
