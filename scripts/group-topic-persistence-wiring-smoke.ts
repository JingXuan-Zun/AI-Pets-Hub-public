import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const execution = [
  readFileSync('src/components/chat/chatPreparedTargetResponses.ts', 'utf8'),
  readFileSync('src/components/chat/chatPreparedGroupContinuation.ts', 'utf8'),
].join('\n');
const persistence = readFileSync('src/components/chat/group/topic/groupTopicPersistence.ts', 'utf8');
const persistentConfig = readFileSync('src/persistentPetConfig.ts', 'utf8');
const normalization = readFileSync('src/petConfigNormalization.ts', 'utf8');
const configTypes = readFileSync('src/types.ts', 'utf8');
const defaults = readFileSync('src/constants.ts', 'utf8');

assert.match(execution, /restoreGroupTopicRuntime/u);
assert.match(execution, /commitTopicSnapshot\(context\)/u);
assert.match(execution, /onTopicSnapshotChanged/u);
assert.match(persistence, /groupTopicRepository/u);
assert.match(persistence, /persist: true/u);
assert.match(persistentConfig, /normalizePetConfig/u);
assert.match(normalization, /normalizeGroupTopicRepository\(nextConfig\.groupTopicRepository\)/u);
assert.match(configTypes, /groupTopicRepository: GroupTopicRepositoryData/u);
assert.match(defaults, /groupTopicRepository: EMPTY_GROUP_TOPIC_REPOSITORY/u);
assert.doesNotMatch(persistence, /localStorage|new GroupChatRuntime|class .*Store/u);
console.log('group topic persistence wiring smoke ok');
