import assert from 'node:assert/strict';
import { resolvePetInteractiveDialogueLayerSurface } from '../src/components/pet/petContainerLayerSurface';
import { readProjectFile } from './smokeTestHarness.ts';

const primarySurface = resolvePetInteractiveDialogueLayerSurface(true, 'primary', 'primary');
assert.deepEqual(primarySurface, {
  isInteractiveDialogueHidden: false,
  isInteractiveDialogueMode: true,
}, 'the selected role should be the only role shown in the interaction stage');

const backgroundSurface = resolvePetInteractiveDialogueLayerSurface(true, 'companion-a', 'primary');
assert.deepEqual(backgroundSurface, {
  isInteractiveDialogueHidden: true,
  isInteractiveDialogueMode: false,
}, 'a non-selected role should leave the interaction stage completely');

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

const layoutSource = readProjectFile('src/components/pet/usePetContainerPanelLayout.ts');
assert.match(
  layoutSource,
  /INTERACTIVE_DIALOGUE_MAX_SHELL_SIZE = 920[\s\S]*INTERACTIVE_DIALOGUE_STAGE_HEIGHT_RATIO = 0\.9[\s\S]*INTERACTIVE_DIALOGUE_CHAT_CENTER_Y_RATIO = 0\.85/,
  'the interaction stage should favor a large, lower-screen portrait composition with the composer at the bottom',
);

const avatarLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const companionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
for (const layerSource of [avatarLayerSource, companionLayerSource]) {
  assert.match(
    layerSource,
    /isInteractiveDialogueMode \? 'pet-interactive-dialogue-enter relative pointer-events-none'/,
    'the selected role should enter the interaction stage from the bottom on every model renderer',
  );
}
assert.match(
  readProjectFile('src/index.css'),
  /@keyframes pet-interactive-dialogue-enter[\s\S]*translate: 0 46vh/,
  'the interaction stage should animate its selected role up from below the screen',
);

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
  /!isInteractiveDialogue && \(\s*<PetChatConversationHeader/,
  'interactive dialogue should hide the normal chat target selector and header',
);

console.log('interactive dialogue isolation smoke ok');