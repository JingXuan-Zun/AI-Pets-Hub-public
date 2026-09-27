import assert from 'node:assert/strict';
import {
  createPointerLookTrackingTimingState,
  POINTER_LOOK_DEFAULT_FALLBACK_RECT_PADDING_PX,
  resolvePetPointerLookTargetFromClientPoint,
  resolvePointerLookTimedTarget,
} from '../src/pet-runtime/interactions/usePetPointerLookTarget';
import { resolvePetPointerLookHoverState } from '../src/pet-runtime/interactions/petPointerLookInputGate';
import { applyDesktopPetSlotChanges, getDesktopPetSlots } from '../src/multiPetRoster';
import { readProjectFile } from './smokeTestHarness.ts';

function padRect(rect: DOMRectInit, padding: number) {
  const left = rect.x ?? 0;
  const top = rect.y ?? 0;
  const width = rect.width ?? 0;
  const height = rect.height ?? 0;

  return {
    bottom: top + height + padding,
    height: height + padding * 2,
    left: left - padding,
    right: left + width + padding,
    top: top - padding,
    width: width + padding * 2,
  };
}

const visualRect = {
  height: 100,
  width: 100,
  x: 100,
  y: 100,
};
const nearOutsidePoint = { x: 82, y: 150 };
const defaultFallbackTarget = resolvePetPointerLookTargetFromClientPoint(
  nearOutsidePoint,
  padRect(visualRect, POINTER_LOOK_DEFAULT_FALLBACK_RECT_PADDING_PX),
);
const expanded3DFallbackTarget = resolvePetPointerLookTargetFromClientPoint(
  nearOutsidePoint,
  padRect(visualRect, 56),
);

assert.equal(defaultFallbackTarget, null, 'default pointer look range should stay narrow for non-3D renderers');
assert.ok(expanded3DFallbackTarget, '3D pointer look range should include nearby space around the model');
assert.ok(expanded3DFallbackTarget!.x < 0, 'expanded 3D range should preserve pointer direction');

const live2DActiveTarget = { x: -24, y: 32 };
let timingState = createPointerLookTrackingTimingState();
const live2DActiveResult = resolvePointerLookTimedTarget({
  activeTarget: live2DActiveTarget,
  holdMs: 5000,
  nowMs: 0,
  state: timingState,
  stillReturnMs: 10000,
});
timingState = live2DActiveResult.state;

const live2DHeldResult = resolvePointerLookTimedTarget({
  activeTarget: null,
  holdMs: 5000,
  nowMs: 4999,
  state: timingState,
  stillReturnMs: 10000,
});
assert.deepEqual(
  live2DHeldResult.target,
  live2DActiveTarget,
  'Live2D pointer look should keep the last target during the 5s leave hold instead of flickering back to center',
);
assert.equal(live2DHeldResult.phase, 'held');

const live2DReturnedAfterLeave = resolvePointerLookTimedTarget({
  activeTarget: null,
  holdMs: 5000,
  nowMs: 5000,
  state: timingState,
  stillReturnMs: 10000,
});
assert.deepEqual(live2DReturnedAfterLeave.target, { x: 0, y: 0 });
assert.equal(live2DReturnedAfterLeave.phase, 'center');

let stillTimingState = createPointerLookTrackingTimingState();
stillTimingState = resolvePointerLookTimedTarget({
  activeTarget: live2DActiveTarget,
  holdMs: 5000,
  nowMs: 0,
  state: stillTimingState,
  stillReturnMs: 10000,
}).state;
stillTimingState = resolvePointerLookTimedTarget({
  activeTarget: live2DActiveTarget,
  holdMs: 5000,
  nowMs: 3000,
  state: stillTimingState,
  stillReturnMs: 10000,
}).state;
const live2DStillReturned = resolvePointerLookTimedTarget({
  activeTarget: live2DActiveTarget,
  holdMs: 5000,
  nowMs: 10000,
  state: stillTimingState,
  stillReturnMs: 10000,
});
assert.deepEqual(
  live2DStillReturned.target,
  { x: 0, y: 0 },
  'Live2D pointer look should return to center after the cursor stays still for 10s',
);
assert.equal(live2DStillReturned.phase, 'still-return');

const desktopPetConfigForSlotTest = {
  autoMovementEnabled: true,
  companionPets: [
    {
      autoMovementEnabled: true,
      currentAction: 'IDLE',
      enabled: true,
      id: 'companion-pet-2',
      modelType: '2d',
      modelUrl: '',
      personality: {
        beginDialogs: [],
        chatAvatarUrl: '',
        chatHistoryMemory: '',
        customErrorMessage: '',
        greeting: '',
        knowledgeBase: '',
        name: 'companion',
        systemInstruction: '',
        traits: [],
        userMemory: '',
        webLearningEnabled: false,
        webSearchEnabled: false,
      },
      pointerLookEnabled: true,
      position: { x: 0, y: 0 },
      scale: 1,
      stats: { affection: 80, fatigue: 0, hunger: 0 },
    },
  ],
  currentAction: 'IDLE',
  modelType: '2d',
  modelUrl: '',
  personality: {
    beginDialogs: [],
    chatAvatarUrl: '',
    chatHistoryMemory: '',
    customErrorMessage: '',
    greeting: '',
    knowledgeBase: '',
    name: 'primary',
    systemInstruction: '',
    traits: [],
    userMemory: '',
    webLearningEnabled: false,
    webSearchEnabled: false,
  },
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  stats: { affection: 80, fatigue: 0, hunger: 0 },
} as any;

