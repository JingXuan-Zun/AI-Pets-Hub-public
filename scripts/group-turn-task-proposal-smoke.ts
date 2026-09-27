import assert from 'node:assert/strict';
import { resolveGroupTurnTaskProposal } from '../src/components/chat/group/task/groupTurnTaskProposal';

const base = { groupSessionId: 'g', topicId: 'topic', turnId: 't', roleId: 'alice', userAddressedRoleIds: ['alice'] };
const output = { text: 'I can do it.', taskProposal: { summary: 'Observe desktop', requestedCapability: 'observe_desktop' } };
assert.equal(resolveGroupTurnTaskProposal({ ...base, output, userDirectedTask: false }), null);
assert.equal(resolveGroupTurnTaskProposal({ ...base, output, userDirectedTask: true })?.roleId, 'alice');
console.log('group turn task proposal smoke ok');
