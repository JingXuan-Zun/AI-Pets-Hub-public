import assert from 'node:assert/strict';
import {
  resolvePetInteractiveHitAreaStyle,
  resolvePetSelectionHitAreaStyle,
  resolvePetWindowShapeProxyStyle,
} from '../src/components/pet/petInteractiveHitArea';
import { routeUnityRendererRuntimeEvent } from '../src/components/pet/petUnityRuntimeEventRouting';
import { shouldRouteAvatarRuntimeVisualBoundsEvent } from '../src/components/pet/petUnityVisualBoundsFiltering';
import { routeAvatarRuntimeVisualBoundsEvent } from '../src/components/pet/usePetContainerAvatarRuntimeEventHandler';
import {
  resolve3DDragNativeWindowShapeVisualBounds,
  resolve3DNativeWindowShapeSafeSquareVisualBounds,
  resolveFallback3DVisualBounds,
  resolvePetDragNativeWindowShapeVisualBounds,
  resolveUnity3DActivityClampVisualBounds,
  resolveUnity3DInteractiveVisualBounds,
} from '../src/components/pet/petVisualBounds';
import {
  mergeNativeDragInteractiveRegions,
  resolveNativeDragInteractiveRegionFromVisualBounds,
  resolveNativeDragInteractiveRegions,
} from '../src/components/pet/petNativeInteractiveRegionDragSync';
import {
  resolvePetVisualRendererProps,
  resolvePetVisualRendererShellSurface,
} from '../src/components/pet/petVisualRendererSurface';
import {
  IDLE_PET_RUNTIME_DRAG_MOTION_STATE,
  resolvePetThreeAvatarViewportStyle,
  resolvePetRuntimeDragMotionState,
} from '../src/components/pet/petAvatarRuntimeSurface';
import {
  resolveCompanionPetLayerZIndex,
  resolvePrimaryPetLayerZIndex,
} from '../src/components/pet/petLayerOrdering';
import {
  resolvePetPointerHitCandidatesFromPoint,
  resolveStackedPetSelectionTargetFromCandidates,
} from '../src/components/pet/petPointerSelection';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../src/multiPetRoster';
import { resolveAvatar3DPresentationState } from '../src/pet-runtime/avatar3d/avatar3dPresentationState';
import { resolveUnityBridgeEventSurface } from '../src/pet-runtime/avatar-runtime/unity/unityBridgeEventSurface';
import { type PetConfig } from '../src/types';
import { readProjectFile } from './smokeTestHarness.ts';

const petVisualRendererSource = readProjectFile('src/components/pet/PetVisualRenderer.tsx');
const petAvatarLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const petCompanionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
const petModel2DSource = readProjectFile('src/components/PetModel2D.tsx');
const indexCssSource = readProjectFile('src/index.css');

const noBoundsStyle = resolvePetInteractiveHitAreaStyle(256, null);

assert.equal(noBoundsStyle, undefined, 'hit area should remain unset when bounds are missing');

const style = resolvePetInteractiveHitAreaStyle(256, {
  left: 120,
  right: 140,
  top: 150,
  bottom: 180,
});

assert.equal(style?.left, '8px');
assert.equal(style?.top, '-22px');
assert.equal(style?.width, '260px');
assert.equal(style?.height, '330px');
assert.equal(style?.right, 'auto');
assert.equal(style?.bottom, 'auto');
assert.equal(
  style?.backgroundColor,
  undefined,
  'hit area should stay visually transparent while pointer-events and native hover polling handle mouse hit tests',
);

const wideAccessoryBounds = {
  bottom: 180,
  left: 230,
  right: 170,
  top: 150,
};
const wideAccessoryWindowShapeStyle = resolvePetWindowShapeProxyStyle(512, wideAccessoryBounds);
const wideAccessorySelectionStyle = resolvePetSelectionHitAreaStyle(512, wideAccessoryBounds, 'live2d');
const wideAccessory3DSelectionStyle = resolvePetSelectionHitAreaStyle(512, wideAccessoryBounds, '3d');

assert.equal(
  wideAccessoryWindowShapeStyle?.width,
  '400px',
  'wide Live2D/2D accessories should still keep the native window shape wide enough to avoid clipping visible pixels',
);
assert.equal(
  wideAccessorySelectionStyle?.width,
  '184px',
  'wide Live2D/2D models should keep the side passthrough area narrow enough for nearby desktop interaction',
);
assert.equal(
  wideAccessorySelectionStyle?.left,
  '164px',
  'wide Live2D/2D selection strip should stay centered on the avatar instead of following an umbrella or wing edge',
);
assert.equal(
  wideAccessory3DSelectionStyle?.width,
  '400px',
  '3D selection bounds should not be narrowed by the 2D accessory heuristic',
);

