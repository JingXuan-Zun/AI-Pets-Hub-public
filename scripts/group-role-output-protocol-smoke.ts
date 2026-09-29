import assert from 'node:assert/strict';
import { parseGroupRoleTurnOutput } from '../src/components/chat/group/role/groupRoleTurnOutputProtocol';

assert.equal(parseGroupRoleTurnOutput('organize my desktop'), null);
assert.deepEqual(parseGroupRoleTurnOutput({ text: 'hello' }), { text: 'hello' });
assert.deepEqual(parseGroupRoleTurnOutput({ text: 'hello', topicSignal: 'disagreement' }), {
  text: 'hello', topicSignal: 'disagreement',
});
assert.deepEqual(parseGroupRoleTurnOutput({ text: 'new idea', contributionSignal: 'new-viewpoint' }), {
  text: 'new idea', contributionSignal: 'new-viewpoint',
});
assert.equal(parseGroupRoleTurnOutput({ text: 'bad', contributionSignal: 'guess' }), null);
assert.equal(parseGroupRoleTurnOutput({ text: 'bad', topicSignal: 'active' }), null);
assert.deepEqual(parseGroupRoleTurnOutput({ text: 'I can do that.', taskProposal: { summary: 'Organize desktop', requestedCapability: 'organize_desktop_icons' } }), {
  text: 'I can do that.', taskProposal: { summary: 'Organize desktop', requestedCapability: 'organize_desktop_icons' },
});
assert.equal(parseGroupRoleTurnOutput({ text: 'bad', taskProposal: { summary: 'missing capability' } }), null);
console.log('group role output protocol smoke ok');
