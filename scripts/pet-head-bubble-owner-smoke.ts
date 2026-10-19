import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';

// Regression: the shared head bubble followed the selected (panel) pet, so
// selecting a companion drew its reply twice — once in the shared bubble and
// once in the companion's own bubble — stacked over its name tag. Each pet
// shows only its own words: the shared bubble belongs to the primary pet.
const { containerSource, panelsLayerSource } = readProjectSources({
  containerSource: 'src/components/PetContainer.tsx',
  panelsLayerSource: 'src/components/pet/PetPanelsLayer.tsx',
});

assert.match(containerSource, /latestPetMessage: primaryLatestPetMessage/u);
assert.doesNotMatch(containerSource, /latestPetMessage: activePanelLatestPetMessage/u);
assert.match(containerSource, /isPrimaryTyping,/u);
assert.doesNotMatch(containerSource, /isPrimaryTyping: isActivePanelPetTyping/u);
assert.match(containerSource, /headBubbleAnchorPosition: petAnchorPosition/u);
assert.match(containerSource, /headBubbleVisualBounds: petVisualBounds/u);
assert.match(
  containerSource,
  /webSearchStatusMessage: panelPetId === PRIMARY_DESKTOP_PET_SLOT_ID \? webSearchStatusMessage : ''/u,
);

// Quick menu and side panels still follow the selected pet; only the
// bubble uses the primary anchor.
assert.match(containerSource, /petAnchorPosition: activePanelPetAnchorPosition/u);
assert.match(panelsLayerSource, /petAnchorPosition=\{headBubbleAnchorPosition\}/u);
assert.match(panelsLayerSource, /petVisualBounds=\{headBubbleVisualBounds\}/u);

console.log('pet head bubble owner smoke passed');

// Every pet uses the same white bubble card, each showing only its own text.
const { companionLayerSource, overlayBubbleSource } = readProjectSources({
  companionLayerSource: 'src/components/pet/PetCompanionLayer.tsx',
  overlayBubbleSource: 'src/components/chat/PetChatOverlayBubble.tsx',
});
assert.match(overlayBubbleSource, /<PetSpeechBubbleCard text=\{displayMessage\}/u);
assert.match(companionLayerSource, /<PetSpeechBubbleCard text=\{displayBubbleMessage\}/u);
assert.match(companionLayerSource, /\{chatBubbleEnabled && displayBubbleMessage && \(/u);
assert.match(companionLayerSource, /latestMessage,\n\s*\}\);/u);
assert.doesNotMatch(companionLayerSource, /textShadow: '0 1px 6px/u);

console.log('pet bubbles share one card smoke passed');
