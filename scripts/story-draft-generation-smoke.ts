import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEmptyStoryDefinition, createStoryEntry } from '../src/components/chat/story/storyDefaults';
import {
  buildStoryDraftSystemInstruction,
  buildStoryDraftUserPrompt,
} from '../src/components/chat/story/storyDraftPrompt';
import { parseStoryDraftResponse } from '../src/components/chat/story/storyDraftResponseParser';
import { extractOpenAICompatibleText } from '../src/services/openAICompatibleResponseText';
import { STORY_DRAFT_GENERATION_MAX_TOKENS } from '../src/components/chat/story/storyDraftGenerator';
import type { StoryRandomSeed } from '../src/components/chat/story/storyRandomSeed';

const participants = [
  { id: 'primary', name: '阿澈' },
  { id: 'companion-1', name: '小满' },
];
const draft = createEmptyStoryDefinition(['primary'], 'imported');
draft.title = '不能覆盖的标题';
draft.customScript = '用户剧本正文';
draft.goals = [createStoryEntry('护送证人到安全屋')];

const systemInstruction = buildStoryDraftSystemInstruction();
const completionPrompt = buildStoryDraftUserPrompt({ draft, mode: 'complete', participants });
const randomSeed: StoryRandomSeed = {
  conflict: '在倒计时结束前找回失窃的城市记忆',
  era: '架空蒸汽时代',
  genre: '冒险悬疑',
  setting: '不断移动的巨型列车城',
  tone: '紧张但充满希望',
  twist: '可靠的地图会在午夜改变一次',
};
const randomPrompt = buildStoryDraftUserPrompt({ draft, mode: 'random', participants, randomSeed });

assert.match(systemInstruction, /只输出一个 JSON 对象/);
assert.match(systemInstruction, /不要修改用户已经填写的内容/);
assert.match(completionPrompt, /不能覆盖的标题/);
assert.match(completionPrompt, /用户剧本正文/);
assert.match(completionPrompt, /目标至少 1 个/);
assert.match(completionPrompt, /特定任务/);
assert.match(completionPrompt, /故事规则/);
assert.match(randomPrompt, /不能覆盖的标题/);
assert.match(randomPrompt, /对空白部分随机补全/);
assert.doesNotMatch(randomPrompt, /无。请完整随机生成/);
assert.match(randomPrompt, /巨型列车城/);
assert.match(randomPrompt, /演员槽位/);
assert.match(randomPrompt, /participantId=primary/);
assert.doesNotMatch(randomPrompt, /阿澈|小满/);

const generatorSource = readFileSync(
  fileURLToPath(new URL('../src/components/chat/story/storyDraftGenerator.ts', import.meta.url)),
  'utf8',
);
assert.match(generatorSource, /allowReasoningContentFallback:\s*true/);
assert.equal(STORY_DRAFT_GENERATION_MAX_TOKENS, 16_384);
assert.match(generatorSource, /maxTokensOverride:\s*STORY_DRAFT_GENERATION_MAX_TOKENS/);

const standardStory = {
  title: '午夜换线',
  premise: '一座会自行改道的列车城即将驶入禁区。',
  setting: '架空蒸汽时代的移动列车城',
  goals: [{ text: '找回城市记忆', enabled: true }],
  tasks: [{ text: '在换线前取得调度钥匙', enabled: true }],
  rules: [{ text: '每次换线都会抹去一段记忆', enabled: true }],
};

assert.deepEqual(parseStoryDraftResponse(JSON.stringify(standardStory)), standardStory);
assert.deepEqual(
  parseStoryDraftResponse(['```json', JSON.stringify(standardStory, null, 2), '```'].join('\n')),
  standardStory,
);

const reasoningOnlyResponse = [
  '先检查用户设定。示例结构：',
  '{"title":"","premise":"","setting":"","goals":[],"tasks":[],"rules":[]}',
  '最终结果如下：',
  JSON.stringify({ ...standardStory, title: '最终换线' }),
].join('\n');
const parsedReasoningStory = parseStoryDraftResponse(reasoningOnlyResponse);
assert.equal((parsedReasoningStory as { title: string }).title, '最终换线');

const generationInputSource = readFileSync(
  fileURLToPath(new URL('../src/components/chat/story/storyDraftGenerationInput.ts', import.meta.url)),
  'utf8',
);
assert.match(generationInputSource, /title: draft\.title/u);
assert.match(generationInputSource, /premise: draft\.premise/u);
assert.match(generationInputSource, /customScript: draft\.customScript/u);

const mixedPayload = {
  choices: [{
    message: {
      content: '我会先整理这些设定，再给出故事对象。',
      reasoning_content: JSON.stringify({ ...standardStory, title: '推理区故事' }),
    },
  }],
};
assert.equal(
  extractOpenAICompatibleText(mixedPayload),
  '我会先整理这些设定，再给出故事对象。',
);
const mixedText = extractOpenAICompatibleText(mixedPayload, {
  allowReasoningContentFallback: true,
  includeReasoningContentWhenPresent: true,
});
assert.ok(mixedText);
assert.equal((parseStoryDraftResponse(mixedText) as { title: string }).title, '推理区故事');

assert.throws(
  () => parseStoryDraftResponse('{"title":"","premise":"","setting":"","goals":[],"tasks":[],"rules":[]}'),
  /有效的故事 JSON/,
);

assert.throws(
  () => parseStoryDraftResponse('模型正在分析，但没有形成故事对象。'),
  (error: unknown) => error instanceof Error
    && error.message.includes('有效的故事 JSON')
    && !error.message.includes('模型正在分析'),
);

console.log('story draft generation smoke: PASS');
