const assert = require('node:assert/strict');
const fs = require('node:fs');

const conversation = fs.readFileSync('src/components/chat/PetChatConversation.tsx', 'utf8');
const panel = fs.readFileSync('src/components/chat/story/StoryModePanel.tsx', 'utf8');

assert.match(conversation, /min-h-0 min-w-0 flex-1 basis-0 flex-col/u);
assert.match(panel, /min-h-0 w-full min-w-0 flex-1 basis-0 overflow-y-auto/u);
assert.match(panel, /normalizeStoryDefinition\(story, participants, story\.source\)/u);

console.log('story JSON participant layout smoke ok');
