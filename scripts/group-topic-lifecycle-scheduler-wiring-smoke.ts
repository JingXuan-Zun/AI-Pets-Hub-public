import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scheduler = readFileSync('src/components/chat/group/topic/useGroupTopicLifecycleScheduler.ts', 'utf8');
const session = readFileSync('src/components/chat/usePetChatSession.ts', 'utf8');

assert.match(scheduler, /advanceGroupTopicRepositoryTime/u);
assert.match(scheduler, /activeGroupRuntimeRef\.get\(\)/u);
assert.match(scheduler, /excludedGroupSessionId: activeSessionId/u);
assert.match(scheduler, /repository === options\.configRef\.current\.groupTopicRepository/u);
assert.match(scheduler, /persist: true/u);
assert.match(scheduler, /window\.setInterval/u);
assert.match(scheduler, /window\.clearInterval/u);
assert.doesNotMatch(scheduler, /new GroupChatRuntime|localStorage|updateTopic\(|deriveTopic\(/u);
assert.equal(session.match(/useGroupTopicLifecycleScheduler\(/gu)?.length, 1);
console.log('group topic lifecycle scheduler wiring smoke ok');
