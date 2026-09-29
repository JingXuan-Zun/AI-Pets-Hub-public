import assert from 'node:assert/strict';
import {
  extractGroupRelationshipSignal,
  stripGroupRelationshipSignalMarkers,
} from '../src/components/chat/group/relationship/groupRelationshipSignalProtocol';
import { stripGroupRoleSignalMarkers } from '../src/components/chat/group/role/groupRoleSignalProtocol';
import { parseGroupRoleTurnOutput } from '../src/components/chat/group/role/groupRoleTurnOutputProtocol';

const response = '谢谢你帮我核对。\n[[relationship-signal:target=Berry;trust=3;intimacy=2;vigilance=-1;reason=主动帮助核验]]\n[[topic-signal:none]]';
assert.deepEqual(extractGroupRelationshipSignal(response), {
  deltas: { intimacy: 2, trust: 3, vigilance: -1 }, reason: '主动帮助核验', targetRoleName: 'Berry',
});
assert.equal(stripGroupRoleSignalMarkers(response), '谢谢你帮我核对。');
assert.doesNotMatch(stripGroupRelationshipSignalMarkers(response), /relationship-signal/u);
assert.equal(extractGroupRelationshipSignal('[[relationship-signal:none]]'), undefined);
assert.equal(extractGroupRelationshipSignal('[[relationship-signal:target=B;trust=11;intimacy=0;vigilance=0;reason=x]]'), undefined);
assert.equal(extractGroupRelationshipSignal(`${response}\n${response}`), undefined, 'multiple markers are invalid');

assert.ok(parseGroupRoleTurnOutput({
  text: 'visible', relationshipSignal: {
    deltas: { intimacy: 1, trust: 1, vigilance: 0 }, reason: 'evidence', targetRoleName: 'Berry',
  },
}));
assert.equal(parseGroupRoleTurnOutput({
  text: 'visible', relationshipSignal: {
    deltas: { intimacy: 20, trust: 0, vigilance: 0 }, reason: 'invalid', targetRoleName: 'Berry',
  },
}), null);
console.log('group relationship signal protocol smoke ok');
