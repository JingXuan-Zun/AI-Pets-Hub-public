import {
  advanceLive2DPointerLookTrackerState,
  createLive2DPointerLookTrackerState,
  didLive2DPointerLookScaleChange,
  resolveLive2DDragSettledFocusTarget,
  resolveLive2DDragSettledPointerLookTarget,
  resolveLive2DLookPosition,
  resolveLive2DPointerLookPosition,
  resolveLive2DPointerLookTimedPosition,
  resolveLive2DScaleStablePointerLookTarget,
} from '../src/components/pet/live2dPointerLookTarget';
import { readProjectFile } from './smokeTestHarness.ts';
import { LIVE2D_DRAG_LOOK_SETTLE_MS } from '../src/components/pet/useLive2DDragLookSettle';

if (LIVE2D_DRAG_LOOK_SETTLE_MS !== 900) {
  throw new Error(`Expected Live2D drag direction to remain ahead of nearby pointer input for 900ms, got ${LIVE2D_DRAG_LOOK_SETTLE_MS}`);
}

const activeTarget = resolveLive2DPointerLookPosition({ x: 28, y: -42 });
if (activeTarget.source !== 'pointer' || activeTarget.x <= 0 || activeTarget.y <= 0) {
  throw new Error(`Expected active pointer look target, got ${JSON.stringify(activeTarget)}`);
}

const faceAreaTarget = resolveLive2DPointerLookPosition({ x: 0, y: -28 });
if (faceAreaTarget.source !== 'pointer' || faceAreaTarget.y <= 0) {
  throw new Error(`Expected face-area pointer target above the head horizon to look slightly upward, got ${JSON.stringify(faceAreaTarget)}`);
}

const lowerFaceTarget = resolveLive2DPointerLookPosition({ x: 0, y: -12 });
if (lowerFaceTarget.source !== 'pointer' || lowerFaceTarget.y > -0.8 || lowerFaceTarget.y < -0.9) {
  throw new Error(`Expected lower face pointer target to strengthen downward Live2D look, got ${JSON.stringify(lowerFaceTarget)}`);
}

if (activeTarget.y < 0.7 || activeTarget.y > 0.8) {
  throw new Error(`Expected top-edge pointer target to restore the natural upward range from the head horizon, got ${JSON.stringify(activeTarget)}`);
}

const centerInput = resolveLive2DPointerLookPosition(null);
if (centerInput.source !== 'center' || centerInput.x !== 0 || centerInput.y !== 0) {
  throw new Error(`Expected null input to resolve center, got ${JSON.stringify(centerInput)}`);
}

const focusFallbackTarget = resolveLive2DLookPosition({
  focusTarget: { x: -16, y: 24 },
  pointerLookTarget: null,
});
if (focusFallbackTarget.source !== 'focus' || focusFallbackTarget.x >= 0 || focusFallbackTarget.y >= 0) {
  throw new Error(`Expected focus target to drive Live2D look when pointer look is absent, got ${JSON.stringify(focusFallbackTarget)}`);
}

const upwardFocusFallbackTarget = resolveLive2DLookPosition({
  focusTarget: { x: 16, y: -24 },
  pointerLookTarget: null,
});
if (
  upwardFocusFallbackTarget.source !== 'focus'
  || upwardFocusFallbackTarget.x <= 0
  || upwardFocusFallbackTarget.y <= 0
) {
  throw new Error(`Expected non-pointer focus target to preserve valid upward/right-up Live2D direction, got ${JSON.stringify(upwardFocusFallbackTarget)}`);
}

if (upwardFocusFallbackTarget.x > 0.64 || upwardFocusFallbackTarget.y > 0.52) {
  throw new Error(`Expected focus fallback to preserve the original drag-direction range, got ${JSON.stringify(upwardFocusFallbackTarget)}`);
}

const pointerFromSameRawFocusTarget = resolveLive2DLookPosition({
  focusTarget: null,
  pointerLookTarget: { x: -16, y: 24 },
});
if (pointerFromSameRawFocusTarget.source !== 'pointer') {
  throw new Error(`Expected same raw target to resolve as pointer when provided through pointer input, got ${JSON.stringify(pointerFromSameRawFocusTarget)}`);
}

if (Math.abs(focusFallbackTarget.x) >= Math.abs(pointerFromSameRawFocusTarget.x)) {
  throw new Error(`Expected focus fallback to stay softer than pointer horizontally, got focus=${JSON.stringify(focusFallbackTarget)} pointer=${JSON.stringify(pointerFromSameRawFocusTarget)}`);
}