const primaryLayerZIndex = resolvePrimaryPetLayerZIndex({
  isDragging: false,
  isInteractiveDialogueMode: false,
});
const companionLayerZIndex = resolveCompanionPetLayerZIndex({
  isDragging: false,
  isInteractiveDialogueMode: false,
});

assert.ok(
  companionLayerZIndex > primaryLayerZIndex,
  'companion pet hit areas should sit above the primary pet when their visual hit boxes overlap',
);

assert.ok(
  resolvePrimaryPetLayerZIndex({
    isDragging: false,
    isInteractiveDialogueMode: false,
    isSelected: true,
  }) > companionLayerZIndex,
  'selected primary pet should temporarily rise above default companion hit areas so nearby models can be operated after selection',
);

assert.ok(
  resolveCompanionPetLayerZIndex({
    isDragging: false,
    isInteractiveDialogueMode: false,
    isSelected: true,
  }) > primaryLayerZIndex,
  'selected companion pet should remain above the primary hit area while it is the active target',
);

assert.equal(
  resolveStackedPetSelectionTargetFromCandidates({
    candidates: [
      { centerDistance: 0.34, petId: 'companion-a' },
      { centerDistance: 0.08, petId: PRIMARY_DESKTOP_PET_SLOT_ID },
    ],
    currentPetId: 'companion-a',
    selectedPetId: 'companion-a',
  }),
  PRIMARY_DESKTOP_PET_SLOT_ID,
  'overlapping pet hit areas should select the pet whose hit-area center is closest to the pointer instead of always keeping the top layer',
);

assert.equal(
  resolveStackedPetSelectionTargetFromCandidates({
    candidates: [
      { centerDistance: 0.22, petId: PRIMARY_DESKTOP_PET_SLOT_ID },
      { centerDistance: 0.24, petId: 'companion-a' },
    ],
    currentPetId: PRIMARY_DESKTOP_PET_SLOT_ID,
    selectedPetId: PRIMARY_DESKTOP_PET_SLOT_ID,
  }),
  PRIMARY_DESKTOP_PET_SLOT_ID,
  'the selected pet should keep a small stability bias when overlapped hit areas are nearly tied',
);

const createFakePetHitArea = (
  petId: string,
  rect: DOMRectInit,
  attributes: Record<string, string> = {},
) => ({
  closest: () => null,
  getAttribute: (name: string) => (
    name === 'data-desktop-pet-id'
      ? petId
      : attributes[name] ?? null
  ),
  getBoundingClientRect: () => ({
    bottom: (rect.y ?? 0) + (rect.height ?? 0),
    height: rect.height ?? 0,
    left: rect.x ?? 0,
    right: (rect.x ?? 0) + (rect.width ?? 0),
    top: rect.y ?? 0,
    width: rect.width ?? 0,
    x: rect.x ?? 0,
    y: rect.y ?? 0,
    toJSON: () => ({}),
  }),
});
const coveredPrimaryHitArea = createFakePetHitArea(PRIMARY_DESKTOP_PET_SLOT_ID, {
  height: 90,
  width: 90,
  x: 80,
  y: 80,
});
const coveringCompanionHitArea = createFakePetHitArea('companion-a', {
  height: 180,
  width: 180,
  x: 40,
  y: 40,
});
const coveringElement = {
  closest: () => coveringCompanionHitArea,
};
const coveredPrimaryCandidates = resolvePetPointerHitCandidatesFromPoint({
  elementsFromPoint: () => [coveringElement],
  querySelectorAll: () => [
    coveringCompanionHitArea,
    coveredPrimaryHitArea,
  ],
} as unknown as Document, 125, 125);

assert.deepEqual(
  coveredPrimaryCandidates.map((candidate) => candidate.petId),
  [PRIMARY_DESKTOP_PET_SLOT_ID, 'companion-a'],
  'covered lower pet hit areas should still be considered when the pointer is inside their rect',
);
assert.equal(
  resolveStackedPetSelectionTargetFromCandidates({
    candidates: coveredPrimaryCandidates,
    currentPetId: 'companion-a',
    selectedPetId: 'companion-a',
  }),
  PRIMARY_DESKTOP_PET_SLOT_ID,
  'top companion hit areas should not prevent selecting a covered primary pet when the pointer is closer to the primary center',
);

