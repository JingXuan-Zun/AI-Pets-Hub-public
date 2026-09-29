import assert from 'node:assert/strict';
import { MAX_DESKTOP_PET_COUNT } from '../src/desktopPetSlotLimits';
import {
  addDesktopPetSlot,
  canAddDesktopPetSlot,
  getDesktopPetSlot,
  getDesktopPetSlots,
  removeDesktopPetSlot,
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

function createTestCompanionPet(slotNumber: number) {
  return {
    autoMovementEnabled: true,
    currentAction: 'IDLE',
    enabled: false,
    id: `companion-pet-${slotNumber}`,
    modelVisible: true,
    modelType: '2d',
    modelUrl: '',
    personality: createTestPersonality(`pet ${slotNumber}`),
    pointerLookEnabled: true,
    position: { x: 0, y: 0 },
    scale: 1,
    stats: { affection: 80, fatigue: 8, hunger: 24 },
  } as const;
}

const defaultLikeConfig = {
  autoMovementEnabled: true,
  customModelPresets: [],
  companionPets: Array.from({ length: 7 }, (_, index) => createTestCompanionPet(index + 2)),
  currentAction: 'WALKING',
  folders: [],
  foodAppearances: [],
  musicAssets: [],
  modelType: '2d',
  modelUrl: '',
  personality: createTestPersonality('primary'),
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  settings: {},
  stats: { affection: 85, fatigue: 5, hunger: 20 },
} as any;

assert.equal(MAX_DESKTOP_PET_COUNT, 100, 'desktop pet roster should allow up to 100 slots');
assert.equal(getDesktopPetSlots(defaultLikeConfig).length, 8, 'default roster should keep the existing 8 slots');
assert.equal(canAddDesktopPetSlot(defaultLikeConfig), true, 'default roster should expose room for add-slot UI');

const configWithNinthSlot = addDesktopPetSlot(defaultLikeConfig);
const ninthSlot = getDesktopPetSlots(configWithNinthSlot).at(-1);
assert.equal(getDesktopPetSlots(configWithNinthSlot).length, 9);
assert.equal(ninthSlot?.slotNumber, 9);
assert.equal(ninthSlot?.enabled, true, 'newly added slots should be enabled immediately');

const configWithoutFourthSlot = removeDesktopPetSlot(defaultLikeConfig, 'companion-pet-4');
assert.equal(getDesktopPetSlots(configWithoutFourthSlot).length, 7);
assert.equal(getDesktopPetSlot(configWithoutFourthSlot, 'companion-pet-4'), null);
assert.equal(
  configWithoutFourthSlot.companionPets.some((pet: ReturnType<typeof createTestCompanionPet>) => (
    pet.id === 'companion-pet-4'
    || pet.personality.name === 'pet 4'
    || pet.position.x === 4004
  )),
  false,
  'removing a companion slot should remove its associated data by id',
);
assert.equal(
  removeDesktopPetSlot(defaultLikeConfig, 'primary'),
  defaultLikeConfig,
  'primary desktop pet slot should not be removable',
);

const configWithReusedFourthSlot = addDesktopPetSlot(configWithoutFourthSlot);
const reusedFourthSlot = getDesktopPetSlot(configWithReusedFourthSlot, 'companion-pet-4');
assert.equal(reusedFourthSlot?.slotNumber, 4, 'adding after deletion should reuse the freed slot number');
assert.equal(
  new Set(configWithReusedFourthSlot.companionPets.map((pet: ReturnType<typeof createTestCompanionPet>) => pet.id)).size,
  configWithReusedFourthSlot.companionPets.length,
  'companion pet ids should stay unique after delete and add',
);

let fullConfig = defaultLikeConfig;
while (canAddDesktopPetSlot(fullConfig)) {
  fullConfig = addDesktopPetSlot(fullConfig);
}

assert.equal(getDesktopPetSlots(fullConfig).length, 100);
assert.equal(canAddDesktopPetSlot(fullConfig), false);
assert.equal(
  getDesktopPetSlots(addDesktopPetSlot(fullConfig)).length,
  100,
  'adding past the limit should be a no-op',
);

const selectorSource = readProjectFile('src/components/settings/DesktopPetSlotSelector.tsx');
const settingsPanelSource = readProjectFile('src/components/SettingsPanel.tsx');
const normalizationSource = readProjectFile('src/petConfigNormalization.ts');

assert.match(selectorSource, /Plus/, 'slot selector should render a plus-button affordance');
assert.match(selectorSource, /Trash2/, 'slot selector should render a delete-slot affordance');
assert.match(selectorSource, /onAddSlot/, 'slot selector should expose an add-slot callback');
assert.match(selectorSource, /onRemoveSlot/, 'slot selector should expose a remove-slot callback');
assert.match(selectorSource, /MAX_DESKTOP_PET_SLOTS/, 'slot selector should display and enforce the slot limit');
assert.match(settingsPanelSource, /handleAddPetSlot[\s\S]*onAddPetSlot:\s*handleAddPetSlot/);
assert.match(settingsPanelSource, /handleRemovePetSlot[\s\S]*onRemovePetSlot:\s*handleRemovePetSlot/);
assert.match(
  normalizationSource,
  /const rawCompanionPets = Array\.isArray\(input\) \? input : DEFAULT_CONFIG\.companionPets/,
  'normalization should distinguish missing companion input from an explicit empty/deleted companion list',
);
assert.doesNotMatch(
  normalizationSource,
  /Math\.max\(DEFAULT_CONFIG\.companionPets\.length,\s*rawCompanionPets\.length\)/,
  'normalization should not re-add default companion slots after explicit deletion',
);

console.log('desktop pet slot add limit smoke ok');
