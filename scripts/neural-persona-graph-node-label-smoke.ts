import assert from 'node:assert/strict';
import {
  neuralPersonaGraphNodeInnerFontSize,
  neuralPersonaGraphNodeInnerText,
} from '../src/components/settings/neuralPersonaGraphNodeVisualStyle';

const small = {
  incomingCount: 0, label: '一个很长的节点名称', outgoingCount: 0,
  status: 'active' as const, tagIds: ['emotion:happy'], type: 'preference' as const,
};
const large = {
  ...small, incomingCount: 16, outgoingCount: 9,
};

assert.equal(neuralPersonaGraphNodeInnerText(small), '一…');
assert.ok(neuralPersonaGraphNodeInnerText(large).includes('\n#'));
assert.ok(neuralPersonaGraphNodeInnerFontSize(small) >= 5);
assert.ok(neuralPersonaGraphNodeInnerFontSize(large) > neuralPersonaGraphNodeInnerFontSize(small));

console.log('neural persona graph node label smoke ok');