assert.ok(
  resolvePrimaryPetLayerZIndex({
    isDragging: true,
    isInteractiveDialogueMode: false,
  }) > companionLayerZIndex,
  'dragging the primary pet should temporarily raise it above companion hit areas',
);

assert.ok(
  resolveCompanionPetLayerZIndex({
    isDragging: true,
    isInteractiveDialogueMode: false,
  }) > primaryLayerZIndex,
  'dragging a companion pet should temporarily keep it above the primary hit area',
);

assert.match(
  petVisualRendererSource,
  /<Pet2DRenderer[\s\S]*isDragging=\{isDragging\}/,
  '2D renderer should receive pet drag state so it can stabilize sprite presentation while dragging',
);

assert.match(
  petAvatarLayerSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*latestDragPreviewPositionRef\.current[\s\S]*avatarShell\.style\.transform[\s\S]*\}, \[isDragging, renderedPosition\.x, renderedPosition\.y, shellSize\]\);/,
  'primary drag DOM preview should be replayed when the Live2D shell size changes so React cannot briefly write the stale position back',
);

assert.match(
  petAvatarLayerSource,
  /resolvePetAvatarShellStyle\(\{[\s\S]*shouldLetDragPreviewOwnTransform:\s*Boolean\(dragVisualPreviewSurfaceRef\)[\s\S]*\}\)/,
  'primary drag shell style should let the DOM preview own transform so React cannot rewrite stale renderedPosition during active drag',
);

assert.match(
  petCompanionLayerSource,
  /onStartDrag\?\.\(event, slot\.id, renderedPosition\)/,
  'companion drag should start from the current renderedPosition rather than the slot config position',
);

assert.match(
  petModel2DSource,
  /if \(!onVisualBoundsChangeRef\.current \|\| isDragging\)/,
  '2D sprite visual bounds should not be resampled while dragging because that can resize the hit area mid-drag',
);

assert.match(
  petModel2DSource,
  /isDragging[\s\S]*\?\s*'pet-anim-dragging'[\s\S]*:\s*visualPreset\.className/,
  '2D sprite animation should be frozen while dragging to avoid visual flicker',
);

assert.match(
  indexCssSource,
  /\.pet-anim-dragging\s*\{[\s\S]*animation-name:\s*none;[\s\S]*transform:\s*scaleX\(var\(--pet-face-direction\)\) scale\(var\(--pet-scale-base\)\);[\s\S]*\}/,
  'dragging 2D sprites should use a stable transform without opacity or bobbing animation',
);
assert.equal(
  resolvePetRuntimeDragMotionState('2d', true, 18, -10),
  IDLE_PET_RUNTIME_DRAG_MOTION_STATE,
  '2D drag should reuse the stable idle drag state so the renderer only pays for shell transform updates',
);
assert.equal(
  resolvePetRuntimeDragMotionState('live2d', true, 18, -10),
  IDLE_PET_RUNTIME_DRAG_MOTION_STATE,
  'Live2D drag should also avoid per-frame drag state object churn',
);
assert.deepEqual(
  resolvePetRuntimeDragMotionState('3d', true, 18, -10),
  { active: true, deltaX: 18, deltaY: -10 },
  '3D drag should keep the optional runtime drag feedback path',
);
assert.equal(
  resolvePetVisualRendererProps({
    action: 'IDLE',
    isMoving: false,
    modelType: '2d',
    modelUrl: 'local-model://sprite.png',
    scale: 1,
    viewport: {
      height: 256,
      width: 256,
      x: 120,
      y: 180,
    },
  }).viewport,
  null,
  '2D renderer props should not receive drag-position viewport churn because the outer shell transform owns movement',
);
assert.equal(
  resolvePetVisualRendererProps({
    action: 'IDLE',
    avatar3dRuntimeBackend: 'three',
    isMoving: false,
    modelType: '3d',
    modelUrl: 'local-model://avatar.vrm',
    scale: 1,
    viewport: {
      height: 280,
      width: 280,
      x: 120,
      y: 180,
    },
  }).viewport,
  null,
  'Three 3D renderer props should avoid per-drag viewport changes and let the shell transform move the avatar',
);
assert.deepEqual(
  resolvePetVisualRendererProps({
    action: 'IDLE',
    avatar3dRuntimeBackend: 'unity',
    isMoving: false,
    modelType: '3d',
    modelUrl: 'local-model://avatar.vrm',
    scale: 1,
    viewport: {
      height: 280,
      width: 280,
      x: 120,
      y: 180,
    },
  }).viewport,
  {
    height: 280,
    width: 280,
    x: 120,
    y: 180,
  },
  'Unity 3D renderer props should still receive viewport because the native overlay must follow the desktop position',
);

