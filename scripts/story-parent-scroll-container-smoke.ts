import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/chat/PetChatConversation.tsx');
assert.match(source, /chatMode === 'story'[^\n]*\n[\s\S]{0,240}overflow-clip/u);
assert.doesNotMatch(source, /chatMode === 'story'[^\n]*\n[\s\S]{0,240}overflow-hidden/u);

console.log('story parent scroll container smoke: PASS');
