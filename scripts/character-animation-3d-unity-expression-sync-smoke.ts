import assert from 'node:assert/strict';
import {
  resolveAvatarRuntimeManualExpressionSelection,
  resolvePetModelExpressionBindingCandidateNames,
} from '../src/pet-runtime/content/petModelExpressionBindings';
import { resolveAvatar3DExpressionControllerState } from '../src/pet-runtime/avatar3d/avatar3dExpressionController';
import { resolveAvatar3DMotionOverrideState } from '../src/pet-runtime/avatar3d/avatar3dMotionOverrideController';
import { type PetModelMotionBinding } from '../src/types';
import { readProjectFile } from './smokeTestHarness.ts';

const expressionBinding: PetModelMotionBinding = {
  clipNames: ['Smile_Bright', 'JoyFace'],
  format: 'exp3',
  id: 'smile-expression-binding',
  kind: 'expression',
  motionKey: 'happy',
  name: 'Smile Bright',
  semanticAliases: ['big smile'],
  semanticTags: ['face'],
  sourceUrl: '/models/expressions/smile_bright.exp3.json?cache=1',
};

const motionBinding: PetModelMotionBinding = {
  clipNames: ['DanceLoop'],
  format: 'vrma',
  id: 'dance-motion-binding',
  kind: 'motion',
  motionKey: 'happy',
  name: 'Dance Loop',
  sourceUrl: '/models/motions/dance.vrma',
};

assert.deepEqual(
  resolvePetModelExpressionBindingCandidateNames(expressionBinding),
  [
    'Smile Bright',
    'smile-expression-binding',
    'Smile_Bright',
    'JoyFace',
    'big smile',
    'smile_bright',
    'face',
    'happy',
  ],
  '3D expression binding candidates should preserve imported names before generic motion keys',
);

const manualSelection = resolveAvatarRuntimeManualExpressionSelection(expressionBinding);
assert.deepEqual(
  manualSelection,
  {
    candidateExpressionNames: [
      'Smile Bright',
      'smile-expression-binding',
      'Smile_Bright',
      'JoyFace',
      'big smile',
      'smile_bright',
      'face',
      'happy',
    ],
    expressionKey: 'happy',
    weightMultiplier: 1,
  },
  'manual expression selection should map imported expression bindings to a runtime expression key',
);

assert.equal(resolveAvatarRuntimeManualExpressionSelection(motionBinding), null);

const expressionState = resolveAvatar3DExpressionControllerState({
  latestMessage: 'normal chat',
  manualExpressionSelection: manualSelection,
  messageExpressionAction: 'SAD',
});
assert.equal(expressionState.source, 'manual');
assert.equal(expressionState.activeAction, null);
assert.equal(expressionState.shouldOverridePresentation, false);
assert.deepEqual(
  expressionState.activeCue?.candidateExpressionNames?.slice(0, 2),
  ['Smile Bright', 'smile-expression-binding'],
  'manual 3D expression cue should prefer imported expression candidates',
);

const motionOverride = resolveAvatar3DMotionOverrideState({
  action: 'RUNNING',
  expressionState,
  isMoving: true,
});
assert.equal(motionOverride.mode, 'preserve');
assert.equal(motionOverride.resolvedMotionKey, 'running');
assert.equal(motionOverride.source, 'state-machine');

const petVisualRendererSource = readProjectFile('src/components/pet/PetVisualRenderer.tsx');
const pet3DRendererSource = readProjectFile('src/components/pet/Pet3DRenderer.tsx');
const petUnityRendererSource = readProjectFile('src/components/pet/PetUnity3DRenderer.tsx');
const petThreeBridgeInputSource = readProjectFile('src/components/pet/petThreeAvatarBridgeInputSurface.ts');
const unityBridgeSource = readProjectFile('src/pet-runtime/avatar-runtime/unity/unityAvatarRuntimeBridge.ts');

assert.match(
  petVisualRendererSource,
  /<Pet3DRenderer[\s\S]*manualExpressionBinding=\{manualExpressionBinding\}/u,
  'visual renderer should pass manualExpressionBinding into the Three renderer',
);
assert.match(
  petVisualRendererSource,
  /<PetUnity3DRenderer[\s\S]*manualExpressionBinding=\{manualExpressionBinding\}/u,
  'visual renderer should pass manualExpressionBinding into the Unity renderer',
);
assert.match(
  pet3DRendererSource,
  /manualExpressionSelection[\s\S]*useThreeAvatarRuntimeBridgeState/u,
  'Three renderer should feed manual expression selection into its bridge state',
);
assert.match(
  petThreeBridgeInputSource,
  /manualExpressionBinding[\s\S]*resolveAvatarRuntimeManualExpressionSelection[\s\S]*manualExpressionSelection/u,
  'Three bridge input should derive manual expression selection without collapsing motion selection',
);
assert.match(
  petUnityRendererSource,
  /resolveAvatarRuntimeManualExpressionSelection[\s\S]*manualExpressionSelection[\s\S]*useUnityAvatarRuntimeMirror/u,
  'Unity renderer should resolve and forward manual expression selection',
);
assert.match(
  unityBridgeSource,
  /resolveUnityManualExpressionKey\(manualExpressionSelection\)[\s\S]*resolveUnityExpressionKey/u,
  'Unity bridge should prefer manual expression keys before reaction fallback expressions',
);
