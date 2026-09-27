import assert from 'node:assert/strict';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import {
  createDerivedGroupTopicId,
  resolveTopicDerivationSuggestion,
} from '../src/components/chat/group/topic/topicDerivationPolicy';

function createRuntime() {
  const runtime = new GroupChatRuntime({
    activeRoleIds: ['a', 'b'], groupSessionId: 'group-7', mode: 'infinite',
  });
  runtime.controller.updateTopic({ hasNewUserInput: true, topicId: 'parent-1' });
  return runtime;
}

assert.equal(createDerivedGroupTopicId('group-7', 2), 'group-7:topic:2');

const runtime = createRuntime();
assert.equal(runtime.controller.suggestTopicDerivation({ roleId: 'a', turnId: 'turn-1' }, 10), null);
assert.equal(runtime.controller.getSnapshot().topicDerivationSuggestions.length, 1);
assert.equal(runtime.controller.suggestTopicDerivation({ roleId: 'a', turnId: 'turn-2' }, 20), null);
assert.equal(runtime.controller.getSnapshot().topicDerivationSuggestions.length, 1);
assert.equal(runtime.controller.suggestTopicDerivation({ roleId: 'b', turnId: 'turn-3' }, 30), 'group-7:topic:1');

const derived = runtime.controller.getSnapshot();
assert.equal(derived.currentTopicId, 'group-7:topic:1');
assert.equal(derived.currentTopicParentId, 'parent-1');
assert.equal(derived.topicStatus, 'starting');
assert.equal(derived.topicDerivationSequence, 1);
assert.deepEqual(derived.topicDerivationSuggestions, []);
assert.deepEqual(derived.topicHistory, [{
  id: 'parent-1', parentTopicId: null, recordedAt: 30, status: 'starting',
}]);

const invalid = resolveTopicDerivationSuggestion({
  now: 40, record: derived, roleId: '', turnId: 'turn-4',
});
assert.equal(invalid.confirmedTopicId, null);
assert.deepEqual(invalid.suggestions, []);

const outsiderRuntime = createRuntime();
assert.equal(outsiderRuntime.controller.suggestTopicDerivation({
  roleId: 'outsider', turnId: 'turn-x',
}), null);
assert.deepEqual(outsiderRuntime.controller.getSnapshot().topicDerivationSuggestions, []);

const resetRuntime = createRuntime();
resetRuntime.controller.suggestTopicDerivation({ roleId: 'a', turnId: 'turn-a' });
resetRuntime.controller.updateTopic({ hasNewUserInput: true, topicId: 'parent-2' });
assert.deepEqual(resetRuntime.controller.getSnapshot().topicDerivationSuggestions, []);
console.log('group topic derivation policy smoke ok');