const defaultThreeFallbackBounds = resolveFallback3DVisualBounds(1, false);
const defaultUnityBounds = resolveUnity3DInteractiveVisualBounds(1, false);
const defaultUnityClampBounds = resolveUnity3DActivityClampVisualBounds(1, false);
const movingUnityBounds = resolveUnity3DInteractiveVisualBounds(1, true);
const defaultUnityHitArea = resolvePetInteractiveHitAreaStyle(256, defaultUnityBounds);

assert.ok(
  defaultUnityBounds.left + defaultUnityBounds.right < defaultThreeFallbackBounds.left + defaultThreeFallbackBounds.right,
  'Unity interactive fallback should stay horizontally tighter than the Three fallback to avoid edge clamp gaps',
);
assert.ok(
  defaultUnityBounds.top + defaultUnityBounds.bottom > defaultThreeFallbackBounds.top + defaultThreeFallbackBounds.bottom,
  'Unity interactive fallback should cover a taller native-rendered avatar than the Three fallback',
);
assert.equal(defaultUnityHitArea?.width, '140px');
assert.equal(defaultUnityHitArea?.height, '201px');
assert.deepEqual(
  movingUnityBounds,
  defaultUnityBounds,
  'Unity presentation bounds should stay fixed across moving and idle states',
);
assert.ok(
  defaultUnityClampBounds.top > defaultUnityBounds.top,
  'Unity activity clamp bounds should cover raised hands and tall poses above the tight interaction body',
);
assert.ok(
  defaultUnityClampBounds.left + defaultUnityClampBounds.right
    > defaultUnityBounds.left + defaultUnityBounds.right,
  'Unity activity clamp bounds should reserve a full presentation frame without enlarging the click hit area',
);

const defaultUnityRendererSurface = resolvePetVisualRendererShellSurface({
  avatar3dRuntimeBackend: 'unity',
  modelType: '3d',
  position: { x: 0, y: 0 },
  scale: 1,
  shouldAnimateAsMoving: false,
});

assert.equal(
  defaultUnityRendererSurface.interactiveHitAreaStyle.width,
  '112px',
  'Unity renderer shell should keep fallback display bounds but narrow the real 3D pointer hit area to the core body width',
);
assert.ok(
  defaultUnityRendererSurface.selectionScoreAreaAttributes,
  '3D renderer shell should expose separate overlap-selection score bounds without shrinking the real hit area',
);

const defaultAvatar3DPresentation = resolveAvatar3DPresentationState({
  presentationMode: 'default',
  scale: 1,
});
assert.equal(
  resolvePetThreeAvatarViewportStyle(defaultAvatar3DPresentation).pointerEvents,
  'none',
  'Three 3D canvas viewport should not intercept pointer hits outside the dedicated pet hit area',
);
const interactiveAvatar3DPresentation = resolveAvatar3DPresentationState({
  presentationMode: 'interactive-dialogue',
  scale: 1,
});
assert.ok(
  interactiveAvatar3DPresentation.cameraDistance >= defaultAvatar3DPresentation.cameraDistance,
  'interactive dialogue 3D presentation should not move the camera closer than the normal fit because wide models get clipped',
);
assert.ok(
  interactiveAvatar3DPresentation.viewportScale >= defaultAvatar3DPresentation.viewportScale + 0.72,
  'interactive dialogue 3D presentation should stay noticeably larger than normal mode',
);
assert.ok(
  interactiveAvatar3DPresentation.viewportScale <= defaultAvatar3DPresentation.viewportScale + 0.95,
  'interactive dialogue 3D presentation should enlarge the viewport without returning to the old clipping-prone zoom',
);
assert.equal(
  interactiveAvatar3DPresentation.viewportOffsetXPercent,
  0,
  'interactive dialogue 3D presentation should stay horizontally centered instead of pushing wide avatars into the side controls',
);
assert.ok(
  interactiveAvatar3DPresentation.viewportOffsetYPercent <= 8,
  'interactive dialogue 3D presentation should avoid pushing the viewport down far enough to crop tall hats or hair',
);

