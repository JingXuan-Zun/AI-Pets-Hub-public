import assert from 'node:assert/strict';
import { createGroupTaskCandidate } from '../src/components/chat/group/task/groupTaskBridge';

const candidate = createGroupTaskCandidate([
  { groupSessionId: 'group-1', topicId: 'topic-1', turnId: 'turn-1', roleId: 'alice', summary: 'Organize icons', requestedCapability: 'organize_desktop_icons' },
  { groupSessionId: 'group-1', topicId: 'topic-1', turnId: 'turn-2', roleId: 'berry', summary: 'Organize icons', requestedCapability: 'organize_desktop_icons' },
]);
assert.deepEqual(candidate?.sourceRoleIds, ['alice', 'berry']);
assert.equal(candidate?.status, 'pending-arbitration');
console.log('group task bridge smoke ok');
