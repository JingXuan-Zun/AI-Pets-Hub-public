import assert from 'node:assert/strict';
import { resolveGroupTaskContinuationOutcome } from '../src/components/chat/group/task/groupTaskContinuationPolicy';

assert.equal(resolveGroupTaskContinuationOutcome({ runStatus: 'completed' }), 'completed');
assert.equal(resolveGroupTaskContinuationOutcome({ runStatus: 'awaiting-approval' }), 'pending-approval');
assert.equal(resolveGroupTaskContinuationOutcome({
  hasPendingFollowUp: true,
  runStatus: 'completed',
}), 'pending-approval');
assert.equal(resolveGroupTaskContinuationOutcome({ runStatus: 'blocked' }), 'failed');
assert.equal(resolveGroupTaskContinuationOutcome({ runStatus: 'failed' }), 'failed');

console.log('group task continuation policy smoke ok');
