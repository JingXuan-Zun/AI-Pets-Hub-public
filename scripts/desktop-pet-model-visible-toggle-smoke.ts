import assert from 'node:assert/strict';
import {
  applyDesktopPetSlotChanges,
  getDesktopPetSlot,
  getRenderableDesktopPetSlots,
  getVisibleDesktopPetModelSlots,
  isPrimaryDesktopPetShown,
} from '../src/multiPetRoster';
import { readProjectFile } from './smokeTestHarness.ts';

function createTestPersonality(name: string) {
  return {
    beginDialogs: [],
    chatAvatarUrl: '',
    chatHistoryMemory: '',
    customErrorMessage: '',
    greeting: '',
    knowledgeBase: '',
    name,
    systemInstruction: '',
    traits: [],
    userMemory: '',
    webLearningEnabled: false,
    webSearchEnabled: false,
  };
}

const config = {
  autoMovementEnabled: true,
  companionPets: [
    {
      autoMovementEnabled: true,
      currentAction: 'IDLE',
      enabled: true,
      id: 'companion-pet-2',
      modelType: '2d',
      modelUrl: '',
      modelVisible: true,
      personality: createTestPersonality('visible companion'),
      pointerLookEnabled: true,
      position: { x: 0, y: 0 },
      scale: 1,
      stats: { affection: 80, fatigue: 8, hunger: 24 },
    },
  ],
  currentAction: 'WALKING',
  modelType: '2d',
  modelUrl: '',
  personality: createTestPersonality('primary'),
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  stats: { affection: 85, fatigue: 5, hunger: 20 },
} as any;

const hiddenModelConfig = applyDesktopPetSlotChanges(config, 'companion-pet-2', {
  modelVisible: false,
});

assert.equal(hiddenModelConfig.companionPets[0]?.enabled, true);
assert.equal(hiddenModelConfig.companionPets[0]?.modelVisible, false);
assert.equal(
  getRenderableDesktopPetSlots(hiddenModelConfig).some((slot) => slot.id === 'companion-pet-2'),
  true,
  'hidden-model companions should stay enabled for chat/config targets',
);
assert.equal(
  getVisibleDesktopPetModelSlots(hiddenModelConfig).some((slot) => slot.id === 'companion-pet-2'),
  false,
  'hidden-model companions should be excluded from the render slot collection',
);

// Slot 1 can be hidden or turned off like any other slot.
const hiddenPrimaryConfig = applyDesktopPetSlotChanges(config, 'primary', { modelVisible: false });
assert.equal(hiddenPrimaryConfig.primaryPetModelVisible, false);
assert.equal(isPrimaryDesktopPetShown(hiddenPrimaryConfig), false);
assert.equal(getVisibleDesktopPetModelSlots(hiddenPrimaryConfig).some((slot) => slot.id === 'primary'), false);
assert.equal(getRenderableDesktopPetSlots(hiddenPrimaryConfig).some((slot) => slot.id === 'primary'), true,
  'a hidden slot 1 still answers in chat');

const disabledPrimaryConfig = applyDesktopPetSlotChanges(config, 'primary', { enabled: false });
assert.equal(getDesktopPetSlot(disabledPrimaryConfig, 'primary')?.enabled, false);
assert.deepEqual(getRenderableDesktopPetSlots(disabledPrimaryConfig).map((slot) => slot.id), ['companion-pet-2'],
  'a disabled slot 1 leaves chat targets');
assert.equal(isPrimaryDesktopPetShown(config), true, 'old configs without the fields keep slot 1 on');

const everyoneOff = applyDesktopPetSlotChanges(disabledPrimaryConfig, 'companion-pet-2', { enabled: false });
assert.deepEqual(getRenderableDesktopPetSlots(everyoneOff).map((slot) => slot.id), ['primary'],
  'with every slot off, slot 1 still answers chat and voice');
assert.equal(getVisibleDesktopPetModelSlots(everyoneOff).length, 0);

const renderStateSource =readProjectFile('src/components/pet/usePetContainerCompanionRenderState.ts');
const settingsPanelSource = readProjectFile('src/components/SettingsPanel.tsx');
const movementHelpersSource = readProjectFile('src/components/pet/usePetContainerMovementHelpers.ts');
const collisionSyncSource = readProjectFile('src/components/pet/usePetContainerCompanionCollisionSyncEffect.ts');
const boundaryRecoverySource = readProjectFile('src/components/pet/usePetContainerBoundaryRecoveryEffects.ts');
const companionMotionTickSource = readProjectFile('src/pet-runtime/companion/advanceCompanionMotionTick.ts');
const companionRuntimeSource = readProjectFile('src/pet-runtime/companion/useCompanionPetRuntime.ts');
const companionRuntimeLayerSource = readProjectFile('src/components/pet/CompanionPetRuntimeLayer.tsx');
const companionInteractionSource = readProjectFile('src/pet-runtime/interactions/useCompanionPetInteractionController.ts');
const visualBoundsControllerSource = readProjectFile('src/components/pet/usePetVisualBoundsController.ts');
const avatarRuntimeEventHandlerSource = readProjectFile('src/components/pet/usePetContainerAvatarRuntimeEventHandler.ts');

assert.match(renderStateSource, /getVisibleDesktopPetModelSlots/);
assert.match(settingsPanelSource, /handleUpdatePetModelVisible[\s\S]*modelVisible:\s*visible/);
assert.match(movementHelpersSource, /companionPets\.filter\(\(pet\) => pet\.enabled && pet\.modelVisible\)/);
assert.match(collisionSyncSource, /if \(!pet\.enabled \|\| !pet\.modelVisible\)/);
assert.match(boundaryRecoverySource, /if \(!pet\.enabled \|\| !pet\.modelVisible\)/);
assert.match(companionMotionTickSource, /if \(!pet \|\| !pet\.enabled \|\| !pet\.modelVisible\)/);
assert.match(companionRuntimeSource, /!currentSlot\.enabled \|\| !currentSlot\.modelVisible/);
assert.match(companionRuntimeLayerSource, /slot\.isPrimary \|\| !slot\.enabled \|\| !slot\.modelVisible/);
assert.match(companionInteractionSource, /!currentSlot\.enabled \|\| !currentSlot\.modelVisible/);
assert.match(visualBoundsControllerSource, /\.filter\(\(pet\) => pet\.enabled && pet\.modelVisible\)/);
assert.match(avatarRuntimeEventHandlerSource, /!slot\.enabled \|\| !slot\.modelVisible/);

console.log('desktop pet model visible toggle smoke ok');
