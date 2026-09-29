import assert from 'node:assert/strict';
import { analyzeGroupConversationProgress } from '../src/components/chat/group/topic/groupConversationProgressPolicy';

function message(text: string, id: string) {
  return { chatMode: 'group', id, role: 'model', text, petId: id, petName: id } as never;
}

const progressing = analyzeGroupConversationProgress([
  message('我们先确认桌面任务的目标。', 'a'),
  message('我补充一下执行结果和下一步。', 'b'),
]);
assert.equal(progressing.action, 'continue');
assert.ok(progressing.latestNovelty > 0);

const looping = analyzeGroupConversationProgress([
  message('今晚先去花房看看，确认灯光和门窗都准备好。', 'a'),
  message('今晚可以去花房看看，灯光和门窗都要确认。', 'b'),
  message('那就先看看花房，确认门窗和灯光准备好了。', 'c'),
  message('我们还是去花房，确认灯光以及门窗是否准备好。', 'd'),
]);
assert.equal(looping.action, 'ask-user');
assert.ok(looping.stagnantTurnCount >= 3);

const structuredProgress = analyzeGroupConversationProgress([
  { id: 'a', role: 'model', text: '相同观点', chatMode: 'group', groupContributionSignal: 'none' },
  { id: 'b', role: 'model', text: '相同观点', chatMode: 'group', groupContributionSignal: 'new-fact' },
] as never);
assert.equal(structuredProgress.stagnantTurnCount, 0);

console.log('group conversation progress policy smoke ok');
