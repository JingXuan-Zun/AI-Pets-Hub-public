import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORY_DRAFT_GENERATION_TIMEOUT_MS } from '../src/components/chat/story/storyDraftGenerator';

const panelSource = readFileSync('src/components/chat/story/StoryModePanel.tsx', 'utf8');
const controllerSource = readFileSync('src/components/chat/story/useStorySetupController.ts', 'utf8');

assert.equal(STORY_DRAFT_GENERATION_TIMEOUT_MS, 300_000);
assert.match(panelSource, /正在生成故事/);
assert.match(panelSource, /取消生成/);
assert.match(panelSource, /最长可能需要 5 分钟/);
assert.match(controllerSource, /new AbortController\(\)/);
assert.match(controllerSource, /signal: requestController\.signal/);
assert.match(controllerSource, /cancelGeneration/);

console.log('story generation feedback smoke: PASS');
