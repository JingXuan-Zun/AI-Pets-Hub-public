import assert from 'node:assert/strict';
import type { PetConfig, PetConfigUpdateHandler, PetConfigUpdateOptions } from '../src/types';
import { EMPTY_GROUP_TOPIC_REPOSITORY } from '../src/group-topic';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import {
  commitGroupTopicRuntimeSnapshot,
  restoreGroupTopicRuntime,
} from '../src/components/chat/group/topic/groupTopicPersistence';

const firstRuntime = new GroupChatRuntime({
  activeRoleIds: ['a', 'b'], groupSessionId: 'group-1', mode: 'infinite',
});
firstRuntime.controller.updateTopic({ hasNewUserInput: true, topicId: 'topic-1' });
firstRuntime.controller.deriveTopic('topic-2', 20);

const configRef = {
  current: { groupTopicRepository: EMPTY_GROUP_TOPIC_REPOSITORY } as PetConfig,
};
const writes: PetConfigUpdateOptions[] = [];
const onUpdateConfig: PetConfigUpdateHandler = (config, options) => {
  configRef.current = config;
  writes.push(options ?? {});
};

assert.equal(commitGroupTopicRuntimeSnapshot({
  configRef, groupKey: 'a|b', onUpdateConfig, runtime: firstRuntime,
}), true);
assert.deepEqual(writes, [{ persist: true, normalize: false, priority: 'low' }]);
assert.equal(commitGroupTopicRuntimeSnapshot({
  configRef, groupKey: 'a|b', onUpdateConfig, runtime: firstRuntime,
}), false);

const restoredRuntime = new GroupChatRuntime({
  activeRoleIds: ['a', 'b'], groupSessionId: 'group-2', mode: 'single-round',
});
assert.equal(restoreGroupTopicRuntime({
  config: configRef.current, roleIds: ['b', 'a'], runtime: restoredRuntime,
}), 'a|b');
const restored = restoredRuntime.controller.getSnapshot();
assert.equal(restored.currentTopicId, null);
assert.deepEqual(restored.topicHistory.map((item) => item.id), ['topic-1', 'topic-2']);
assert.deepEqual(restored.topicAuditTrail, firstRuntime.controller.getSnapshot().topicAuditTrail);
assert.equal(restored.topicDerivationSequence, 0);
assert.deepEqual(restored.topicDerivationSuggestions, []);

restoredRuntime.controller.updateTopic({ hasNewUserInput: true, topicId: 'topic-3' });
assert.equal(restoredRuntime.controller.getSnapshot().currentTopicId, 'topic-3');
console.log('group topic persistence smoke ok');
