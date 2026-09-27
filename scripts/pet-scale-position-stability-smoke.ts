import assert from 'node:assert/strict';
import { resolveActivityAreaSize } from '../src/activityArea';
import {
  clampActivityRegionOffsetWithinArea,
  clampPositionToActivityAreaBoundary,
} from '../src/components/pet/petActivityRegionMath';
import {
  MAX_3D_PET_SCALE,
  MAX_LIVE2D_PET_SCALE,
  resolvePetScaleCap,
  resolveScaledPetPositionWithBounds,
} from '../src/components/pet/petContainerMath';
import {
  resolveUnity3DActivityClampVisualBounds,
  resolve3DStableLayoutVisualBounds,
  resolveUnity3DInteractiveVisualBounds,
  resolveUnity3DViewportShellSize,
} from '../src/components/pet/petVisualBounds';
import {
  constrainUnityMeasuredVisualBoundsForInteraction,
  isUnityMeasuredVisualBoundsTooSmallForScale,
} from '../src/components/pet/petUnityVisualBoundsFiltering';
import { readProjectFile } from './smokeTestHarness.ts';

const area = {
  height: 500,
  width: 500,
};
const currentBounds = {
  bottom: 80,
  left: 100,
  right: 100,
  top: 120,
};
const unityInteractiveBounds = resolveUnity3DInteractiveVisualBounds(1, false);
const unityActivityClampBounds = resolveUnity3DActivityClampVisualBounds(1, false);

assert.deepEqual(
  resolveActivityAreaSize(2560, 1080, {
    activityAreaLimitEnabled: true,
    activityAreaManual: true,
    activityAreaScale: 100,
    activityAreaWidth: 5120,
    activityAreaHeight: 1440,
  } as any),
  { width: 5120, height: 1440 },
  'manual activity regions should preserve cross-screen dimensions instead of being clamped to one selected display',
);

assert.deepEqual(
  clampActivityRegionOffsetWithinArea(
    { x: 1940, y: -5 },
    { width: 3431, height: 1461 },
    { x: 826.5, y: 465 },
    { width: 3875, height: 931 },
  ),
  { x: 1333, y: -5 },
  'manual cross-screen activity regions should clamp to the virtual desktop bounds instead of forcing their center back into one selected display',
);

const leftEdgeResizeArea = { width: 900, height: 500 };
const leftEdgeResizeOffset = clampActivityRegionOffsetWithinArea(
  {
    x: 100 + (1000 - leftEdgeResizeArea.width) / 2,
    y: 0,
  },
  leftEdgeResizeArea,
  { x: 500, y: 300 },
  { width: 2000, height: 1000 },
);
assert.deepEqual(
  {
    left: 500 + leftEdgeResizeOffset.x - leftEdgeResizeArea.width / 2,
    right: 500 + leftEdgeResizeOffset.x + leftEdgeResizeArea.width / 2,
  },
  {
    left: 200,
    right: 1100,
  },
  'left-edge activity-region resize should preserve the opposite edge instead of resizing symmetrically around the center',
);

assert.deepEqual(
  resolveScaledPetPositionWithBounds(
    { x: 140, y: 60 },
    1,
    2,
    currentBounds,
    (position, petScale, visualBounds) => (
      clampPositionToActivityAreaBoundary(position, area, petScale, visualBounds)
    ),
  ),
  { x: 50, y: 60 },
  'scaling up near the activity edge should synchronously clamp position with the scaled visual bounds',
);

assert.deepEqual(
  resolveScaledPetPositionWithBounds(
    { x: -130, y: -90 },
    2,
    1,
    {
      bottom: 160,
      left: 200,
      right: 200,
      top: 240,
    },
    (position, petScale, visualBounds) => (
      clampPositionToActivityAreaBoundary(position, area, petScale, visualBounds)
    ),
  ),
  { x: -130, y: -90 },
  'scaling down should preserve an already visible position instead of forcing a recovery jump',
);

assert.ok(
  clampPositionToActivityAreaBoundary(
    { x: 0, y: -999 },
    area,
    1,
    unityActivityClampBounds,
  ).y > clampPositionToActivityAreaBoundary(
    { x: 0, y: -999 },
    area,
    1,
    unityInteractiveBounds,
  ).y,
  'Unity activity clamp bounds should stop upward movement earlier than the tight interaction bounds',
);

assert.equal(
  isUnityMeasuredVisualBoundsTooSmallForScale(
    { bottom: 100, left: 126, right: 126, top: 145 },
    3.92,
  ),
  true,
  'Unity measured bounds that remain near scale-1 size at high scale should not drive layout recovery',
);

assert.equal(
  isUnityMeasuredVisualBoundsTooSmallForScale(
    { bottom: 100, left: 126, right: 126, top: 145 },
    1,
  ),
  false,
  'Unity measured bounds should still be accepted at scale 1',
);

assert.equal(
  isUnityMeasuredVisualBoundsTooSmallForScale(
    { bottom: 300, left: 380, right: 380, top: 450 },
    3.92,
  ),
  false,
  'screen-space Unity measured bounds should remain eligible at high scale',
);

