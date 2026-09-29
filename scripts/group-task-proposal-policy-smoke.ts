import assert from 'node:assert/strict';
import { canSubmitGroupTaskProposal } from '../src/components/chat/group/task/groupTaskProposalPolicy';

const proposal = { groupSessionId: 'g', topicId: null, turnId: 't', roleId: 'alice', summary: 'Observe desktop', requestedCapability: 'observe_desktop' };
assert.equal(canSubmitGroupTaskProposal(proposal, { userDirectedTask: false, userAddressedRoleIds: ['alice'] }), false);
assert.equal(canSubmitGroupTaskProposal(proposal, { userDirectedTask: true, userAddressedRoleIds: ['berry'] }), false);
assert.equal(canSubmitGroupTaskProposal(proposal, { userDirectedTask: true, userAddressedRoleIds: ['alice'] }), true);
console.log('group task proposal policy smoke ok');
