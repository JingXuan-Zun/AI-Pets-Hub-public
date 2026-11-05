import assert from 'node:assert/strict';
import { resolvePetInteractiveDialogueLayerSurface } from '../src/components/pet/petContainerLayerSurface';
import { readProjectFile } from './smokeTestHarness.ts';

// Since 2026-10-19 the interactive dialogue draws the character inside the chat window. On the
// desktop that character is hidden while the call is open; the other roles stay as they are.
// (The desktop "stage" mode that moved and enlarged the pet was removed on 2026-11-05.)
assert.deepEqual(
  resolvePetInteractiveDialogueLayerSurface(true, 'primary', 'primary'),
  { isInteractiveDialogueHidden: true },
  'the role in the call is hidden on the desktop (it is drawn in the chat window)',
);
assert.deepEqual(
  resolvePetInteractiveDialogueLayerSurface(true, 'companion-a', 'primary'),
  { isInteractiveDialogueHidden: false },
  'other roles stay on the desktop',
);
assert.deepEqual(
  resolvePetInteractiveDialogueLayerSurface(false, 'primary', 'primary'),
  { isInteractiveDialogueHidden: false },
  'nothing is hidden when no call is open',
);

const sceneSource = readProjectFile('src/components/pet/PetContainerScene.tsx');
assert.match(
  sceneSource,
  /\.filter\(\(layerProps\) => !layerProps\.isInteractiveDialogueHidden\)/,
  'hidden companion runtimes must be unmounted instead of only made transparent',
);
assert.match(
  sceneSource,
  /!primaryPetAvatarLayerProps\.isInteractiveDialogueHidden && \(/,
  'the hidden primary runtime must be unmounted when another role owns the stage',
);

for (const layerSource of [readProjectFile('src/components/pet/PetAvatarLayer.tsx'), readProjectFile('src/components/pet/PetCompanionLayer.tsx')]) {
  assert.doesNotMatch(layerSource, /isInteractiveDialogueMode|interactiveDialoguePosition/u, 'the removed desktop stage mode stays removed');
}

const actionHandlerSource = readProjectFile('src/components/pet/usePetContainerActionHandlers.ts');
assert.match(
  actionHandlerSource,
  /const targetPetId = panelPetId \|\| PRIMARY_DESKTOP_PET_SLOT_ID;[\s\S]*selectPanelPet\(targetPetId\);[\s\S]*openInteractiveDialogue\(\);/,
  'entering interaction dialogue must lock the role selected by the user before opening the stage',
);

const overlaySource = readProjectFile('src/components/chat/PetChatOverlay.tsx');
assert.match(
  overlaySource,
  /!isInteractiveDialogue && \(\s*<PetChatOverlayBubble/,
  'interactive dialogue should not render the ordinary desktop chat bubble',
);

const conversationSource = readProjectFile('src/components/chat/PetChatConversation.tsx');
assert.match(
  conversationSource,
  /!isInteractiveDialogue && \(\s*(?:<div[^>]*>\s*)?<PetChatConversationHeader/,
  'interactive dialogue should hide the normal chat target selector and header',
);

console.log('interactive dialogue isolation smoke ok');