const primaryPointerLookDisabledConfig = applyDesktopPetSlotChanges(desktopPetConfigForSlotTest, 'primary', {
  pointerLookEnabled: false,
});
assert.equal(primaryPointerLookDisabledConfig.pointerLookEnabled, false);
const companionPointerLookDisabledConfig = applyDesktopPetSlotChanges(desktopPetConfigForSlotTest, 'companion-pet-2', {
  pointerLookEnabled: false,
});
assert.equal(companionPointerLookDisabledConfig.companionPets[0]?.pointerLookEnabled, false);
assert.equal(
  getDesktopPetSlots(companionPointerLookDisabledConfig)[1]?.pointerLookEnabled,
  false,
  'desktop pet slot projection should expose companion pointer look state',
);

const activeHoverState = {
  activeRegion: 'head',
  focusTarget: { x: 12, y: -18 },
  supportedRegions: ['head', 'body', 'handL', 'handR'],
} as const;
assert.equal(
  resolvePetPointerLookHoverState(activeHoverState, true).focusTarget,
  activeHoverState.focusTarget,
  'enabled pointer look should preserve hover focus target for model look-at',
);
const disabledPointerLookHoverState = resolvePetPointerLookHoverState(activeHoverState, false);
assert.equal(
  disabledPointerLookHoverState.activeRegion,
  'head',
  'disabled pointer look should keep hover region for interaction cues',
);
assert.equal(
  disabledPointerLookHoverState.focusTarget,
  null,
  'disabled pointer look should remove hover focus target so 3D/Live2D do not keep tracking the mouse',
);

const petAvatarLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const petCompanionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
const desktopPetSlotSelectorSource = readProjectFile('src/components/settings/DesktopPetSlotSelector.tsx');
const settingsPanelSource = readProjectFile('src/components/SettingsPanel.tsx');
const constantsSource = readProjectFile('src/constants.ts');
const petConfigNormalizationSource = readProjectFile('src/petConfigNormalization.ts');
assert.match(
  constantsSource,
  /currentAction:\s*'IDLE'[\s\S]*autoMovementEnabled:\s*true,\s*pointerLookEnabled:\s*true/,
  'default companion pets should keep pointer look enabled',
);
assert.match(
  constantsSource,
  /currentAction:\s*'WALKING'[\s\S]*autoMovementEnabled:\s*true,\s*pointerLookEnabled:\s*true/,
  'default primary pet should keep pointer look enabled',
);
assert.match(
  petConfigNormalizationSource,
  /pointerLookEnabled:\s*typeof nextPet\.pointerLookEnabled === 'boolean'[\s\S]*fallbackPet\.pointerLookEnabled/,
  'companion config normalization should preserve existing configs by falling back to the default pointer look value',
);
assert.match(
  petConfigNormalizationSource,
  /pointerLookEnabled:\s*typeof nextConfig\.pointerLookEnabled === 'boolean'[\s\S]*DEFAULT_CONFIG\.pointerLookEnabled/,
  'primary config normalization should preserve existing configs by falling back to the default pointer look value',
);
assert.match(
  petAvatarLayerSource,
  /const pointerLookInteractionsEnabled = hoverInteractionsEnabled && config\.pointerLookEnabled;[\s\S]*enabled:\s*pointerLookInteractionsEnabled/,
  'primary pointer look hook should be gated by the slot pointer look toggle',
);
assert.match(
  petAvatarLayerSource,
  /const rendererHoverState = useMemo\(\(\) => \(\s*resolvePetPointerLookHoverState\(hoverState,\s*config\.pointerLookEnabled\)[\s\S]*hoverState:\s*rendererHoverState/,
  'primary renderer hover focus should be gated by the pointer look toggle',
);
assert.match(
  petCompanionLayerSource,
  /const pointerLookInteractionsEnabled = hoverInteractionsEnabled && slot\.pointerLookEnabled;[\s\S]*enabled:\s*pointerLookInteractionsEnabled/,
  'companion pointer look hook should be gated by the slot pointer look toggle',
);
assert.match(
  petCompanionLayerSource,
  /const rendererHoverState = useMemo\(\(\) => \(\s*resolvePetPointerLookHoverState\(hoverState,\s*slot\.pointerLookEnabled\)[\s\S]*hoverState:\s*rendererHoverState/,
  'companion renderer hover focus should be gated by the pointer look toggle',
);
assert.match(
  petAvatarLayerSource,
  /trackingLostHoldMs:\s*config\.modelType === 'live2d' \? 5000 : undefined[\s\S]*trackingStillReturnMs:\s*config\.modelType === 'live2d' \? 10000 : undefined/,
  'primary Live2D pointer look should pass the 5s leave hold and 10s still-return timing into the shared tracker',
);
assert.match(
  petCompanionLayerSource,
  /trackingLostHoldMs:\s*slot\.modelType === 'live2d' \? 5000 : undefined[\s\S]*trackingStillReturnMs:\s*slot\.modelType === 'live2d' \? 10000 : undefined/,
  'companion Live2D pointer look should pass the 5s leave hold and 10s still-return timing into the shared tracker',
);
assert.match(
  desktopPetSlotSelectorSource,
  /onSetSlotPointerLookEnabled[\s\S]*slot\.pointerLookEnabled[\s\S]*\\u89c6\\u7ebf\\u8ffd\\u8e2a ON/,
  'desktop pet slot selector should expose the pointer look toggle inside each slot card',
);
assert.match(
  settingsPanelSource,
  /handleUpdatePetPointerLookEnabled[\s\S]*pointerLookEnabled:\s*enabled[\s\S]*onSetPetSlotPointerLookEnabled:\s*handleUpdatePetPointerLookEnabled/,
  'settings panel should write pointer look toggle changes through desktop pet slot updates',
);

console.log('pointer look fallback range smoke ok');