const base3DWindowShapeBounds = {
  bottom: 54,
  left: 74,
  right: 74,
  top: 100,
};
const idle3DWindowShapeBounds = resolve3DDragNativeWindowShapeVisualBounds(
  base3DWindowShapeBounds,
  false,
  { active: false, deltaX: 0, deltaY: 0 },
);
const square3DWindowShapeBounds = resolve3DNativeWindowShapeSafeSquareVisualBounds(base3DWindowShapeBounds);
assert.deepEqual(
  idle3DWindowShapeBounds,
  square3DWindowShapeBounds,
  '3D native window shape should expand narrow avatars to a square even while the pet is not being dragged',
);
assert.equal(
  idle3DWindowShapeBounds.left + idle3DWindowShapeBounds.right,
  idle3DWindowShapeBounds.top + idle3DWindowShapeBounds.bottom,
  '3D native window shape safe frame should be square',
);
const wide3DWindowShapeBounds = resolve3DNativeWindowShapeSafeSquareVisualBounds({
  bottom: 36,
  left: 140,
  right: 180,
  top: 84,
});
assert.equal(
  wide3DWindowShapeBounds.left + wide3DWindowShapeBounds.right,
  wide3DWindowShapeBounds.top + wide3DWindowShapeBounds.bottom,
  '3D native window shape should also pad short vertical bounds for wide avatars',
);
const dragged3DWindowShapeBounds = resolve3DDragNativeWindowShapeVisualBounds(
  base3DWindowShapeBounds,
  true,
  { active: true, deltaX: 20, deltaY: -12 },
);
assert.ok(
  dragged3DWindowShapeBounds.right - square3DWindowShapeBounds.right
    > dragged3DWindowShapeBounds.left - square3DWindowShapeBounds.left,
  '3D drag native shape should reserve more space in the horizontal drag direction',
);
assert.ok(
  dragged3DWindowShapeBounds.top - square3DWindowShapeBounds.top
    > dragged3DWindowShapeBounds.bottom - square3DWindowShapeBounds.bottom,
  '3D drag native shape should reserve more space in the vertical drag direction',
);

const draggedThreeRendererSurface = resolvePetVisualRendererShellSurface({
  avatar3dRuntimeBackend: 'three',
  dragMotionState: { active: true, deltaX: 20, deltaY: -12 },
  isDragging: true,
  measuredInteractiveVisualBounds: base3DWindowShapeBounds,
  measuredWindowShapeVisualBounds: base3DWindowShapeBounds,
  modelType: '3d',
  position: { x: 0, y: 0 },
  scale: 1,
  shouldAnimateAsMoving: false,
});
assert.ok(
  Number.parseInt(String(draggedThreeRendererSurface.windowShapeProxyStyle?.width ?? '0'), 10)
    > square3DWindowShapeBounds.left + square3DWindowShapeBounds.right,
  '3D drag should expand only the native window shape proxy so the previous setShape frame does not clip the moving model',
);
assert.equal(
  draggedThreeRendererSurface.interactiveHitAreaStyle.width,
  '112px',
  '3D drag native-shape padding should keep the DOM pointer hit area on the core body width',
);

const base2DWindowShapeBounds = {
  bottom: 42,
  left: 46,
  right: 50,
  top: 86,
};
const dragged2DWindowShapeBounds = resolvePetDragNativeWindowShapeVisualBounds(
  base2DWindowShapeBounds,
  true,
  { active: true, deltaX: -18, deltaY: 10 },
);
assert.ok(
  dragged2DWindowShapeBounds.left > base2DWindowShapeBounds.left,
  '2D drag native shape should reserve space in the horizontal drag direction',
);
assert.ok(
  dragged2DWindowShapeBounds.bottom > base2DWindowShapeBounds.bottom,
  '2D drag native shape should reserve space in the vertical drag direction',
);

const dragged2DRendererSurface = resolvePetVisualRendererShellSurface({
  dragMotionState: { active: true, deltaX: -18, deltaY: 10 },
  isDragging: true,
  measuredInteractiveVisualBounds: base2DWindowShapeBounds,
  measuredWindowShapeVisualBounds: base2DWindowShapeBounds,
  modelType: '2d',
  position: { x: 0, y: 0 },
  scale: 1,
  shouldAnimateAsMoving: false,
});
assert.ok(
  Number.parseInt(String(dragged2DRendererSurface.windowShapeProxyStyle?.width ?? '0'), 10)
    > base2DWindowShapeBounds.left + base2DWindowShapeBounds.right,
  '2D drag should expand the native window shape proxy so setShape lag does not clip the sprite',
);
assert.equal(
  dragged2DRendererSurface.interactiveHitAreaStyle.width,
  `${base2DWindowShapeBounds.left + base2DWindowShapeBounds.right}px`,
  '2D drag native-shape padding should not enlarge the DOM pointer hit area itself',
);
assert.equal(
  dragged2DRendererSurface.selectionScoreAreaAttributes,
  undefined,
  '2D models should not receive the 3D-only overlap-selection score bounds',
);

