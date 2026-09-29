import assert from 'node:assert/strict';
import {
  applyDesktopPetModelSelection,
  getVisibleDesktopPetModelSlots,
} from '../src/multiPetRoster';
import { readProjectFile } from './smokeTestHarness.ts';

const config = {
  autoMovementEnabled: true,
  companionPets: [{
    autoMovementEnabled: true,
    currentAction: 'IDLE',
    enabled: true,
    id: 'companion-pet-2',
    modelType: '2d',
    modelUrl: 'old.png',
    modelVisible: false,
    personality: { name: 'companion' },
    pointerLookEnabled: true,
    position: { x: 240, y: -120 },
    scale: 1,
    stats: { affection: 80, fatigue: 8, hunger: 24 },
  }],
  currentAction: 'IDLE',
  modelType: 'live2d',
  modelUrl: 'primary.model3.json',
  personality: { name: 'primary' },
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  stats: { affection: 80, fatigue: 8, hunger: 24 },
} as any;

const selectedConfig = applyDesktopPetModelSelection(config, 'companion-pet-2', {
  modelType: 'live2d',
  modelUrl: 'companion.model3.json',
});
const companion = selectedConfig.companionPets[0];
assert.equal(companion?.enabled, true);
assert.equal(companion?.modelVisible, true, 'selecting a model should restore its slot visibility');
assert.equal(companion?.modelType, 'live2d');
assert.equal(companion?.modelUrl, 'companion.model3.json');
assert.deepEqual(
  getVisibleDesktopPetModelSlots(selectedConfig).map((slot) => slot.id),
  ['primary', 'companion-pet-2'],
  'primary and companion Live2D slots should both enter the render collection',
);

const settingsPanelSource = readProjectFile('src/components/SettingsPanel.tsx');
const modelAssetsStateSource = readProjectFile('src/components/settings/useSettingsPanelModelAssetsState.ts');
const companionRuntimeLayerSource = readProjectFile('src/components/pet/CompanionPetRuntimeLayer.tsx');
const companionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
assert.match(settingsPanelSource, /handleUpdateModel[\s\S]*applyDesktopPetModelSelection/u);
assert.match(modelAssetsStateSource, /firstImportedPreset[\s\S]*applyDesktopPetModelSelection/u);
assert.match(
  companionRuntimeLayerSource,
  /isLive2DDragFeedbackActive[\s\S]*effectiveRenderAction = isLive2DDragFeedbackActive \? 'IDLE' : renderAction/u,
  'companion Live2D drag should temporarily suppress the stale walking action',
);
assert.match(
  companionRuntimeLayerSource,
  /motionTarget=\{effectiveRenderMotionTarget\}/u,
  'companion Live2D drag should not keep the auto-movement target as the look target',
);
assert.match(
  companionLayerSource,
  /const isMoving = motionTarget !== null[\s\S]*action: slot\.currentAction[\s\S]*isMoving/u,
  'the companion visual layer should derive movement state from an actual motion target, not a stale slot action',
);

console.log('live2d multi-slot visibility smoke passed');
