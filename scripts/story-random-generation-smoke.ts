import assert from 'node:assert/strict';
import { createEmptyStoryDefinition } from '../src/components/chat/story/storyDefaults';
import { prepareStoryDraftForGeneration } from '../src/components/chat/story/storyDraftGenerationInput';
import { mergeStoryCompletion } from '../src/components/chat/story/storyDraftNormalization';
import { createStoryRandomSeed } from '../src/components/chat/story/storyRandomSeed';

const seed = createStoryRandomSeed(() => 0);
assert.equal(seed.genre.length > 0, true);
assert.equal(seed.setting.length > 0, true);
assert.equal(seed.conflict.length > 0, true);

const generatedDraft = createEmptyStoryDefinition(['primary', 'companion-1'], 'random');
generatedDraft.title = '上一次生成的故事';
generatedDraft.premise = '上一次生成的梗概';
generatedDraft.setting = '上一次生成的世界';
generatedDraft.customScript = '上一次模型生成的剧本';
const replacementBase = prepareStoryDraftForGeneration(generatedDraft, 'random');
assert.equal(replacementBase.id, generatedDraft.id);
assert.deepEqual(replacementBase.participantIds, generatedDraft.participantIds);
assert.equal(replacementBase.title, generatedDraft.title);
assert.equal(replacementBase.premise, generatedDraft.premise);
assert.equal(replacementBase.customScript, generatedDraft.customScript);

const importedDraft = { ...generatedDraft, source: 'imported' as const };
assert.equal(prepareStoryDraftForGeneration(importedDraft, 'random').title, generatedDraft.title);

const blankDraft = createEmptyStoryDefinition(['primary'], 'manual');
const firstGenerated = createEmptyStoryDefinition(['primary'], 'random');
firstGenerated.title = '第一次随机故事';
firstGenerated.premise = '完全随机的故事梗概';
firstGenerated.initialTime = '凌晨三点十七分';
const firstCompletion = mergeStoryCompletion(blankDraft, firstGenerated);
assert.equal(firstCompletion.source, 'random');
assert.equal(firstCompletion.initialTime, '凌晨三点十七分');

console.log('story random generation smoke: PASS');
