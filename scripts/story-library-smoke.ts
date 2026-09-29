import assert from 'node:assert/strict';
import { createEmptyStoryDefinition } from '../src/components/chat/story/storyDefaults';
import { mergeStoryLibrary, removeStoryFromLibrary } from '../src/components/chat/story/storyLibrary';

const first = createEmptyStoryDefinition(['primary'], 'random');
const replacement = { ...first, title: '更新后的故事', updatedAt: first.updatedAt + 1 };
const merged = mergeStoryLibrary([first], replacement);
assert.equal(merged.length, 1);
assert.equal(merged[0]?.title, '更新后的故事');

const many = Array.from({ length: 35 }, (_, index) => ({
  ...createEmptyStoryDefinition(['primary'], 'manual'),
  id: `story-${index}`,
}));
assert.equal(mergeStoryLibrary([], many[0]!).length, 1);
const capped = many.reduce((stories, story) => mergeStoryLibrary(stories, story), [] as typeof many);
assert.equal(capped.length, 30);
assert.deepEqual(removeStoryFromLibrary([first, many[0]!], first.id), [many[0]]);

console.log('story library smoke: PASS');
