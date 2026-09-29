import assert from 'node:assert/strict';
import { planGroupDialogueTurn } from '../src/components/chat/group/orchestration/groupDialogueDirector';
import { createGroupSessionRecord } from '../src/components/chat/group/state/groupSessionRecord';
import { createGroupUserTopicState } from '../src/components/chat/group/topic/groupUserTopicState';

const record = createGroupSessionRecord({
  activeRoleIds: ['a', 'b'], groupSessionId: 'session', mode: 'infinite',
});
const userTopicRecord = {
  ...record,
  groupUserTopicState: createGroupUserTopicState({
    addressedRoleIds: ['b'], roleIds: ['a', 'b'], sourceMessageId: 'user-1', topicId: 'user-1',
  }),
};
const messages = [{ id: 'user-1', role: 'user', chatMode: 'group', text: '新话题' }] as never;
const candidates = [{ roleId: 'a' }, { roleId: 'b' }] as never;
const userDecision = planGroupDialogueTurn({
  attentionCandidates: candidates, messages, record: userTopicRecord,
});
assert.equal(userDecision.action, 'answer-user');
assert.deepEqual(userDecision.candidateRoleIds, ['b', 'a']);

const taskDecision = planGroupDialogueTurn({
  attentionCandidates: candidates, messages, record: { ...record, pendingTaskId: 'task-1' },
});
assert.equal(taskDecision.action, 'wait-task');

const closingDecision = planGroupDialogueTurn({
  attentionCandidates: candidates, messages, record: { ...record, topicStatus: 'closed' },
});
assert.equal(closingDecision.action, 'close-topic');
const stagnantDecision = planGroupDialogueTurn({
  attentionCandidates: candidates, messages, progress: {
    action: 'close', latestNovelty: 0, reason: 'stagnant', stagnantTurnCount: 5,
  }, record,
});
assert.equal(stagnantDecision.action, 'summarize-topic');
assert.deepEqual(stagnantDecision.candidateRoleIds, ['a']);
console.log('group dialogue director smoke ok');