const draggedLive2DRendererSurface = resolvePetVisualRendererShellSurface({
  dragMotionState: { active: true, deltaX: 22, deltaY: -8 },
  isDragging: true,
  measuredInteractiveVisualBounds: base2DWindowShapeBounds,
  measuredWindowShapeVisualBounds: base2DWindowShapeBounds,
  modelType: 'live2d',
  position: { x: 0, y: 0 },
  scale: 1,
  shouldAnimateAsMoving: false,
});
assert.ok(
  Number.parseInt(String(draggedLive2DRendererSurface.windowShapeProxyStyle?.width ?? '0'), 10)
    > base2DWindowShapeBounds.left + base2DWindowShapeBounds.right,
  'Live2D drag should expand the native window shape proxy so setShape lag does not clip the canvas',
);
assert.equal(
  draggedLive2DRendererSurface.interactiveHitAreaStyle.width,
  `${base2DWindowShapeBounds.left + base2DWindowShapeBounds.right}px`,
  'Live2D drag native-shape padding should not enlarge the DOM pointer hit area itself',
);
assert.equal(
  draggedLive2DRendererSurface.selectionScoreAreaAttributes,
  undefined,
  'Live2D models should not receive the 3D-only overlap-selection score bounds',
);

const large3DSelectionScoreSurface = resolvePetVisualRendererShellSurface({
  measuredInteractiveVisualBounds: {
    bottom: 130,
    left: 230,
    right: 230,
    top: 230,
  },
  measuredWindowShapeVisualBounds: {
    bottom: 220,
    left: 260,
    right: 260,
    top: 260,
  },
  modelType: '3d',
  position: { x: 0, y: 0 },
  scale: 1,
  shouldAnimateAsMoving: false,
});
assert.equal(
  large3DSelectionScoreSurface.interactiveHitAreaStyle?.width,
  '112px',
  'large 3D measured bounds should narrow the real DOM pointer hit area to the 3D core body width',
);
assert.equal(
  large3DSelectionScoreSurface.interactiveHitAreaStyle?.height,
  `${defaultThreeFallbackBounds.top + defaultThreeFallbackBounds.bottom}px`,
  'large 3D measured bounds should cap the real DOM pointer hit area to the stable 3D fallback height',
);
assert.equal(
  large3DSelectionScoreSurface.windowShapeProxyStyle?.width,
  '520px',
  'large 3D measured window bounds should still keep the native window shape wide enough to avoid clipping visible animation pixels',
);
assert.equal(
  large3DSelectionScoreSurface.windowShapeProxyStyle?.height,
  '480px',
  'large 3D measured window bounds should still keep the native window shape tall enough to avoid clipping visible animation pixels',
);
const large3DHitArea = createFakePetHitArea('dragged-3d', {
  height: 360,
  width: 460,
  x: 0,
  y: 0,
}, large3DSelectionScoreSurface.selectionScoreAreaAttributes);
const nearby3DHitArea = createFakePetHitArea('nearby-3d', {
  height: 150,
  width: 150,
  x: 250,
  y: 110,
});
const overlapped3DCandidates = resolvePetPointerHitCandidatesFromPoint({
  elementsFromPoint: () => [
    { closest: () => large3DHitArea },
  ],
  querySelectorAll: () => [
    large3DHitArea,
    nearby3DHitArea,
  ],
} as unknown as Document, 322, 184);

assert.equal(
  resolveStackedPetSelectionTargetFromCandidates({
    candidates: overlapped3DCandidates,
    currentPetId: 'dragged-3d',
    selectedPetId: 'dragged-3d',
  }),
  'nearby-3d',
  '3D overlap selection should still let a nearby overlapped 3D pet win after the large model keeps its display protection separate from pointer hit area',
);

const predicted3DDragRegion = resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter: { x: 400, y: 300 },
  dragDelta: { x: 180, y: 0 },
  id: PRIMARY_DESKTOP_PET_SLOT_ID,
  isDragging: true,
  modelType: '3d',
  position: { x: 40, y: -20 },
  viewport: { height: 800, width: 1000 },
  visualBounds: base3DWindowShapeBounds,
});
const shiftedPredicted3DDragRegion = resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter: { x: 400, y: 300 },
  dragDelta: { x: 180, y: 0 },
  id: PRIMARY_DESKTOP_PET_SLOT_ID,
  isDragging: true,
  modelType: '3d',
  position: { x: 90, y: 10 },
  viewport: { height: 800, width: 1000 },
  visualBounds: base3DWindowShapeBounds,
});

