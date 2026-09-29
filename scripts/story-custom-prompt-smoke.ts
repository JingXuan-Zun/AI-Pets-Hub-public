import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { buildStoryDefinitionPromptContext } from '../src/components/chat/story/storyDefinitionPromptContext';
import { prepareStoryDraftForGeneration } from '../src/components/chat/story/storyDraftGenerationInput';
import { normalizeStoryDefinition } from '../src/components/chat/story/storyDraftNormalization';
import { buildStoryDraftUserPrompt } from '../src/components/chat/story/storyDraftPrompt';
import { buildStoryNarratorPrompt } from '../src/components/chat/story/storyNarrator';
import { buildStoryTurnDirectorPrompt } from '../src/components/chat/story/storyTurnDirector';

const participants = [{ id: 'primary', name: '阿澈' }];
const legacy = normalizeStoryDefinition({
  participantIds: ['primary'],
  title: '旧档案',
}, participants);
assert.equal(legacy.customPrompt, '');
assert.equal(legacy.customPromptEnabled, false);

const normalized = normalizeStoryDefinition({
  customPrompt: '  采用冷峻的悬疑笔法，所有线索必须能从前文推断。  ',
  participantIds: ['primary'],
  title: '雾港来信',
}, participants);
assert.equal(normalized.customPromptEnabled, true);
assert.equal(normalized.customPrompt, '采用冷峻的悬疑笔法，所有线索必须能从前文推断。');

normalized.source = 'random';
const replacement = prepareStoryDraftForGeneration(normalized, 'random');
assert.equal(replacement.title, '');
assert.equal(replacement.customPromptEnabled, true);
assert.equal(replacement.customPrompt, normalized.customPrompt);

const draftPrompt = buildStoryDraftUserPrompt({
  draft: normalized,
  mode: 'complete',
  participants,
});
assert.match(draftPrompt, /自定义提示词（破甲词）/);
assert.match(draftPrompt, /冷峻的悬疑笔法/);

const definition = createEmptyStoryDefinition(['primary']);
definition.title = '雾港来信';
definition.customPromptEnabled = true;
definition.customPrompt = '采用冷峻的悬疑笔法，所有线索必须能从前文推断。';
const session = createStorySession(definition);
const context = buildStoryDefinitionPromptContext(session);
assert.match(context, /自定义提示词（破甲词/);
assert.match(context, /冷峻的悬疑笔法/);

const directorPrompt = buildStoryTurnDirectorPrompt({
  historyMessages: [], participants, session, userInput: '检查信封。',
});
const narratorPrompt = buildStoryNarratorPrompt({
  historyMessages: [], session, userInput: '检查信封。',
});
assert.match(directorPrompt, /冷峻的悬疑笔法/);
assert.match(narratorPrompt, /冷峻的悬疑笔法/);

definition.customPromptEnabled = false;
assert.doesNotMatch(buildStoryDefinitionPromptContext(session), /冷峻的悬疑笔法/);

console.log('story custom prompt smoke: PASS');
