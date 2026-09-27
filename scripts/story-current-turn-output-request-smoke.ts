import assert from 'node:assert/strict';
import { buildStoryNarratorPrompt, normalizeStoryNarrationText } from '../src/components/chat/story/storyNarrator';
import { buildStoryTurnDirectorPrompt } from '../src/components/chat/story/storyTurnDirector';
import { buildStoryTurnPrompt } from '../src/components/chat/story/storyTurnPrompt';
import { createEmptyStorySessionForSmoke } from './story-narration-smoke-fixture';

const session = createEmptyStorySessionForSmoke();
session.definition.customScript = '默认详细描写环境，使用第二人称。';
const request = '这次只写江月华的对白，控制在三句以内，不要环境描写，直接回应我刚才的问题。';
const prompts = [
  buildStoryNarratorPrompt({ session, historyMessages: [], userInput: request }),
  buildStoryTurnDirectorPrompt({ session, historyMessages: [], participants: [], userInput: request }),
  buildStoryTurnPrompt({ session, basePrompt: request, participantNames: ['江月华'], targetName: '江月华' }),
];
for (const prompt of prompts) {
  assert.match(prompt, /本轮写作要求立即生效/, 'each generation stage needs the same current-turn output contract');
  assert.ok(prompt.lastIndexOf(request) > prompt.indexOf('默认详细描写环境'), 'current request must follow older defaults');
  assert.match(prompt, /不要把写作指令编成角色对白或故事事件/);
  assert.match(prompt, /本轮明确要求优先于历史写法/);
}
const longOutput = '雨夜里的车站。'.repeat(1100) + '结尾：角色终于给出回答。';
assert.equal(normalizeStoryNarrationText(longOutput), longOutput, 'display normalization must not silently discard generated text');
console.log('story current-turn output priority and complete narration passed');
