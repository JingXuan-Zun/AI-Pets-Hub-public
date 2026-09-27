import assert from 'node:assert/strict';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import {
  buildGroupTopicSignalPromptLines,
  extractGroupTopicSignal,
  stripGroupTopicSignalMarkers,
} from '../src/components/chat/group/role/groupTopicSignalProtocol';
import {
  applyGroupRoleTopicSignal,
  mapGroupTopicSignal,
} from '../src/components/chat/group/topic/groupTopicSignal';

function createRuntime() {
  const runtime = new GroupChatRuntime({
    activeRoleIds: ['a', 'b'], groupSessionId: 'group-1', mode: 'infinite',
  });
  runtime.controller.updateTopic({ hasNewUserInput: true, topicId: 'topic-1' });
  return runtime;
}

assert.equal(extractGroupTopicSignal('正文\n[[topic-signal:disagreement]]'), 'disagreement');
assert.equal(extractGroupTopicSignal('正文没有标记'), undefined);
assert.equal(extractGroupTopicSignal('[[topic-signal:active]]'), undefined);
assert.equal(extractGroupTopicSignal('我不同意，但没有状态标记'), undefined);
assert.equal(extractGroupTopicSignal('[[topic-signal:none]][[topic-signal:disagreement]]'), undefined);
assert.equal(stripGroupTopicSignalMarkers('正文\n[[topic-signal:waiting-information]]'), '正文');
assert.equal(stripGroupTopicSignalMarkers('正文\n[[topic-sig'), '正文');
assert.match(buildGroupTopicSignalPromptLines().join('\n'), /不得生成话题 ID/u);

const disputedRuntime = createRuntime();
assert.equal(applyGroupRoleTopicSignal(disputedRuntime, {
  text: '不同意', topicSignal: 'disagreement',
}), true);
assert.equal(disputedRuntime.controller.getSnapshot().topicStatus, 'disputed');

const waitingRuntime = createRuntime();
applyGroupRoleTopicSignal(waitingRuntime, { text: '需要资料', topicSignal: 'waiting-information' });
assert.equal(waitingRuntime.controller.getSnapshot().topicStatus, 'waiting-information');
assert.equal(waitingRuntime.canContinue(), false);

const concludedRuntime = createRuntime();
applyGroupRoleTopicSignal(concludedRuntime, { text: '阶段结论', topicSignal: 'stage-conclusion' });
assert.equal(concludedRuntime.controller.getSnapshot().topicStatus, 'concluded');

const derivedRuntime = createRuntime();
assert.equal(applyGroupRoleTopicSignal(derivedRuntime, { text: '另开话题', topicSignal: 'derive-topic' }), true);
assert.equal(derivedRuntime.controller.getSnapshot().currentTopicId, 'topic-1');
assert.equal(mapGroupTopicSignal('derive-topic').suggestsDerivedTopic, true);

applyGroupRoleTopicSignal(derivedRuntime, {
  text: '第一个建议', topicSignal: 'derive-topic',
}, { roleId: 'a', turnId: 'derive-1' });
assert.equal(derivedRuntime.controller.getSnapshot().currentTopicId, 'topic-1');
applyGroupRoleTopicSignal(derivedRuntime, {
  text: '第二个建议', topicSignal: 'derive-topic',
}, { roleId: 'b', turnId: 'derive-2' });
assert.equal(derivedRuntime.controller.getSnapshot().currentTopicId, 'group-1:topic:1');
assert.equal(derivedRuntime.controller.getSnapshot().currentTopicParentId, 'topic-1');

const plainRuntime = createRuntime();
assert.equal(applyGroupRoleTopicSignal(plainRuntime, { text: '我不同意但没有结构化信号' }), false);
assert.equal(plainRuntime.controller.getSnapshot().topicStatus, 'starting');
console.log('group topic signal smoke ok');
