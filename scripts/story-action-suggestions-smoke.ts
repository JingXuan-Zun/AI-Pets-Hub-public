import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { normalizeStoryActionSuggestions } from '../src/components/chat/story/storyActionSuggestions';

const definition = createEmptyStoryDefinition(['primary'], 'random');
definition.title = '雾中来客';
definition.openingScene = '封闭的旧车站候车厅';
const session = createStorySession(definition);

const fallback = normalizeStoryActionSuggestions([], session);
assert.equal(fallback.length, 3);
assert.equal(fallback.every((item) => item.trim().length > 0), true);

const normalized = normalizeStoryActionSuggestions([
  ' 检查站台上的脚印 ', '检查站台上的脚印', '询问守夜人', '等待', '离开',
], session);
assert.deepEqual(normalized, ['检查站台上的脚印', '询问守夜人', '等待', '离开']);

console.log('story action suggestions smoke: PASS');
