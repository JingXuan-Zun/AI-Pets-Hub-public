import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import {
  resolveStoryDefinitionForSend,
  shouldRestoreStorySession,
} from '../src/components/chat/story/storySessionRecovery';

const definition = createEmptyStoryDefinition(['primary'], 'manual');
definition.title = '沉云仓库';
const messages = [{
  chatMode: 'story' as const,
  role: 'user' as const,
  storyDefinition: definition,
  storyId: definition.id,
  text: '开始故事',
}];
const resolved = resolveStoryDefinitionForSend(messages);
assert.equal(resolved?.id, definition.id);
assert.equal(shouldRestoreStorySession(null, resolved, false), true);
assert.equal(shouldRestoreStorySession(createStorySession(definition), resolved, false), false);
assert.equal(shouldRestoreStorySession(createStorySession(definition), resolved, true), true);
assert.equal(shouldRestoreStorySession(null, null, false), false);

console.log('story session recovery smoke: PASS');
