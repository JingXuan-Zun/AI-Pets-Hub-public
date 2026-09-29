import assert from 'node:assert/strict';
import { filterPetModelMotionBindingsForModelType } from '../src/pet-runtime/content/petModelMotionBindingCompatibility';
import { type PetModelMotionBinding } from '../src/types';
import { readProjectFile } from './smokeTestHarness.ts';

const mixedBindings: PetModelMotionBinding[] = [
  { format: 'motion3', id: 'live-motion', motionKey: 'happy', name: 'Live2D motion', sourceUrl: 'live.motion3.json' },
  { format: 'exp3', id: 'live-expression', kind: 'expression', motionKey: 'happy', name: 'Live2D expression', sourceUrl: 'live.exp3.json' },
  { format: 'vrma', id: 'vrma-motion', motionKey: 'walking', name: 'VRMA motion', sourceUrl: 'walk.vrma' },
  { format: 'fbx', id: 'fbx-motion', motionKey: 'running', name: 'FBX motion', sourceUrl: 'run.fbx' },
];

assert.deepEqual(
  filterPetModelMotionBindingsForModelType('live2d', mixedBindings).map((binding) => binding.id),
  ['live-motion', 'live-expression'],
  'Live2D quick actions should include only motion3/exp3 data',
);

assert.deepEqual(
  filterPetModelMotionBindingsForModelType('3d', mixedBindings).map((binding) => binding.id),
  ['vrma-motion', 'fbx-motion'],
  '3D quick actions should include only 3D motion data',
);

assert.deepEqual(
  filterPetModelMotionBindingsForModelType('2d', mixedBindings),
  [],
  '2D quick actions should not expose imported Live2D or 3D motion data',
);

const panelsLayerSource = readProjectFile('src/components/pet/PetPanelsLayer.tsx');
const quickActionMenuSource = readProjectFile('src/components/pet/PetQuickActionMenu.tsx');

assert.match(
  panelsLayerSource,
  /activePetCustomMotionBindings\s*=\s*filterPetModelMotionBindingsForModelType\(\s*activePetModelType,\s*resolvePetModelMotionBindingsForModel\(\s*activePetModelType,\s*activePetModelUrl,/,
  'panels layer should filter bindings using the active model type and URL',
);

assert.match(
  panelsLayerSource,
  /<PetQuickActionMenu[\s\S]*activePetModelType=\{activePetModelType\}[\s\S]*customMotionBindings=\{activePetCustomMotionBindings\}/,
  'panels layer should pass the active model type and filtered bindings to the quick action menu',
);

assert.match(
  quickActionMenuSource,
  /activePetModelType === '2d'[\s\S]*QUICK_SELECT_PET_ACTIONS\.map/,
  '2D should render its built-in action slots as the only action section',
);

assert.match(
  quickActionMenuSource,
  /activePetModelType !== '2d'[\s\S]*customMotionBindings\.map/,
  '3D and Live2D should render their current-model imported bindings as the only action section',
);

assert.doesNotMatch(
  quickActionMenuSource,
  /actionSelectorImportedActions/,
  '3D and Live2D should not render a second imported action-slot column',
);

console.log('pet quick action model filter smoke passed');
