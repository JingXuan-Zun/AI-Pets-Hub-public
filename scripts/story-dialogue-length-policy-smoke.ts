import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { buildStoryTurnPrompt } from '../src/components/chat/story/storyTurnPrompt';

const definition = createEmptyStoryDefinition(['a'], 'manual');
definition.title = '长度策略';
const session = createStorySession(definition);
const prompt = buildStoryTurnPrompt({
  basePrompt: '我停下脚步，观察门上的刻痕。',
  participantNames: ['甲'],
  session,
  targetName: '甲',
});
assert.match(prompt, /对白不设固定字数/);
assert.match(prompt, /根据角色当前状态/);
assert.doesNotMatch(prompt, /不少于 700/);
assert.doesNotMatch(prompt, /固定最小/);

console.log('story dialogue length policy smoke: PASS');
