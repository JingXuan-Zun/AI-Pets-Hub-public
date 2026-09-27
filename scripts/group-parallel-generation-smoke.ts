import assert from 'node:assert/strict';
import { runGroupParallelGeneration } from '../src/components/chat/group/orchestration/groupParallelGeneration';

const result = await runGroupParallelGeneration({
  jobs: [
    { roleId: 'a', run: async () => 'A' },
    { roleId: 'b', run: async () => { throw new Error('isolated'); } },
    { roleId: 'c', run: async () => 'C' },
  ],
});
assert.deepEqual(result.results, [{ roleId: 'a', value: 'A' }, { roleId: 'c', value: 'C' }]);
assert.deepEqual(result.failedRoleIds, ['b']);

const controller = new AbortController();
controller.abort();
const cancelled = await runGroupParallelGeneration({
  abortSignal: controller.signal,
  jobs: [{ roleId: 'a', run: async () => 'late' }],
});
assert.deepEqual(cancelled.results, []);
console.log('group parallel generation smoke ok');
