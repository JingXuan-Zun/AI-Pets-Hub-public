import assert from 'node:assert/strict';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  applyDesktopPetSlotChanges,
  getDesktopPetSlot,
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
      modelUrl: 'companion-before.png',
      modelVisible: true,
      personality: createTestPersonality('companion'),
      pointerLookEnabled: true,
      position: { x: 0, y: 0 },
      scale: 1,
      stats: { affection: 80, fatigue: 8, hunger: 24 },
    },
  ],
  currentAction: 'WALKING',
  modelType: '2d',
  modelUrl: 'primary-before.png',
  personality: createTestPersonality('primary'),
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  stats: { affection: 85, fatigue: 5, hunger: 20 },
} as any;

const nextConfig = applyDesktopPetSlotChanges(config, PRIMARY_DESKTOP_PET_SLOT_ID, {
  modelType: '3d',
  modelUrl: 'primary-after.glb',
});

assert.equal(nextConfig.modelType, '3d');
assert.equal(nextConfig.modelUrl, 'primary-after.glb');
assert.equal(nextConfig.companionPets[0]?.modelUrl, 'companion-before.png');
assert.equal(getDesktopPetSlot(nextConfig, PRIMARY_DESKTOP_PET_SLOT_ID)?.modelUrl, 'primary-after.glb');

const actionHandlersSource = readProjectFile('src/components/pet/usePetContainerActionHandlers.ts');
const panelControllerSource = readProjectFile('src/components/pet/usePetPanelController.ts');
const sharedStateSyncSource = readProjectFile('src/hooks/useDesktopShellSharedStateSync.ts');
const settingsWindowSource = readProjectFile('src/SettingsWindowApp.tsx');

assert.match(
  actionHandlersSource,
  /handleOpenSettingsHomePanel[\s\S]*selectPanelPet\(panelPetId \|\| PRIMARY_DESKTOP_PET_SLOT_ID\)[\s\S]*openSettingsPanel\('personality'\)/,
  'opening settings from the pet menu should first sync the active panel pet target',
);
assert.match(
  actionHandlersSource,
  /handleOpenControlsPanel[\s\S]*selectPanelPet\(panelPetId \|\| PRIMARY_DESKTOP_PET_SLOT_ID\)[\s\S]*openSettingsPanel\('controls'\)/,
  'opening controls from the pet menu should first sync the active panel pet target',
);
assert.match(
  panelControllerSource,
  /onRequestSharedStateSync\?\.\(0\)[\s\S]*onRequestSettingsWindow\?\.\(\)/,
  'external settings window should request an immediate shared-state sync before opening',
);
assert.match(
  sharedStateSyncSource,
  /if \(nextSyncDelay <= 0\)[\s\S]*desktopPetShellRuntime\.syncSharedState\(pendingState\)/,
  'zero-delay shared-state sync should send immediately instead of waiting for a timer',
);
assert.match(
  settingsWindowSource,
  /initialSelectedPetSlotId=\{sharedState\.chatState\.activePetId\}/,
  'settings window should still initialize from the shared active pet after the explicit sync',
);

console.log('desktop pet primary model switch smoke ok');