assert.equal(
  isUnityMeasuredVisualBoundsTooSmallForScale(
    { bottom: 100, left: 143, right: 160, top: 279 },
    3.57,
  ),
  false,
  'Unity screen-space measured bounds that grow beyond the scale-1 legacy minimum should be accepted',
);

assert.deepEqual(
  constrainUnityMeasuredVisualBoundsForInteraction(
    { bottom: 360, left: 420, right: 420, top: 470 },
    3,
  ),
  { bottom: 289, left: 139, right: 139, top: 377 },
  'oversized Unity measured bounds should be tightened before driving hit testing',
);

assert.equal(
  resolveUnity3DInteractiveVisualBounds(3, false).left + resolveUnity3DInteractiveVisualBounds(3, false).right,
  248,
  'Unity interactive fallback bounds should stay horizontally close to the visible avatar',
);

assert.equal(
  resolveUnity3DViewportShellSize(3, false),
  684,
  'Unity viewport shell should grow with visual scale instead of staying at 256px',
);

const offCenterThreeLayoutBounds = resolve3DStableLayoutVisualBounds({
  bottom: 620,
  left: 260,
  right: 280,
  top: 300,
}, 3, false);

assert.ok(
  offCenterThreeLayoutBounds.bottom > offCenterThreeLayoutBounds.top,
  'Three layout bounds should preserve measured vertical center instead of clipping the lower body side',
);

assert.ok(
  offCenterThreeLayoutBounds.left + offCenterThreeLayoutBounds.right <= 2 * resolveUnity3DViewportShellSize(3, false),
  'Three layout bounds should stay bounded instead of expanding to an unbounded full-canvas hit area',
);

const fullCanvasThreeLayoutBounds = resolve3DStableLayoutVisualBounds({
  bottom: 660,
  left: 640,
  right: 640,
  top: 660,
}, 6, false);

assert.ok(
  fullCanvasThreeLayoutBounds.left + fullCanvasThreeLayoutBounds.right <= 500,
  'Three layout bounds should reject full-canvas alpha measurements so the desktop debug hit box does not consume the activity space',
);

assert.ok(
  fullCanvasThreeLayoutBounds.top + fullCanvasThreeLayoutBounds.bottom > 900,
  'Three layout bounds should keep tall full-body coverage while tightening only the excessive horizontal hit area',
);

assert.equal(
  MAX_3D_PET_SCALE,
  6,
  '3D pets should allow a larger manual scale ceiling',
);

assert.equal(MAX_LIVE2D_PET_SCALE, 4, 'Live2D should stop at the confirmed 4x scale ceiling');
assert.equal(resolvePetScaleCap('2d'), 3, 'the 2D scale ceiling must remain unchanged');
assert.equal(resolvePetScaleCap('live2d'), 4, 'Live2D wheel scaling should reach the confirmed ceiling');
assert.equal(resolvePetScaleCap('3d'), 6, 'the 3D scale ceiling must remain unchanged');

const primaryScaleControllerSource = readProjectFile('src/pet-runtime/interactions/petScaleController.ts');
const petConfigNormalizationSource = readProjectFile('src/petConfigNormalization.ts');
const scaleManagementSource = readProjectFile('src/components/pet/usePetContainerScaleManagement.ts');
const petContainerSource = readProjectFile('src/components/PetContainer.tsx');
const unityVisualBoundsFilteringSource = readProjectFile('src/components/pet/petUnityVisualBoundsFiltering.ts');
const unityRendererEventRoutingSource = readProjectFile('src/components/pet/petUnityRuntimeEventRouting.ts');
const petAvatarLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const petUnity3DRendererSource = readProjectFile('src/components/pet/PetUnity3DRenderer.tsx');
const petCompanionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
const avatarRuntimeEventHandlerSource = readProjectFile('src/components/pet/usePetContainerAvatarRuntimeEventHandler.ts');
const avatar3DSceneSource = readProjectFile('src/pet-runtime/avatar3d/Avatar3DScene.tsx');
const avatar3DRuntimeMountSource = readProjectFile('src/pet-runtime/avatar3d/Avatar3DRuntimeMount.tsx');
const indexCssSource = readProjectFile('src/index.css');
const visibilityRecoverySource = readProjectFile('src/components/pet/usePetContainer3DVisibilityRecovery.ts');

assert.match(
  petConfigNormalizationSource,
  /MAX_NORMALIZED_LIVE2D_PET_SCALE = 4[\s\S]*modelType === 'live2d'[\s\S]*MAX_NORMALIZED_LIVE2D_PET_SCALE/u,
  'persisted Live2D scale should retain the confirmed 4x ceiling',
);

assert.match(
  primaryScaleControllerSource,
  /resolveScaledPetPosition\(currentPosition,\s*currentConfig\.scale,\s*nextScale\)/u,
  'primary wheel scaling should resolve the next pet position before committing scale',
);