if (Math.abs(focusFallbackTarget.y) >= Math.abs(pointerFromSameRawFocusTarget.y)) {
  throw new Error(`Expected focus fallback to stay softer than pointer vertically, got focus=${JSON.stringify(focusFallbackTarget)} pointer=${JSON.stringify(pointerFromSameRawFocusTarget)}`);
}

const pointerPriorityTarget = resolveLive2DLookPosition({
  focusTarget: { x: -16, y: 24 },
  pointerLookTarget: { x: 28, y: -42 },
});
if (pointerPriorityTarget.source !== 'pointer' || pointerPriorityTarget.x <= 0 || pointerPriorityTarget.y <= 0) {
  throw new Error(`Expected pointer target to keep priority over focus target, got ${JSON.stringify(pointerPriorityTarget)}`);
}

let leaveState = createLive2DPointerLookTrackerState();
leaveState = advanceLive2DPointerLookTrackerState(leaveState, activeTarget, 0);
leaveState = advanceLive2DPointerLookTrackerState(leaveState, centerInput, 100);

const heldAfterLeave = resolveLive2DPointerLookTimedPosition(leaveState, 5099);
if (heldAfterLeave.source !== 'pointer') {
  throw new Error(`Expected leave hold to keep pointer target for 5s, got ${JSON.stringify(heldAfterLeave)}`);
}

const returnedAfterLeave = resolveLive2DPointerLookTimedPosition(leaveState, 5100);
if (returnedAfterLeave.source !== 'center') {
  throw new Error(`Expected leave hold to return center after 5s, got ${JSON.stringify(returnedAfterLeave)}`);
}

let focusAfterPointerState = createLive2DPointerLookTrackerState();
focusAfterPointerState = advanceLive2DPointerLookTrackerState(focusAfterPointerState, activeTarget, 0);
focusAfterPointerState = advanceLive2DPointerLookTrackerState(focusAfterPointerState, focusFallbackTarget, 100);

const heldPointerBeforeFocus = resolveLive2DPointerLookTimedPosition(focusAfterPointerState, 5099);
if (heldPointerBeforeFocus.source !== 'pointer') {
  throw new Error(`Expected recent pointer target to stay held before focus fallback takes over, got ${JSON.stringify(heldPointerBeforeFocus)}`);
}

const focusAfterHold = resolveLive2DPointerLookTimedPosition(focusAfterPointerState, 5100);
if (focusAfterHold.source !== 'focus') {
  throw new Error(`Expected focus target to take over after pointer leave hold expires, got ${JSON.stringify(focusAfterHold)}`);
}

let stillState = createLive2DPointerLookTrackerState();
stillState = advanceLive2DPointerLookTrackerState(stillState, activeTarget, 0);
stillState = advanceLive2DPointerLookTrackerState(stillState, activeTarget, 3000);

const heldWhileStill = resolveLive2DPointerLookTimedPosition(stillState, 9999);
if (heldWhileStill.source !== 'pointer') {
  throw new Error(`Expected still pointer target to hold before 10s, got ${JSON.stringify(heldWhileStill)}`);
}

const returnedWhileStill = resolveLive2DPointerLookTimedPosition(stillState, 10000);
if (returnedWhileStill.source !== 'center') {
  throw new Error(`Expected still pointer target to return center after 10s, got ${JSON.stringify(returnedWhileStill)}`);
}

if (!didLive2DPointerLookScaleChange(1, 1.1)) {
  throw new Error('Expected a rendered Live2D scale change to start pointer-look stabilization');
}

if (didLive2DPointerLookScaleChange(1.1, 1.1)) {
  throw new Error('Expected an unchanged Live2D scale to keep pointer-look stabilization idle');
}

const pointerBeforeScale = { x: 12, y: -18 };
const geometryOnlyTargetsDuringScale = [
  { x: -9, y: -18 },
  { x: 8, y: -18 },
  { x: -7, y: -18 },
];
for (const geometryOnlyTarget of geometryOnlyTargetsDuringScale) {
  const stabilizedTarget = resolveLive2DScaleStablePointerLookTarget({
    currentTarget: geometryOnlyTarget,
    frozenTarget: pointerBeforeScale,
    shouldStabilize: true,
  });
  if (stabilizedTarget?.x !== pointerBeforeScale.x || stabilizedTarget.y !== pointerBeforeScale.y) {
    throw new Error(`Expected scale-time geometry changes to preserve the pre-scale target, got ${JSON.stringify(stabilizedTarget)}`);
  }
}

const pointerAfterScale = geometryOnlyTargetsDuringScale.at(-1)!;
if (resolveLive2DScaleStablePointerLookTarget({
  currentTarget: pointerAfterScale,
  frozenTarget: pointerBeforeScale,
  shouldStabilize: false,
}) !== pointerAfterScale) {
  throw new Error('Expected pointer look to resume the latest target after scale stabilization');
}

