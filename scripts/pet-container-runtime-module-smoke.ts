import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  petContainerSource,
  characterRuntimeBridgeSource,
  live2DDiscoverySource,
  nativeShapeSyncSource,
  postDragHoldSource,
} = readProjectSources({
  petContainerSource: 'src/components/PetContainer.tsx',
  characterRuntimeBridgeSource: 'src/components/pet/usePetContainerCharacterRuntimeBridge.ts',
  live2DDiscoverySource: 'src/components/pet/usePetContainerLive2DExpressionDiscovery.ts',
  nativeShapeSyncSource: 'src/components/pet/usePetContainerNativeShapeSyncState.ts',
  postDragHoldSource: 'src/components/pet/usePetContainerPostDragNativeShapeHold.ts',
});

assert.match(
  petContainerSource,
  /usePetContainerCharacterRuntimeBridge\(\{[\s\S]*customModelPresets:\s*config\.customModelPresets[\s\S]*modelType:\s*config\.modelType/u,
  'PetContainer should call the extracted character runtime bridge module.',
);
assert.match(
  petContainerSource,
  /usePetContainerNativeShapeSyncState\(\{/u,
  'PetContainer should call the extracted native shape sync state module.',
);
assert.doesNotMatch(
  petContainerSource,
  /function createLive2DDiscoveryScanSignature/u,
  'Live2D discovery signature construction should stay out of PetContainer.',
);
assert.doesNotMatch(
  petContainerSource,
  /function usePostDragNativeShapeHold/u,
  'Post-drag native shape hold implementation should stay out of PetContainer.',
);
assert.doesNotMatch(
  petContainerSource,
  /discoverLive2DExpressionBindingsForModel/u,
  'PetContainer should not own Live2D expression discovery details.',
);
assert.doesNotMatch(
  petContainerSource,
  /useUnityAvatarRuntimeEvents|usePetContainerAvatarRuntimeEventHandler|markMainWindowReadyToShow/u,
  'PetContainer should not own avatar runtime event wiring details.',
);

assert.match(
  characterRuntimeBridgeSource,
  /usePetContainerLive2DExpressionDiscovery\(\{[\s\S]*customModelPresets/u,
  'Character runtime bridge should own Live2D expression discovery wiring.',
);
assert.match(
  characterRuntimeBridgeSource,
  /usePetContainerAvatarRuntimeEventHandler\(\{[\s\S]*onCompanionVisualBoundsChange[\s\S]*onPrimaryVisualBoundsChange/u,
  'Character runtime bridge should own avatar runtime event routing wiring.',
);
assert.match(
  characterRuntimeBridgeSource,
  /useUnityAvatarRuntimeEvents\(handleAvatarRuntimeEvent\)/u,
  'Character runtime bridge should subscribe Unity events to the shared avatar runtime event handler.',
);
assert.match(
  characterRuntimeBridgeSource,
  /markMainWindowReadyToShow/u,
  'Character runtime bridge should preserve main-window ready-to-show coordination.',
);

assert.match(
  nativeShapeSyncSource,
  /usePetContainerPostDragNativeShapeHold\(isAnyPetDragActive\)/u,
  'Native shape sync state should call the extracted post-drag native shape hold module.',
);
assert.match(
  nativeShapeSyncSource,
  /POST_DRAG_NATIVE_SHAPE_HOLD_STATE/u,
  'Native shape sync state should use the extracted post-drag hold state marker.',
);

assert.match(
  live2DDiscoverySource,
  /discoverLive2DExpressionBindingsForModel/u,
  'Live2D discovery module should own the expression binding scan.',
);
assert.match(
  live2DDiscoverySource,
  /scanSignaturesRef\s*=\s*useRef<Set<string>>\(new Set\(\)\)/u,
  'Live2D discovery module should preserve signature de-duplication.',
);
assert.match(
  live2DDiscoverySource,
  /onUpdateConfig\(\{[\s\S]*customModelPresets:[\s\S]*motionBindings/u,
  'Live2D discovery module should write discovered motion bindings back through config updates.',
);

assert.match(
  postDragHoldSource,
  /POST_DRAG_NATIVE_SHAPE_HOLD_MS\s*=\s*360/u,
  'Post-drag hold module should preserve the existing hold duration.',
);
assert.match(
  postDragHoldSource,
  /kind:\s*'post-pet-drag-native-shape-hold'/u,
  'Post-drag hold module should preserve the existing drag hold state marker.',
);

console.log('pet container runtime module smoke ok');