assert.match(
  primaryScaleControllerSource,
  /petPosRef\.current\s*=\s*nextPosition/u,
  'primary wheel scaling should keep the rendered position ref in sync with the committed config',
);
assert.match(
  primaryScaleControllerSource,
  /TEMP 3d wheel scale position probe[\s\S]*clampedPosition[\s\S]*committedPosition[\s\S]*currentPosition/u,
  'the temporary 3D scale probe should distinguish coordinate clamping from renderer-only drift',
);

assert.match(
  scaleManagementSource,
  /resolveScaledPrimaryPetPosition/u,
  'primary scale management should expose a shared scaled-position resolver',
);

assert.match(
  scaleManagementSource,
  /resolveScaledPetPositionWithBounds/u,
  'primary scale management should use the same scaled bounds helper as the smoke test',
);

assert.match(
  petContainerSource,
  /resolveScaledPetPosition:\s*resolveScaledPrimaryPetPosition/u,
  'PetContainer should wire primary wheel scaling to the scaled-position resolver',
);

assert.match(
  unityVisualBoundsFilteringSource,
  /constrainUnityMeasuredVisualBoundsForInteraction/u,
  'Unity measured visual bounds should be constrained before interaction hit testing',
);

assert.match(
  unityRendererEventRoutingSource,
  /shouldIgnoreUnityMeasuredVisualBoundsEvent/u,
  'Unity renderer-local hit areas should ignore measured bounds while the presentation box is fixed',
);

assert.match(
  unityVisualBoundsFilteringSource,
  /STABLE_UNITY_PRESENTATION_MEASURED_BOUNDS_ENABLED = false/u,
  'Unity measured bounds should stay disabled as a desktop layout source during the fixed presentation pass',
);

assert.match(
  petUnity3DRendererSource,
  /resolveUnity3DActivityClampVisualBounds/u,
  'Unity runtime fallback should publish the full-pose activity clamp bounds to global movement logic',
);

assert.match(
  petAvatarLayerSource,
  /usePetVisualBoundsMeasurement/u,
  'primary avatar layer should still accept fallback visual bounds for the fixed presentation box',
);
assert.match(
  petAvatarLayerSource,
  /TEMP 3d scale geometry probe[\s\S]*canvasRect[\s\S]*shellRect[\s\S]*shellTransition[\s\S]*viewportRect/u,
  'the temporary 3D scale probe should compare committed and settled renderer geometry',
);

assert.match(
  avatar3DSceneSource,
  /gl\.domElement\.dataset\.desktopPetThreeCanvas = 'true'/u,
  'Three canvases should expose a stable selector for synchronous viewport sizing',
);
assert.match(
  indexCssSource,
  /canvas\[data-desktop-pet-three-canvas="true"\][\s\S]*height: 100% !important;[\s\S]*width: 100% !important;/u,
  'Three canvas CSS dimensions should follow the viewport immediately while its backing buffer catches up',
);

assert.match(
  avatarRuntimeEventHandlerSource,
  /shouldRouteAvatarRuntimeVisualBoundsEvent/u,
  'global avatar visual bounds routing should ignore Unity measured bounds before recovery effects see them',
);

assert.match(
  avatar3DRuntimeMountSource,
  /REALTIME_VISUAL_BOUNDS_SAMPLE_INTERVAL_MS = 320/u,
  'Three runtime should update visual bounds during active motion without reading canvas every frame',
);

assert.match(
  avatar3DRuntimeMountSource,
  /hasMeaningfulVisualBoundsChange\(/u,
  'Three runtime should only emit meaningful visual bounds changes to avoid debug-frame jitter',
);

assert.match(
  avatar3DRuntimeMountSource,
  /createAvatar3DCanvasVisualBoundsSampler/u,
  'Three runtime should reuse a canvas visual-bounds sampler instead of allocating one per sample',
);

assert.match(
  avatar3DRuntimeMountSource,
  /onVisualBoundsChange\(normalizedMeasuredBounds\)/u,
  'Three runtime should refresh the desktop hit frame from live canvas measurements while motions play',
);

assert.doesNotMatch(
  visibilityRecoverySource,
  /preserveViewportEdgeAnchoringAcrossBoundsChange/u,
  '3D viewport recovery must not move a visible pet toward the viewport edge whenever scale changes its bounds',
);
assert.match(
  visibilityRecoverySource,
  /if \(isPetPositionVisibleInViewport\(position,[\s\S]*return position;/u,
  '3D viewport recovery should preserve the current anchor whenever the scaled model remains visible',
);
const visibilitySignatureSource = visibilityRecoverySource.match(
  /const visibilitySignature = \[([\s\S]*?)\]\.join\('\|'\);/u,
)?.[1] ?? '';
assert.ok(visibilitySignatureSource, '3D visibility recovery should keep an explicit recovery signature');
assert.doesNotMatch(
  visibilitySignatureSource,
  /visualBounds/u,
  'dynamic measured 3D bounds must not repeatedly retrigger viewport recovery while scaling',
);

console.log('pet scale position stability smoke ok');
