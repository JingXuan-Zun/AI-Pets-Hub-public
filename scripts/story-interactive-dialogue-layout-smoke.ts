import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

// The video-call view (04cb10b) lives inside the normal chat window: the window stays resizable and
// draggable, gets a larger minimum, is placed once on entering and restored on leaving.
const chatWindow = readProjectFile('src/components/ChatWindow.tsx');
const managerState = readProjectFile('electron/windowManager/windowManagerState.cjs');
const ownership = readProjectFile('electron/windowManager/windowOwnershipStateAdapters.cjs');

assert.match(chatWindow, /interactiveDialogueActive && chatMode === 'single'/u);
assert.match(chatWindow, /minHeight: isInteractiveDialogue \? 600 : 480/u);
assert.match(chatWindow, /minWidth: isInteractiveDialogue \? 560 : 360/u);
assert.match(chatWindow, /useStandaloneWindowResize\(\{\s*enabled: true/u);
assert.match(managerState, /wasInteractiveDialogueChatActive: false/u);
assert.match(ownership, /getWasInteractive: \(\) => managerState\.wasInteractiveDialogueChatActive/u);
assert.match(ownership, /setWasInteractive: \(active\) => \{ managerState\.wasInteractiveDialogueChatActive = active; \}/u);
const boundsSync = readModuleProjectFunction('electron/windowManager/chatWindowBoundsSync.cjs', 'createInteractiveChatWindowBoundsSync');
assert.match(boundsSync, /if \(wasInteractive && isInteractive\) \{/u, 'placed once on entering, then left to the user');
assert.match(boundsSync, /wasInteractive && !isInteractive/u, 'restored on leaving');
assert.match(boundsSync, /isBelowNormalMinimum/u);
assert.match(boundsSync, /currentBounds\.height < limits\.minHeight/u);
assert.match(boundsSync, /getChatWindow\(\)\.setBounds\(getResolvedChatPanelWindowBounds\(\), false\)/u);

console.log('story interactive dialogue layout smoke: PASS');
