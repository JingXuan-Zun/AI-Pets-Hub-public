import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const chatWindow = readProjectFile('src/components/ChatWindow.tsx');
const windowManager = readProjectFile('electron/windowManager.cjs');

assert.match(chatWindow, /interactiveDialogueActive && chatMode === 'single'/u);
assert.match(chatWindow, /maxHeight: isInteractiveDialogue \? 900 : 1248/u);
assert.match(chatWindow, /enabled: !isInteractiveDialogue/u);
assert.match(windowManager, /let wasInteractiveDialogueChatActive = false;/u);
assert.match(windowManager, /wasInteractiveDialogueChatActive && !isInteractive/u);
assert.match(windowManager, /isBelowNormalMinimum/u);
assert.match(windowManager, /currentBounds\.height < limits\.minHeight/u);
assert.match(windowManager, /chatWindow\.setBounds\(getResolvedChatPanelWindowBounds\(\), false\)/u);

console.log('story interactive dialogue layout smoke: PASS');