const dragReleaseFocusTarget = { x: 16, y: -8 };
const pointerTargetAtDragRelease = { x: -24, y: 12 };
const heldDragReleaseFocusTarget = resolveLive2DDragSettledFocusTarget({
  focusTarget: null,
  lastDragFocusTarget: dragReleaseFocusTarget,
  shouldSettle: true,
});
if (heldDragReleaseFocusTarget !== dragReleaseFocusTarget) {
  throw new Error('Expected release settling to retain the final drag direction when the layer clears focus');
}

if (resolveLive2DDragSettledFocusTarget({
  focusTarget: null,
  lastDragFocusTarget: dragReleaseFocusTarget,
  shouldSettle: false,
}) !== null) {
  throw new Error('Expected the retained drag direction to expire after release settling');
}

const pointerTargetWhileDragDirectionSettles = resolveLive2DDragSettledPointerLookTarget({
  pointerLookTarget: pointerTargetAtDragRelease,
  shouldSettle: true,
});
if (pointerTargetWhileDragDirectionSettles !== null) {
  throw new Error('Expected drag release settling to suppress the newly resumed pointer target');
}

const dragDirectionLook = resolveLive2DLookPosition({
  focusTarget: heldDragReleaseFocusTarget,
  pointerLookTarget: pointerTargetWhileDragDirectionSettles,
});
if (dragDirectionLook.source !== 'focus') {
  throw new Error(`Expected drag direction to remain the only Live2D look input during release settle, got ${JSON.stringify(dragDirectionLook)}`);
}

if (resolveLive2DDragSettledPointerLookTarget({
  pointerLookTarget: pointerTargetAtDragRelease,
  shouldSettle: false,
}) !== pointerTargetAtDragRelease) {
  throw new Error('Expected pointer look to resume after drag release settling finishes');
}

const live2DRendererSource = readProjectFile('src/components/pet/PetLive2DRenderer.tsx');
const dragLookSettleSource = readProjectFile('src/components/pet/useLive2DDragLookSettle.ts');

if (!/if \(isDragging && !wasDraggingRef\.current\) \{\s*lastDragFocusTargetRef\.current = null;/u.test(dragLookSettleSource)) {
  throw new Error('Expected a new drag to clear any retained direction from the previous gesture');
}

if (!/lastDragFocusTargetRef\.current = focusTarget \?\? lastDragFocusTargetRef\.current/u.test(dragLookSettleSource)) {
  throw new Error('Expected the drag settle hook to retain the latest valid active-drag direction');
}

if (!/const pointerLookRuntimeController = pointerLookRuntimeControllerRef\.current[\s\S]*pointerLookRuntimeController\?\.updateInputTarget\(lookPosition\)[\s\S]*if \(model && !pointerLookRuntimeController\) \{[\s\S]*model\.focus\(lookPosition\.x, lookPosition\.y\)/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D built-in focus to be skipped while the timed pointer parameter controller is active');
}

if (!/resolveLive2DLookPosition\(\{\s*focusTarget:\s*dragSettledFocusTarget,\s*pointerLookTarget:\s*dragSettledPointerLookTarget,\s*\}\)/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D renderer to resolve look position from drag-settled pointer look and focus fallback');
}

if (!/useLive2DDragLookSettle\(isDragging,\s*focusTarget\)/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D renderer to retain the final drag focus during release settling');
}

if (!/useLive2DScaleStablePointerLookTarget\(scale,\s*pointerLookTarget\)/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D renderer to freeze pointer look while scale geometry settles');
}

if (!/resolveLive2DDragSettledPointerLookTarget\(\{\s*pointerLookTarget:\s*scaleStablePointerLookTarget,\s*shouldSettle:\s*shouldSettleLive2DLook,\s*\}\)/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D renderer to suppress pointer look while a drag-release direction settles');
}

if (!/shouldUseLive2DDragSettleCenter\(\s*shouldSettleLive2DLook,\s*dragSettledFocusTarget,?\s*\)/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D drag settle center to be bypassed when a drag-release focus target exists');
}

if (!/shouldUseDragSettleCenter\s*\?\s*LIVE2D_DRAG_SETTLE_LOOK_POSITION\s*:\s*resolveLive2DLookPosition/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D drag settle to feed a stable center target only when no focus target is available');
}

if (!/effectivePointerLookStrength\s*=\s*shouldUseDragSettleCenter \? 0 : pointerLookStrength/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D drag settle center to suppress internal pointer-look parameter strength');
}

if (!/target:\s*dragSettledPointerLookTarget/u.test(live2DRendererSource)) {
  throw new Error('Expected Live2D outer pointer-look visual transform to use the drag-settled input');
}

console.log('live2d pointer look return smoke passed');
