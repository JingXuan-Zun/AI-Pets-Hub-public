import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const chatWindow = readProjectFile('src/components/ChatWindow.tsx');
const windowManager = readProjectFile('electron/windowManager.cjs');

assert.match(chatWindow, /interactiveDialogueActive && chatMode === 'single'/u);
assert.match(chatWindow, /maxHeight: isInteractiveDialogue \? 900 : 1248/u);
assert.match(chatWindow, /enabled: !isInteractiveDialogue/u);
assert.match(windowManager, /let wasInteractiveDialogueChatActive = false;/u);
const boundsSync=readModuleProjectFunction('electron/windowManager/chatWindowBoundsSync.cjs','createInteractiveChatWindowBoundsSync');
assert.match(windowManager,/getWasInteractive: \(\) => wasInteractiveDialogueChatActive/);
assert.match(windowManager,/setWasInteractive: \(active\) => \{ wasInteractiveDialogueChatActive = active; \}/);
assert.match(boundsSync, /getWasInteractive\(\) && !isInteractive/u);
assert.match(boundsSync, /isBelowNormalMinimum/u);
assert.match(boundsSync, /currentBounds\.height < limits\.minHeight/u);
assert.match(boundsSync, /getChatWindow\(\)\.setBounds\(getResolvedChatPanelWindowBounds\(\), false\)/u);

console.log('story interactive dialogue layout smoke: PASS');