assert.ok(
  predicted3DDragRegion,
  '3D drag preview should resolve a native shape region without reading DOM layout',
);
assert.ok(
  shiftedPredicted3DDragRegion,
  'shifted 3D drag preview should still resolve a native shape region',
);
assert.equal(
  shiftedPredicted3DDragRegion!.x - predicted3DDragRegion!.x,
  50,
  'drag-time native shape prediction should follow the pointer-computed target position horizontally',
);
assert.equal(
  shiftedPredicted3DDragRegion!.y - predicted3DDragRegion!.y,
  30,
  'drag-time native shape prediction should follow the pointer-computed target position vertically',
);
assert.ok(
  predicted3DDragRegion!.width > base3DWindowShapeBounds.left + base3DWindowShapeBounds.right,
  '3D drag-time native prediction should include the same enlarged shape reserve used by the DOM proxy',
);

const idle2DDragRegion = resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter: { x: 400, y: 300 },
  dragDelta: { x: 0, y: 0 },
  id: PRIMARY_DESKTOP_PET_SLOT_ID,
  isDragging: false,
  modelType: '2d',
  position: { x: 40, y: -20 },
  viewport: { height: 800, width: 1000 },
  visualBounds: base2DWindowShapeBounds,
});
const predicted2DDragRegion = resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter: { x: 400, y: 300 },
  dragDelta: { x: -120, y: 40 },
  id: PRIMARY_DESKTOP_PET_SLOT_ID,
  isDragging: true,
  modelType: '2d',
  position: { x: 40, y: -20 },
  viewport: { height: 800, width: 1000 },
  visualBounds: base2DWindowShapeBounds,
});
assert.ok(idle2DDragRegion && predicted2DDragRegion, '2D drag prediction should resolve native regions');
assert.ok(
  predicted2DDragRegion!.width > idle2DDragRegion!.width,
  '2D drag-time native prediction should include the same enlarged shape reserve used by the DOM proxy',
);

const idleLive2DDragRegion = resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter: { x: 400, y: 300 },
  dragDelta: { x: 0, y: 0 },
  id: PRIMARY_DESKTOP_PET_SLOT_ID,
  isDragging: false,
  modelType: 'live2d',
  position: { x: 40, y: -20 },
  viewport: { height: 800, width: 1000 },
  visualBounds: base2DWindowShapeBounds,
});
const predictedLive2DDragRegion = resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter: { x: 400, y: 300 },
  dragDelta: { x: 120, y: -40 },
  id: PRIMARY_DESKTOP_PET_SLOT_ID,
  isDragging: true,
  modelType: 'live2d',
  position: { x: 40, y: -20 },
  viewport: { height: 800, width: 1000 },
  visualBounds: base2DWindowShapeBounds,
});
assert.ok(idleLive2DDragRegion && predictedLive2DDragRegion, 'Live2D drag prediction should resolve native regions');
assert.ok(
  predictedLive2DDragRegion!.width > idleLive2DDragRegion!.width,
  'Live2D drag-time native prediction should include the same enlarged shape reserve used by the DOM proxy',
);

const predictedMultiPetDragRegions = resolveNativeDragInteractiveRegions({
  activityCenter: { x: 400, y: 300 },
  pets: [{
    dragDelta: { x: 80, y: 0 },
    id: PRIMARY_DESKTOP_PET_SLOT_ID,
    isDragging: true,
    modelType: '3d',
    position: { x: 40, y: -20 },
    visualBounds: base3DWindowShapeBounds,
  }, {
    id: 'companion-a',
    modelType: '2d',
    position: { x: 160, y: 60 },
    visualBounds: { bottom: 48, left: 50, right: 52, top: 90 },
  }],
  viewport: { height: 800, width: 1000 },
});
assert.equal(
  predictedMultiPetDragRegions.length,
  2,
  'drag-time native shape prediction should keep companion pet regions instead of only shaping the active pet',
);
assert.deepEqual(
  mergeNativeDragInteractiveRegions([
    { height: 10, width: 10, x: 1, y: 1 },
  ], [
    { height: 10, width: 10, x: 1, y: 1 },
    { height: 20, width: 20, x: 30, y: 30 },
  ]),
  [
    { height: 10, width: 10, x: 1, y: 1 },
    { height: 20, width: 20, x: 30, y: 30 },
  ],
  'drag-time native shape prediction should merge with the latest DOM snapshot without duplicate regions',
);

