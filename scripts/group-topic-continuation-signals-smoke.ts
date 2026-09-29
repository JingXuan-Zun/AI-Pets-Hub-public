import assert from 'node:assert/strict';
import { resolveRepeatedGroupReplyCount } from '../src/components/chat/group/topic/topicContinuationSignals';

assert.equal(resolveRepeatedGroupReplyCount([
  { id: '1', role: 'model', text: 'Same reply', chatMode: 'group' },
  { id: '2', role: 'model', text: ' same   reply ', chatMode: 'group' },
  { id: '3', role: 'model', text: 'same reply', chatMode: 'group' },
] as never), 2);
console.log('group topic continuation signals smoke ok');
