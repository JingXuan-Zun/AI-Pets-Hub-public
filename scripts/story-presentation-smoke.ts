import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const MAX_SOURCE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const budgetFiles = [
  'src/components/chat/PetChatConversationMessageFeed.tsx',
  'src/components/chat/story/StoryTurnContentCard.tsx',
  'src/components/chat/story/StoryTurnReview.tsx',
  'src/components/chat/story/StoryStateOverview.tsx',
  'src/components/chat/story/StoryActionChoices.tsx',
  'src/components/chat/story/StoryLibraryPanel.tsx',
  'src/components/chat/story/StoryModePanel.tsx',
  'src/components/chat/story/StoryPromptSettings.tsx',
  'src/components/chat/story/StoryPreview.tsx',
  'src/components/chat/story/storyDefaults.ts',
  'src/components/chat/story/storyDefinitionPromptContext.ts',
  'src/components/chat/story/storyDraftGenerationInput.ts',
  'src/components/chat/story/storyDraftNormalization.ts',
  'src/components/chat/story/storyDraftPrompt.ts',
  'src/components/chat/story/storyTypes.ts',
  'src/components/chat/story/storyButtonStyles.ts',
  'src/components/chat/story/StoryConversationSidebarPanel.tsx',
  'src/components/chat/story/StorySessionToolbar.tsx',
  'src/components/chat/story/StoryTurnControls.tsx',
  'src/components/chat/story/storyNarrator.ts',
  'src/components/chat/story/storyTurnRuntime.ts',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectSourceBudget(relativePath: string) {
  const sourceText = readFileSync(relativePath, 'utf8');
  assert.ok(sourceText.split(/\r?\n/u).length <= MAX_SOURCE_LINES, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(source, node.body.end) - line(source, node.getStart(source)) + 1;
      assert.ok(size <= MAX_FUNCTION_LINES, `${relativePath} function exceeds 50 lines: ${size}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

budgetFiles.forEach(inspectSourceBudget);

const bubbleSource = readFileSync('src/components/chat/PetChatConversationMessageBubble.tsx', 'utf8');
const conversationSource = readFileSync('src/components/chat/PetChatConversation.tsx', 'utf8');
const conversationHeaderSource = readFileSync('src/components/chat/PetChatConversationHeader.tsx', 'utf8');
const storySidebarSource = readFileSync('src/components/chat/story/StoryConversationSidebarPanel.tsx', 'utf8');
const storyToolbarSource = readFileSync('src/components/chat/story/StorySessionToolbar.tsx', 'utf8');
const storyContentCardSource = readFileSync('src/components/chat/story/StoryTurnContentCard.tsx', 'utf8');
const messagesSource = [
  readFileSync('src/components/chat/PetChatConversationMessages.tsx', 'utf8'),
  readFileSync('src/components/chat/PetChatConversationMessageFeed.tsx', 'utf8'),
  storyContentCardSource,
].join('\n');
const narrativeTextSource = readFileSync('src/components/chat/story/StoryNarrativeText.tsx', 'utf8');
const librarySource = readFileSync('src/components/chat/story/StoryLibraryPanel.tsx', 'utf8');
const reviewSource = readFileSync('src/components/chat/story/StoryTurnReview.tsx', 'utf8');
const stateOverviewSource = readFileSync('src/components/chat/story/StoryStateOverview.tsx', 'utf8');
const storyActionChoicesSource = readFileSync('src/components/chat/story/StoryActionChoices.tsx', 'utf8');
const storyButtonStylesSource = readFileSync('src/components/chat/story/storyButtonStyles.ts', 'utf8');
const storyLibraryPanelSource = readFileSync('src/components/chat/story/StoryLibraryPanel.tsx', 'utf8');
const storyModePanelSource = readFileSync('src/components/chat/story/StoryModePanel.tsx', 'utf8');
const storyPromptSettingsSource = readFileSync('src/components/chat/story/StoryPromptSettings.tsx', 'utf8');
const recoverySource = readFileSync('src/components/chat/story/storySessionRecovery.ts', 'utf8');
const sendExecutionSource = readFileSync('src/components/chat/petChatMessageSendExecution.ts', 'utf8');
const turnRuntimeSource = readFileSync('src/components/chat/story/storyTurnRuntime.ts', 'utf8');
const conversationSourceWithSession = readFileSync('src/components/chat/PetChatConversation.tsx', 'utf8');
const windowSource = readFileSync('src/components/ChatWindow.tsx', 'utf8');

assert.match(bubbleSource, /bg-white\/95/);
assert.match(bubbleSource, /text-left text-\[15px\]/);
assert.match(bubbleSource, /StoryNarrativeText/);
assert.match(narrativeTextSource, /segment\.kind === 'dialogue'/);
assert.match(narrativeTextSource, /color: dialogueColor/);
assert.match(messagesSource, /StoryTurnReview/);
assert.match(messagesSource, /StoryTurnControls/);
assert.match(messagesSource, /story-turn-content-card/);
assert.match(messagesSource, /embeddedStoryNarration/);
assert.match(messagesSource, /embedded/);
assert.match(messagesSource, /index === narrationIndex/);
assert.ok(storyContentCardSource.indexOf('<StoryTurnReview') < storyContentCardSource.indexOf('<PetChatConversationMessageBubble'));
assert.ok(storyContentCardSource.indexOf('<PetChatConversationMessageBubble') < storyContentCardSource.indexOf('<StoryStateOverview'));
assert.ok(storyContentCardSource.indexOf('story-turn-content-card') < storyContentCardSource.indexOf('<StoryTurnControls'));
assert.match(reviewSource, /<details/);
assert.match(reviewSource, /思考 \/ 剧情分析与输出计划（公开）/);
assert.match(reviewSource, /open/);
assert.match(stateOverviewSource, /<details/);
assert.match(stateOverviewSource, /角色当前心理/);
assert.match(storyButtonStylesSource, /!bg-sky-950/);
assert.match(storyButtonStylesSource, /!text-white/);
assert.match(storyButtonStylesSource, /hover:!bg-sky-900/);
assert.match(storyActionChoicesSource, /STORY_PRIMARY_BUTTON_CLASS/);
assert.match(storyLibraryPanelSource, /STORY_PRIMARY_BUTTON_CLASS/);
assert.match(storyModePanelSource, /STORY_PRIMARY_BUTTON_CLASS/);
assert.ok(storyModePanelSource.indexOf('<StoryPromptSettings') < storyModePanelSource.indexOf('<StorySourceButtons'));
assert.match(storyPromptSettingsSource, /role="switch"/);
assert.match(storyPromptSettingsSource, /自定义提示词/);
assert.match(storyPromptSettingsSource, /破甲词/);
assert.match(storyPromptSettingsSource, /本地不扫描敏感词、不审核题材/);
assert.match(storyPromptSettingsSource, /不会根据提示词内容或额外 JSON 字段拒绝导入/);
assert.match(storyPromptSettingsSource, /absolute left-1 top-1/);
assert.match(storyPromptSettingsSource, /props\.checked \? 'translate-x-5' : 'translate-x-0'/);
assert.doesNotMatch(storyPromptSettingsSource, /绕过模型|突破.*安全/);
assert.match(storyToolbarSource, /STORY_PRIMARY_BUTTON_CLASS/);
assert.match(recoverySource, /resolveStoryDefinitionForSend/);
assert.match(recoverySource, /shouldRestoreStorySession/);
assert.match(sendExecutionSource, /shouldRestoreStorySession/);
assert.match(turnRuntimeSource, /buildFallbackStoryNarration/);
assert.match(conversationSourceWithSession, /startStorySession\(activeStoryDefinition\)/);
assert.doesNotMatch(conversationSource, /<StoryTurnControls/);
assert.doesNotMatch(conversationSource, /<StorySessionToolbar/);
assert.match(conversationHeaderSource, /StoryConversationSidebarPanel/);
assert.match(storySidebarSource, /互动故事/);
assert.match(storySidebarSource, /<StorySessionToolbar/);
assert.ok(storySidebarSource.indexOf('互动故事') < storySidebarSource.indexOf('<StorySessionToolbar'));
assert.match(storyToolbarSource, /当前故事/);
assert.match(storyToolbarSource, /w-full/);
assert.match(librarySource, /故事设定、进度和聊天记录将一并删除/);
assert.match(librarySource, /onDelete/);
assert.match(windowSource, /'故事 \/\/ COMMS'/);
assert.doesNotMatch(windowSource, /\\\\u6545\\\\u4e8b/);

console.log('story presentation smoke: PASS');