const clampedUnityBoundsEvent = resolveUnityBridgeEventSurface({
  bounds: {
    bottom: 1,
    left: 1,
    right: 1,
    top: 1,
  },
  petId: 'main',
  runtimeKind: 'unity',
  source: 'measured',
  type: 'visual-bounds',
} as DesktopPetUnityBridgeEventLike);

assert.deepEqual(
  clampedUnityBoundsEvent && 'bounds' in clampedUnityBoundsEvent
    ? clampedUnityBoundsEvent.bounds
    : null,
  resolveUnity3DInteractiveVisualBounds(1, false),
  'Unity measured visual bounds should not shrink the desktop hit area below the Unity fallback minimum',
);

const primaryMeasuredBounds = {
  bottom: 88,
  left: 102,
  right: 104,
  top: 148,
};
let routedPrimaryBounds: typeof primaryMeasuredBounds | null = null;
let routedCompanionBounds: { bounds: typeof primaryMeasuredBounds; petId: string } | null = null;

routeAvatarRuntimeVisualBoundsEvent({
  bounds: primaryMeasuredBounds,
  petId: PRIMARY_DESKTOP_PET_SLOT_ID,
  runtimeKind: 'unity',
  source: 'measured',
  type: 'visual-bounds',
}, {
  onCompanionVisualBoundsChange: (petId, bounds) => {
    routedCompanionBounds = { bounds, petId };
  },
  onPrimaryVisualBoundsChange: (bounds) => {
    routedPrimaryBounds = bounds;
  },
});

assert.deepEqual(
  routedPrimaryBounds,
  primaryMeasuredBounds,
  'Unity measured bounds for the primary pet should refresh the primary interactive hit area',
);
assert.equal(
  routedCompanionBounds,
  null,
  'Unity measured bounds for the primary pet should not update companion hit areas',
);

routeAvatarRuntimeVisualBoundsEvent({
  bounds: primaryMeasuredBounds,
  petId: 'companion-a',
  runtimeKind: 'unity',
  source: 'measured',
  type: 'visual-bounds',
}, {
  onCompanionVisualBoundsChange: (petId, bounds) => {
    routedCompanionBounds = { bounds, petId };
  },
  onPrimaryVisualBoundsChange: (bounds) => {
    routedPrimaryBounds = bounds;
  },
});

assert.deepEqual(
  routedCompanionBounds,
  {
    bounds: primaryMeasuredBounds,
    petId: 'companion-a',
  },
  'Unity measured bounds for a companion pet should refresh that companion interactive hit area',
);

let rendererMeasuredBounds: typeof primaryMeasuredBounds | null = null;
const didRouteRendererBounds = routeUnityRendererRuntimeEvent({
  bounds: primaryMeasuredBounds,
  petId: PRIMARY_DESKTOP_PET_SLOT_ID,
  runtimeKind: 'unity',
  source: 'measured',
  type: 'visual-bounds',
}, PRIMARY_DESKTOP_PET_SLOT_ID, (bounds) => {
  rendererMeasuredBounds = bounds;
});

assert.equal(
  didRouteRendererBounds,
  false,
  'Unity renderer should ignore measured visual bounds during the stable presentation pass',
);
assert.deepEqual(
  rendererMeasuredBounds,
  null,
  'Unity measured bounds should not refresh the local DOM hit area while the Unity presentation box is fixed',
);
assert.equal(
  shouldRouteAvatarRuntimeVisualBoundsEvent({
    bounds: primaryMeasuredBounds,
    petId: PRIMARY_DESKTOP_PET_SLOT_ID,
    runtimeKind: 'unity',
    source: 'measured',
    type: 'visual-bounds',
  }, {
    companionPets: [],
    customModelPresets: [],
    modelType: '3d',
    modelUrl: 'local-model://stable-unity.vrm',
    scale: 1,
  } as PetConfig),
  false,
  'Unity measured visual bounds should not drive global physics or collision bounds during the stable presentation pass',
);
assert.equal(
  routeUnityRendererRuntimeEvent({
    bounds: primaryMeasuredBounds,
    petId: 'companion-a',
    runtimeKind: 'unity',
    source: 'measured',
    type: 'visual-bounds',
  }, PRIMARY_DESKTOP_PET_SLOT_ID, () => {
    throw new Error('renderer should ignore measured bounds for another pet');
  }),
  false,
  'Unity renderer should ignore measured visual bounds for other pets',
);

console.log('pet interactive hit area smoke ok');
