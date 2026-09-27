import assert from 'node:assert/strict';
import { attachGroupRoleTaskProposal } from '../src/components/chat/group/role/groupRoleTurnOutput';

assert.equal(attachGroupRoleTaskProposal({ output: { text: 'hello' }, groupSessionId: 'g', topicId: null, turnId: 't', roleId: 'alice' }), null);
assert.deepEqual(attachGroupRoleTaskProposal({
  output: { text: 'I can prepare it.', taskProposal: { summary: 'Observe desktop', requestedCapability: 'observe_desktop' } },
  groupSessionId: 'g', topicId: 'topic', turnId: 't', roleId: 'alice',
}), { groupSessionId: 'g', topicId: 'topic', turnId: 't', roleId: 'alice', summary: 'Observe desktop', requestedCapability: 'observe_desktop' });
console.log('group role task proposal smoke ok');
