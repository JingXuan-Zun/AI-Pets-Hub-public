import assert from 'node:assert/strict';
import {
  advanceGroupTaskCollaborationPlan,
  createGroupTaskCollaborationPlan,
  failGroupTaskCollaborationPlan,
} from '../src/components/chat/group/task/groupTaskCollaborationPlan';

const plan = createGroupTaskCollaborationPlan(['a', 'b', 'c', 'd', 'e'], 'b')!;
assert.deepEqual(
  [plan.analystRoleId, plan.reviewerRoleId, plan.executorRoleId, plan.reporterRoleId],
  ['b', 'a', 'c', 'd'],
);
assert.equal(advanceGroupTaskCollaborationPlan(plan).currentStage, 'review');
assert.equal(failGroupTaskCollaborationPlan(plan).currentStage, 'failed');
const reused = createGroupTaskCollaborationPlan(['a', 'b'])!;
assert.deepEqual(
  [reused.analystRoleId, reused.reviewerRoleId, reused.executorRoleId, reused.reporterRoleId],
  ['a', 'b', 'a', 'b'],
);
console.log('group task collaboration plan smoke ok');
