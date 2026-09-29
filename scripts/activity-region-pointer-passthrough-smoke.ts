import assert from 'node:assert/strict';
import {
  isClientPointInsideElementRect,
  mapScreenPointToClientPoint,
  resolveNativeElementScope,
  resolveNativeInteractiveRegionFromRect,
  resolveNativeInteractiveRegionPadding,
  resolveNativeInteractiveRegionSyncDelayMs,
  shouldCollectNativeInteractiveElement,
  shouldKeepPointerInteractive,
  shouldSuspendNativePetShape,
  shouldUseHoveredInteractiveElement,
  shouldUseFullWindowNativeShape,
  shouldUseImmediateNativeInteractiveRegionSync,
} from '../src/components/pet/usePetContainerShellEffects';
import {
  resolvePetInteractiveHitAreaStyle,
  resolvePetSelectionHitAreaStyle,
  resolvePetWindowShapeProxyStyle,
} from '../src/components/pet/petInteractiveHitArea';
import {
  resolveNativePetShapeMotionActive,
  shouldTreat3DVisualStateAsNativeShapeMotion,
} from '../src/components/pet/petNativeShapeMotionState';
import {
  createNativeInteractiveRegionPostRenderSyncKey,
} from '../src/components/pet/petNativeInteractiveRegionSyncKey';
import {
  QUICK_MENU_BUTTON_CENTER_GAP,
  QUICK_MENU_BUTTON_HEIGHT,
  QUICK_MENU_CONTENT_GAP,
  QUICK_MENU_ICON_SIZE,
  QUICK_MENU_LABEL_FONT_SIZE,
  QUICK_MENU_SCALE,
  resolvePetQuickActionMenuCenterY,
  resolvePetQuickActionMenuGeometry,
} from '../src/components/pet/petQuickActionMenuGeometry';
import {
  resolveNativeDragInteractiveRegions,
} from '../src/components/pet/petNativeInteractiveRegionDragSync';
import {
  clampSceneEntityToActivityArea,
} from '../src/components/pet/petActivityRegionMath';
import {
  hasExceededPetDragActivationThreshold,
} from '../src/pet-runtime/interactions/petDragController';
import { readProjectFile } from './smokeTestHarness.ts';

function extractTagsWithAttribute(source: string, attribute: string) {
  const tags: string[] = [];
  const lines = source.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (!lines[lineIndex]?.trim().startsWith('<div')) {
      continue;
    }

    const tagLines = [lines[lineIndex]];
    if (lines[lineIndex]?.includes('/>') || lines[lineIndex]?.includes('>')) {
      const tag = tagLines.join('\n');
      if (tag.includes(attribute)) {
        tags.push(tag);
      }
      continue;
    }

    for (let nextLineIndex = lineIndex + 1; nextLineIndex < lines.length; nextLineIndex += 1) {
      tagLines.push(lines[nextLineIndex] ?? '');
      if (lines[nextLineIndex]?.includes('/>') || lines[nextLineIndex]?.includes('>')) {
        break;
      }
    }

    const tag = tagLines.join('\n');
    if (tag.includes(attribute)) {
      tags.push(tag);
    }
  }

  return tags;
}

assert.equal(
  shouldKeepPointerInteractive({
    hasActiveInteraction: false,
    hasEmbeddedPanelOpen: false,
    hasHoveredInteractiveElement: false,
    hasPointerLock: false,
  }),
  false,
  'desktop window should stay pointer-through when nothing interactive is active',
);

assert.equal(
  hasExceededPetDragActivationThreshold({ x: 100, y: 100 }, { x: 102, y: 100 }),
  false,
  'pet click jitter should not activate full-window native shape before a real drag starts',
);
assert.equal(
  hasExceededPetDragActivationThreshold({ x: 100, y: 100 }, { x: 104, y: 100 }),
  true,
  'pet drag should activate full-window native shape once pointer movement crosses the drag threshold',
);

assert.equal(
  shouldKeepPointerInteractive({
    hasActiveInteraction: false,
    hasEmbeddedPanelOpen: false,
    hasHoveredInteractiveElement: true,
    hasPointerLock: false,
  }),
  true,
  'hovered activity-region handles should make the desktop window clickable',
);

assert.equal(
  shouldKeepPointerInteractive({
    hasActiveInteraction: true,
    hasEmbeddedPanelOpen: false,
    hasHoveredInteractiveElement: false,
    hasPointerLock: false,
  }),
  true,
  'drag and resize sessions must keep receiving pointer events',
);

assert.equal(
  shouldKeepPointerInteractive({
    hasActiveInteraction: false,
    hasEmbeddedPanelOpen: true,
    hasHoveredInteractiveElement: false,
    hasPointerLock: false,
  }),
  true,
  'embedded panels should keep the desktop window interactive',
);

assert.equal(
  shouldUseHoveredInteractiveElement({
    hasHoveredInteractiveElement: true,
    hasHoveredPetHitArea: true,
    suppressPetHitAreaHoverActivation: true,
  }),
  false,
  'after a pet-body click, staying over the pet hit area should not keep the full transparent input window interactive',
);

assert.equal(
  shouldUseHoveredInteractiveElement({
    hasHoveredInteractiveElement: true,
    hasHoveredPetHitArea: false,
    suppressPetHitAreaHoverActivation: true,
  }),
  true,
  'pet menus and controls should still become interactive even when pet-body hover activation is suppressed',
);

const petScopedElement = {
  getAttribute: (name: string) => (name === 'data-desktop-pet-native-scope' ? 'pet' : null),
  closest: () => null,
} as unknown as Element;
const petTransparentHitAreaElement = {
  getAttribute: (name: string) => (
    name === 'data-desktop-pet-native-scope'
      ? 'pet'
      : name === 'data-desktop-pet-interactive'
        ? 'true'
        : null
  ),
  hasAttribute: (name: string) => name === 'data-desktop-pet-interactive',
  closest: () => null,
} as unknown as Element;
const activityScopedElement = {
  getAttribute: (name: string) => (name === 'data-desktop-pet-native-scope' ? 'activity-region' : null),
  hasAttribute: () => false,
  closest: () => null,
} as unknown as Element;

assert.equal(resolveNativeElementScope(petScopedElement), 'pet');
assert.equal(resolveNativeElementScope(activityScopedElement), 'activity-region');
assert.equal(
  shouldCollectNativeInteractiveElement(petTransparentHitAreaElement, false),
  false,
  'pet transparent hit areas should not enter BrowserWindow shape because 3D display protection would block nearby pets',
);
assert.equal(
  shouldCollectNativeInteractiveElement(petScopedElement, true),
  true,
  'pet-scoped visible/protection regions should stay in BrowserWindow shape because setShape clips visible model pixels',
);
assert.equal(
  shouldCollectNativeInteractiveElement(activityScopedElement, true),
  true,
  'activity-region controls should also stay shaped while pet motion is active',
);

const nativeInteractiveRegionSyncKey = createNativeInteractiveRegionPostRenderSyncKey({
  activityArea: { width: 800, height: 600 },
  activityCenter: { x: 400, y: 300 },
  companionSlots: [{
    id: 'companion-a',
    position: { x: 120, y: 80 },
    scale: 1,
    visualBounds: { left: 50, right: 54, top: 100, bottom: 40 },
  }],
  isActivityRegionInteractionActive: false,
  isCompanionDragActive: false,
  isPetMotionActive: false,
  isPrimaryDragActive: true,
  primary: {
    position: { x: 10, y: 20 },
    scale: 1,
    visualBounds: { left: 72, right: 72, top: 140, bottom: 52 },
  },
});
assert.notEqual(
  createNativeInteractiveRegionPostRenderSyncKey({
    activityArea: { width: 800, height: 600 },
    activityCenter: { x: 400, y: 300 },
    companionSlots: [{
      id: 'companion-a',
      position: { x: 120, y: 80 },
      scale: 1,
      visualBounds: { left: 50, right: 54, top: 100, bottom: 40 },
    }],
    isActivityRegionInteractionActive: false,
    isCompanionDragActive: false,
    isPetMotionActive: false,
    isPrimaryDragActive: true,
    primary: {
      position: { x: 11, y: 20 },
      scale: 1,
      visualBounds: { left: 72, right: 72, top: 140, bottom: 52 },
    },
  }),
  nativeInteractiveRegionSyncKey,
  'primary drag render-position changes must create a new native region post-render sync key',
);
assert.notEqual(
  createNativeInteractiveRegionPostRenderSyncKey({
    activityArea: { width: 800, height: 600 },
    activityCenter: { x: 400, y: 300 },
    companionSlots: [{
      id: 'companion-a',
      position: { x: 121, y: 80 },
      scale: 1,
      visualBounds: { left: 50, right: 54, top: 100, bottom: 40 },
    }],
    isActivityRegionInteractionActive: false,
    isCompanionDragActive: true,
    isPetMotionActive: false,
    isPrimaryDragActive: false,
    primary: {
      position: { x: 10, y: 20 },
      scale: 1,
      visualBounds: { left: 72, right: 72, top: 140, bottom: 52 },
    },
  }),
  nativeInteractiveRegionSyncKey,
  'companion drag render-position changes must create a new native region post-render sync key',
);

const movingNativeInteractiveRegionSyncKey = createNativeInteractiveRegionPostRenderSyncKey({
  activityArea: { width: 800, height: 600 },
  activityCenter: { x: 400, y: 300 },
  companionSlots: [],
  isActivityRegionInteractionActive: false,
  isCompanionDragActive: false,
  isPetMotionActive: true,
  isPrimaryDragActive: false,
  primary: {
    position: { x: 10, y: 20 },
    scale: 1,
    visualBounds: { left: 137, right: 196, top: 306, bottom: 481 },
  },
});
assert.equal(
  createNativeInteractiveRegionPostRenderSyncKey({
    activityArea: { width: 800, height: 600 },
    activityCenter: { x: 400, y: 300 },
    companionSlots: [],
    isActivityRegionInteractionActive: false,
    isCompanionDragActive: false,
    isPetMotionActive: true,
    isPrimaryDragActive: false,
    primary: {
      position: { x: 11, y: 22 },
      scale: 1,
      visualBounds: { left: 140, right: 190, top: 309, bottom: 476 },
    },
  }),
  movingNativeInteractiveRegionSyncKey,
  '3D motion visual-bounds jitter should not create a new native region post-render sync key every frame',
);
assert.notEqual(
  createNativeInteractiveRegionPostRenderSyncKey({
    activityArea: { width: 800, height: 600 },
    activityCenter: { x: 400, y: 300 },
    companionSlots: [],
    isActivityRegionInteractionActive: true,
    isCompanionDragActive: false,
    isPetMotionActive: true,
    isPrimaryDragActive: false,
    primary: {
      position: { x: 10, y: 20 },
      scale: 1,
      visualBounds: { left: 138, right: 196, top: 306, bottom: 481 },
    },
  }),
  movingNativeInteractiveRegionSyncKey,
  'activity-region editing should keep precise native region keys even while 3D motion is active',
);

assert.equal(
  shouldUseFullWindowNativeShape({
    hasActivityRegionInteraction: false,
    hasEmbeddedPanelOpen: false,
    hasPanelInteraction: false,
    hasPetDragInteraction: false,
    hasPointerLock: true,
  }),
  false,
  'plain pet pointer lock should not expand the transparent desktop window shape to the full screen',
);

assert.equal(
  shouldUseFullWindowNativeShape({
    hasActivityRegionInteraction: false,
    hasEmbeddedPanelOpen: false,
    forceFullWindowOnPetDrag: false,
    hasPanelInteraction: false,
    hasPetDragInteraction: true,
    hasPointerLock: true,
  }),
  false,
  'primary pet click/drag state should keep native shape on the pet visual bounds by default',
);

assert.equal(
  shouldUseFullWindowNativeShape({
    forceFullWindowOnPetDrag: true,
    hasActivityRegionInteraction: false,
    hasEmbeddedPanelOpen: false,
    hasPanelInteraction: false,
    hasPetDragInteraction: true,
    hasPointerLock: true,
  }),
  true,
  'diagnostic drag mode should expand native shape to full window while a primary pet is dragged',
);

assert.equal(
  shouldUseFullWindowNativeShape({
    forceFullWindowOnPetDrag: true,
    hasActivityRegionInteraction: false,
    hasCompanionPetDragInteraction: true,
    hasEmbeddedPanelOpen: false,
    hasPanelInteraction: false,
    hasPetDragInteraction: false,
    hasPointerLock: true,
  }),
  true,
  'diagnostic drag mode should expand native shape to full window while a companion pet is dragged',
);

assert.equal(
  shouldUseFullWindowNativeShape({
    hasActivityRegionInteraction: true,
    hasEmbeddedPanelOpen: false,
    hasPanelInteraction: false,
    hasPetDragInteraction: false,
    hasPointerLock: true,
  }),
  false,
  'activity region edit sessions should rely on pointer capture instead of covering browser video with a full-window native shape',
);

assert.equal(
  shouldUseFullWindowNativeShape({
    hasActivityRegionInteraction: false,
    hasEmbeddedPanelOpen: true,
    hasPanelInteraction: false,
    hasPetDragInteraction: false,
    hasPointerLock: false,
  }),
  true,
  'embedded panels should still use a full-window native shape so their controls remain clickable',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: false,
    hasPetDragInteraction: false,
    isStartupSuppressionActive: false,
    isPetMotionActive: true,
  }),
  true,
  'native pet shape should pause while auto movement is active to avoid Windows transparent shape border flashing',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: false,
    hasPetDragInteraction: true,
    isStartupSuppressionActive: false,
    isPetMotionActive: false,
  }),
  true,
  'native pet shape should pause while the pet is being dragged instead of clearing and reapplying shape on pointer down',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: true,
    hasPetDragInteraction: true,
    isStartupSuppressionActive: true,
    isPetMotionActive: true,
  }),
  false,
  'full-window panel and activity-region sessions should not be suspended by pet motion state',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: false,
    hasPetDragInteraction: false,
    isStartupSuppressionActive: true,
    isPetMotionActive: false,
  }),
  true,
  'startup warmup should suspend ordinary pet native shape to avoid transparent setShape flashing while Windows compositing stabilizes',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: false,
    hasPetDragInteraction: false,
    hasPointerActivatedNativePetShape: true,
    isStartupSuppressionActive: true,
    isPetMotionActive: false,
  }),
  false,
  'hovered pet native shape should activate before pointer passthrough is disabled so the transparent input window never covers the full browser video surface',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: false,
    hasPetDragInteraction: false,
    hasPointerActivatedNativePetShape: true,
    isStartupSuppressionActive: false,
    isPetMotionActive: true,
  }),
  true,
  'pointer-activated native shape should still pause while auto movement is changing the pet bounds',
);

assert.equal(
  shouldSuspendNativePetShape({
    hasFullWindowNativeShape: false,
    hasPetDragInteraction: false,
    isStartupSuppressionActive: false,
    isPetMotionActive: false,
  }),
  true,
  'idle ordinary pet native shape should stay disabled after startup to avoid late transparent-window compositor residue',
);

assert.equal(
  shouldUseImmediateNativeInteractiveRegionSync({
    hasActivityRegionInteraction: true,
    hasPetDragInteraction: false,
    isPetMotionActive: false,
  }),
  true,
  'dragging or resizing the activity region should sync native shape immediately so the visible frame does not flash away',
);

assert.equal(
  shouldUseImmediateNativeInteractiveRegionSync({
    hasPetDragInteraction: true,
    isPetMotionActive: false,
  }),
  true,
  'dragging the primary pet should sync native shape on the next animation frame so visible clipping follows the rendered model',
);

assert.equal(
  shouldUseImmediateNativeInteractiveRegionSync({
    hasCompanionPetDragInteraction: true,
    hasPetDragInteraction: false,
    isPetMotionActive: false,
  }),
  true,
  'dragging a companion pet should sync native shape on the next animation frame so overlapping pets remain selectable',
);

assert.equal(
  resolveNativeInteractiveRegionSyncDelayMs({
    hasActivityRegionInteraction: true,
    hasPetDragInteraction: false,
    isPetMotionActive: false,
    timeSinceLastSyncMs: 4,
  }),
  0,
  'activity-region edit sessions should not use the idle 120ms native shape throttle because stale shape clips the moving frame',
);

assert.equal(
  resolveNativeInteractiveRegionSyncDelayMs({
    hasPetDragInteraction: false,
    isPetMotionActive: true,
    timeSinceLastSyncMs: 4,
  }),
  0,
  'auto-moving pets should not use the idle 120ms native shape throttle because stale shape clips the moving model',
);

assert.equal(
  resolveNativeInteractiveRegionSyncDelayMs({
    hasPetDragInteraction: false,
    isPetMotionActive: false,
    timeSinceLastSyncMs: 40,
  }),
  80,
  'idle native shape sync should keep the normal throttle to avoid unnecessary setShape churn over browser video',
);

assert.equal(
  shouldTreat3DVisualStateAsNativeShapeMotion({
    currentAction: 'HAPPY',
    modelType: '3d',
  }),
  true,
  '3D expression actions should use immediate native shape sync because changing visual bounds otherwise clips the animated pose',
);

assert.equal(
  shouldTreat3DVisualStateAsNativeShapeMotion({
    currentAction: 'HAPPY',
    modelType: '2d',
  }),
  false,
  '2D actions should not opt into the 3D native shape motion path',
);

assert.equal(
  shouldTreat3DVisualStateAsNativeShapeMotion({
    currentAction: 'IDLE',
    modelType: '3d',
  }),
  false,
  'idle 3D avatars should keep the idle native shape throttle when no custom motion is active',
);

assert.equal(
  shouldTreat3DVisualStateAsNativeShapeMotion({
    currentAction: 'IDLE',
    manualMotionBinding: {
      id: 'motion-wide',
      motionKey: 'dance',
      name: 'wide dance',
    },
    modelType: '3d',
  }),
  true,
  'custom 3D motions should use immediate native shape sync because their live visual bounds can change without desktop auto movement',
);

assert.equal(
  resolveNativePetShapeMotionActive({
    companionSlots: [{
      currentAction: 'EATING',
      id: 'companion-1',
      modelType: '3d',
    }],
    isAutoMoving: false,
    primary: {
      currentAction: 'IDLE',
      modelType: '2d',
    },
  }),
  true,
  'companion 3D visual actions should also keep native shape sync live while their bounds animate',
);

assert.deepEqual(
  mapScreenPointToClientPoint({ x: 1120, y: 740 }, { x: 1000, y: 700 }),
  { x: 120, y: 40 },
  'screen cursor coordinates should map to renderer client coordinates',
);

assert.equal(
  mapScreenPointToClientPoint({ x: Number.NaN, y: 740 }, { x: 1000, y: 700 }),
  null,
  'invalid cursor coordinates should be ignored',
);

const activityRegionLeftHandle = {
  getBoundingClientRect: () => ({
    bottom: 360,
    height: 200,
    left: 124,
    right: 156,
    top: 160,
    width: 32,
  }),
} as Element;

assert.equal(
  isClientPointInsideElementRect({ x: 140, y: 240 }, activityRegionLeftHandle),
  true,
  'activity region left handle rectangle should be recognized across the expanded stable hit target',
);

assert.equal(
  isClientPointInsideElementRect({ x: 112, y: 240 }, activityRegionLeftHandle),
  false,
  'points outside the activity region left handle rectangle should not keep the window interactive',
);

assert.deepEqual(
  resolveNativeInteractiveRegionFromRect({
    bottom: 260,
    left: 120,
    right: 220,
    top: 140,
  }, {
    height: 400,
    width: 500,
  }, 32),
  {
    height: 184,
    width: 164,
    x: 88,
    y: 108,
  },
  'native Unity input regions should pad and clamp DOM hit rectangles before applying the OS shape',
);

assert.deepEqual(
  resolveNativeInteractiveRegionFromRect({
    bottom: 260,
    left: 120,
    right: 220,
    top: 140,
  }, {
    height: 400,
    width: 500,
  }),
  {
    height: 132,
    width: 112,
    x: 114,
    y: 134,
  },
  'native Unity input regions should keep the default pet hit-area padding narrow',
);

const zeroPaddingShapeElement = {
  getAttribute: (name: string) => (name === 'data-desktop-pet-window-shape-padding' ? '0' : null),
  hasAttribute: (name: string) => name === 'data-desktop-pet-window-shape',
} as unknown as Element;

assert.equal(
  resolveNativeInteractiveRegionPadding(zeroPaddingShapeElement),
  0,
  'visible 1px activity border strips should be able to opt out of the default 48px native shape padding',
);

const sweptDragRegion = resolveNativeDragInteractiveRegions({
  activityCenter: { x: 400, y: 300 },
  padding: 0,
  pets: [{
    dragDelta: { x: 260, y: 0 },
    id: 'primary',
    isDragging: true,
    modelType: '3d',
    position: { x: 260, y: 0 },
    previousPosition: { x: 0, y: 0 },
    visualBounds: {
      bottom: 40,
      left: 70,
      right: 70,
      top: 90,
    },
  }],
  viewport: { height: 900, width: 1200 },
})[0];

assert.ok(sweptDragRegion, 'swept drag region should be produced for a fast 3D drag frame');
assert.ok(
  sweptDragRegion.x <= 330,
  'swept drag native shape should still include the previous rendered pet position',
);
assert.ok(
  sweptDragRegion.x + sweptDragRegion.width >= 730,
  'swept drag native shape should include the pointer-computed next pet position',
);

const sweptActivityRegionMove = resolveNativeDragInteractiveRegions({
  activityCenter: { x: 520, y: 300 },
  padding: 0,
  pets: [{
    id: 'primary',
    isDragging: true,
    modelType: 'live2d',
    position: { x: 0, y: 0 },
    previousActivityCenter: { x: 400, y: 300 },
    visualBounds: {
      bottom: 60,
      left: 80,
      right: 80,
      top: 120,
    },
  }],
  viewport: { height: 900, width: 1200 },
})[0];

assert.ok(sweptActivityRegionMove, 'activity-region move should produce a native shape preview');
assert.ok(
  sweptActivityRegionMove.x <= 320,
  'activity-region native preview should include the previous activity-center pet pixels',
);
assert.ok(
  sweptActivityRegionMove.x + sweptActivityRegionMove.width >= 600,
  'activity-region native preview should include the next activity-center pet pixels',
);

const activityResizeCompanionVisualBounds = {
  bottom: 60,
  left: 120,
  right: 120,
  top: 140,
};
const activityResizeCompanionNextPosition = clampSceneEntityToActivityArea(
  { x: 360, y: 0 },
  { height: 420, width: 520 },
  'pet',
  {
    folderHalfHeight: 40,
    folderHalfWidth: 40,
    folderBoundaryExtents: {
      bottom: 40,
      left: 40,
      right: 40,
      top: 40,
    },
    petScale: 1,
    petVisualBounds: activityResizeCompanionVisualBounds,
  },
);
const sweptActivityResizeCompanionRegion = resolveNativeDragInteractiveRegions({
  activityCenter: { x: 400, y: 300 },
  padding: 0,
  pets: [{
    id: 'companion-1',
    isDragging: true,
    modelType: '3d',
    position: activityResizeCompanionNextPosition,
    previousPosition: { x: 360, y: 0 },
    visualBounds: activityResizeCompanionVisualBounds,
  }],
  viewport: { height: 900, width: 1200 },
})[0];

assert.ok(
  activityResizeCompanionNextPosition.x < 360,
  'activity-region resize fixture should clamp the companion into the next smaller activity area',
);
assert.ok(
  sweptActivityResizeCompanionRegion,
  'activity-region resize should produce a swept companion native shape preview',
);
assert.ok(
  sweptActivityResizeCompanionRegion.x <= 400 + activityResizeCompanionNextPosition.x - activityResizeCompanionVisualBounds.left,
  'activity-region resize native preview should include the companion clamped next-frame pixels',
);
assert.ok(
  sweptActivityResizeCompanionRegion.x + sweptActivityResizeCompanionRegion.width >= 400 + 360 + activityResizeCompanionVisualBounds.right,
  'activity-region resize native preview should include the companion previous rendered pixels',
);

const petWindowShapeProxyStyle = resolvePetWindowShapeProxyStyle(256, {
  bottom: 40,
  left: 60,
  right: 80,
  top: 100,
});
const petInteractiveHitAreaStyle = resolvePetInteractiveHitAreaStyle(256, {
  bottom: 40,
  left: 60,
  right: 80,
  top: 100,
});
const widePetSelectionHitAreaStyle = resolvePetSelectionHitAreaStyle(512, {
  bottom: 180,
  left: 230,
  right: 170,
  top: 150,
}, 'live2d');
const widePetWindowShapeProxyStyle = resolvePetWindowShapeProxyStyle(512, {
  bottom: 180,
  left: 230,
  right: 170,
  top: 150,
});

assert.deepEqual(
  petWindowShapeProxyStyle,
  {
    bottom: 'auto',
    height: '140px',
    left: '68px',
    right: 'auto',
    top: '28px',
    width: '140px',
  },
  'pet window shape proxy should follow visual bounds instead of the full square render shell',
);

assert.equal(
  Object.prototype.hasOwnProperty.call(petWindowShapeProxyStyle ?? {}, 'backgroundColor'),
  false,
  'pet window shape proxy should be invisible and must not paint the transparent desktop window',
);

assert.deepEqual(
  petInteractiveHitAreaStyle,
  petWindowShapeProxyStyle,
  'normal pet interactive hit area should match visual bounds without painting a translucent white rectangle',
);

assert.equal(
  widePetWindowShapeProxyStyle?.width,
  '400px',
  'wide pet window shape proxy should keep the full visual width for transparent-window clipping',
);

assert.equal(
  widePetSelectionHitAreaStyle?.width,
  '184px',
  'wide Live2D/2D pet selection hit area should leave more horizontal room for desktop pointer passthrough',
);

assert.equal(
  Object.prototype.hasOwnProperty.call(petInteractiveHitAreaStyle ?? {}, 'backgroundColor'),
  false,
  'pet interactive hit area should remain hit-testable without drawing white pixels on the transparent desktop window',
);

const quickActionMenuGeometry = resolvePetQuickActionMenuGeometry();
const quickActionMenuVisualLeft = quickActionMenuGeometry.stageOffsetX + quickActionMenuGeometry.visualBounds.left;
const quickActionMenuVisualTop = quickActionMenuGeometry.stageOffsetY + quickActionMenuGeometry.visualBounds.top;
const quickActionMenuVisualRight = quickActionMenuGeometry.stageOffsetX + quickActionMenuGeometry.visualBounds.right;
const quickActionMenuVisualBottom = quickActionMenuGeometry.stageOffsetY + quickActionMenuGeometry.visualBounds.bottom;

assert.ok(
  Math.abs(quickActionMenuVisualLeft - quickActionMenuGeometry.safePaddingX) < 0.01,
  'quick action buttons should start at the interactive region safe left padding',
);
assert.ok(
  Math.abs(quickActionMenuVisualTop - quickActionMenuGeometry.safePaddingY) < 0.01,
  'quick action buttons should start at the interactive region safe top padding',
);
assert.ok(
  quickActionMenuVisualRight <= quickActionMenuGeometry.interactiveWidth - quickActionMenuGeometry.safePaddingX,
  'quick action buttons should stay inside the interactive region right padding',
);
assert.ok(
  quickActionMenuVisualBottom <= quickActionMenuGeometry.interactiveHeight - quickActionMenuGeometry.safePaddingY,
  'quick action buttons should stay inside the interactive region bottom padding',
);

const quickActionMenuLabelBottomExtent = (
  QUICK_MENU_ICON_SIZE
  + QUICK_MENU_CONTENT_GAP
  + QUICK_MENU_LABEL_FONT_SIZE
) / 2;

assert.ok(
  Math.abs(QUICK_MENU_BUTTON_CENTER_GAP * QUICK_MENU_SCALE - 50) < 0.01,
  'quick action menu visual center spacing should stay compact at the requested 50px',
);

assert.ok(
  (
    QUICK_MENU_BUTTON_CENTER_GAP
    - QUICK_MENU_BUTTON_HEIGHT / 2
    - quickActionMenuLabelBottomExtent
  ) * QUICK_MENU_SCALE >= 1,
  'quick action menu buttons should keep the next capsule from covering the previous label',
);

assert.equal(
  resolvePetQuickActionMenuCenterY(424, { bottom: 595, top: 372 }),
  536,
  'quick action menu should follow the true visual center when a large scaled pet has more lower-body extent',
);

assert.equal(
  resolvePetQuickActionMenuCenterY(598, { bottom: 231, top: 512 }),
  458,
  'quick action menu should move with the visual center instead of using a fixed lift for smaller pets',
);

assert.equal(
  resolvePetQuickActionMenuCenterY(500, { bottom: 320, top: 320 }),
  500,
  'quick action menu center should stay on the anchor when the visual bounds are vertically balanced',
);

const windowManagerSource = readProjectFile('electron/windowManager.cjs');
const postDragInputProxyPreloadSource = readProjectFile('electron/postDragInputProxyPreload.cjs');
const ipcHandlersSource = readProjectFile('electron/ipcHandlers.cjs');
const preloadSource = readProjectFile('electron/preload.cjs');
const electronMainSource = readProjectFile('electron/main.cjs');
const unityRuntimeWindowControllerSource = readProjectFile('scripts/unity-runtime-src/Runtime/UnityRuntimeWindowController.cs');
const unityRuntimeBuilderSource = readProjectFile('scripts/unity-runtime-builder/UnityRuntimeBuilder.cs');
const unityRuntimeProcessServiceSource = readProjectFile('electron/unityRuntimeProcessService.cjs');
const petAvatarLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const petCompanionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
const petContainerShellEffectsSource = readProjectFile('src/components/pet/usePetContainerShellEffects.ts');
const petContainerSource = readProjectFile('src/components/PetContainer.tsx');
const petContainerNativeDragInteropSource = readProjectFile('src/components/pet/usePetContainerNativeDragInterop.ts');
const petContainerNativeDragPreviewSource = readProjectFile('src/components/pet/petContainerNativeDragPreview.ts');
const petContainerNativeShapeSyncStateSource = readProjectFile('src/components/pet/usePetContainerNativeShapeSyncState.ts');
const petContainerPostDragNativeShapeHoldSource = readProjectFile('src/components/pet/usePetContainerPostDragNativeShapeHold.ts');
const petContainerNativeDragInteropWiringSource = [
  petContainerNativeDragInteropSource,
  petContainerSource,
].join('\n');
const petContainerCharacterRuntimeBridgeSource = readProjectFile('src/components/pet/usePetContainerCharacterRuntimeBridge.ts');
const desktopShellBridgeSource = readProjectFile('src/desktopShellBridge.ts');
const desktopShellRuntimeSource = readProjectFile('src/desktopShellRuntime.ts');
const petContainerOrchestratedEffectsSource = readProjectFile('src/components/pet/usePetContainerOrchestratedEffects.ts');
const petNativeShapeMotionStateSource = readProjectFile('src/components/pet/petNativeShapeMotionState.ts');
const petNativeInteractiveRegionDragSyncSource = readProjectFile('src/components/pet/petNativeInteractiveRegionDragSync.ts');
const petActivityRegionSource = readProjectFile('src/components/pet/usePetActivityRegion.ts');
const appSource = readProjectFile('src/App.tsx');
const mainRendererSource = readProjectFile('src/main.tsx');
const indexCssSource = readProjectFile('src/index.css');
const petDragControllerSource = readProjectFile('src/pet-runtime/interactions/petDragController.ts');
const companionPetInteractionControllerSource = readProjectFile('src/pet-runtime/interactions/useCompanionPetInteractionController.ts');
const petEnvironmentLayerSource = readProjectFile('src/components/pet/PetEnvironmentLayer.tsx');
const petFoodCreationControlsSource = readProjectFile('src/components/pet/PetFoodCreationControls.tsx');
const petQuickActionMenuSource = readProjectFile('src/components/pet/PetQuickActionMenu.tsx');
const avatar3DSceneSource = readProjectFile('src/pet-runtime/avatar3d/Avatar3DScene.tsx');

assert.equal(
  windowManagerSource.includes('setIgnoreMouseEvents(nextIgnore, { forward: nextIgnore })'),
  false,
  'main transparent window should use a stable forwarding policy instead of toggling forward per state',
);

assert.equal(
  windowManagerSource.includes('setIgnoreMouseEvents(nextIgnore, { forward: true })'),
  false,
  'main transparent window should use the computed drag forwarding state instead of a hard-coded forwarding call',
);

assert.match(
  windowManagerSource,
  /const hasPetDragPassthrough = isPetDragFullWindowShapeRetained\(\);[\s\S]*const nextForward = hasPetDragPassthrough;[\s\S]*setIgnoreMouseEvents\(nextIgnore,\s*\{\s*forward:\s*nextForward\s*\}\s*\)/,
  'main transparent window should keep forwarding through the post-drag full-window shape lease',
);

assert.match(
  windowManagerSource,
  /keepWindowOnTop\(mainWindow,\s*MAIN_TOPMOST_RELATIVE_LEVEL,\s*\{\s*bringToFront:\s*true\s*\}\s*\)/,
  'main transparent input window should be raised above the native Unity overlay during the topmost guard',
);

assert.match(
  windowManagerSource,
  /scheduleKeepWindowOnTop\(mainWindow,\s*MAIN_TOPMOST_RELATIVE_LEVEL,\s*\{\s*bringToFront:\s*true\s*\}\s*\)/,
  'scheduled topmost refreshes should also raise the main transparent input window above Unity',
);

assert.match(
  windowManagerSource,
  /MAX_INTERACTIVE_WINDOW_SHAPE_REGIONS = 320/,
  'main process native shape cap should fit the 100-slot pet limit plus activity-region controls',
);

assert.match(
  windowManagerSource,
  /mainWindow\.setShape\(interactiveWindowShapeRegions\)/,
  'main transparent input window should apply native shape regions for Unity hit testing',
);

assert.match(
  windowManagerSource,
  /MAIN_INTERACTIVE_LAYER_WARMUP_REGION\s*=\s*\{[\s\S]*height:\s*1,[\s\S]*width:\s*1,[\s\S]*x:\s*0,[\s\S]*y:\s*0,[\s\S]*\}/,
  'optional interactive-layer warmup should use a tiny native shape instead of covering browser video',
);

assert.match(
  windowManagerSource,
  /mainWindow\.setShape\(\[MAIN_INTERACTIVE_LAYER_WARMUP_REGION\]\)/,
  'optional interactive-layer warmup should initialize the shaped transparent input path without a large region',
);

assert.match(
  windowManagerSource,
  /mainWindow\.setIgnoreMouseEvents\(false,\s*\{\s*forward:\s*false\s*\}\)/,
  'optional interactive-layer warmup should prewarm the first non-ignored transparent-window state when explicitly enabled',
);

assert.match(
  windowManagerSource,
  /restoreMainInteractiveLayerWarmup[\s\S]*applyPointerPassthroughState\(\)/,
  'optional interactive-layer warmup should restore the normal pointer passthrough state after prewarming',
);

assert.match(
  windowManagerSource,
  /PREWARM_MAIN_INTERACTIVE_LAYER = process\.env\.DESKTOP_PET_PREWARM_INTERACTIVE_LAYER !== '0'/,
  'startup interactive-layer warmup should run by default like the last known no-white-flash package',
);

assert.match(
  windowManagerSource,
  /function scheduleMainInteractiveLayerWarmup\(\)[\s\S]*\|\| !PREWARM_MAIN_INTERACTIVE_LAYER[\s\S]*return;/,
  'startup interactive-layer warmup should still be disableable with DESKTOP_PET_PREWARM_INTERACTIVE_LAYER=0',
);

assert.match(
  windowManagerSource,
  /MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS = 10_000/,
  'main desktop window should retain a timeout fallback when waiting for renderer/avatar readiness',
);

assert.match(
  windowManagerSource,
  /function markMainWindowReadyToShow[\s\S]*showMainWindowWhenReady\(reason\)/,
  'main process should expose a renderer-ready gate before showing the transparent desktop window',
);

assert.match(
  windowManagerSource,
  /mainWindow\.once\('ready-to-show'[\s\S]*mainWindowCanShow = true;[\s\S]*showMainWindowWhenReady\('ready-to-show'\)/,
  'ready-to-show should unlock Electron readiness without directly showing the transparent window',
);

assert.doesNotMatch(
  windowManagerSource,
  /mainWindow\.once\('ready-to-show'[\s\S]*showMainWindow\(\);[\s\S]*mainWindow\.webContents\.setWindowOpenHandler/,
  'ready-to-show should not bypass the renderer/avatar ready gate',
);

assert.match(
  windowManagerSource,
  /mainWindow\.webContents\.once\('did-finish-load'[\s\S]*mainWindowCanShow = true;[\s\S]*showMainWindowWhenReady\('did-finish-load'\)/,
  'did-finish-load should unlock Electron readiness without directly showing the transparent window',
);

assert.match(
  windowManagerSource,
  /const hasFullWindowShape = isFullWindowInteractiveShape\(interactiveWindowShapeRegions\);[\s\S]*const hasPetDragPassthrough = isPetDragFullWindowShapeRetained\(\);[\s\S]*: hasPetDragPassthrough\s*\?\s*true\s*:/,
  'active pet drag and its full-window shape lease should keep the transparent overlay out of browser video',
);

assert.doesNotMatch(
  windowManagerSource,
  /function hasPointerPassthroughGuardedInteractiveWindowShape\(/,
  'old-package passthrough recovery should remove scoped pointer guard state from the main process',
);

assert.doesNotMatch(
  windowManagerSource,
  /POINTER_PASSTHROUGH_RELEASE_DEBOUNCE_MS/,
  'old-package passthrough recovery should not use the failed hover-release debounce experiment',
);

assert.doesNotMatch(
  windowManagerSource,
  /clearPointerPassthroughReleaseTimer/,
  'window manager dispose should not call removed pointer-passthrough release timer cleanup',
);

assert.match(
  windowManagerSource,
  /PREWARM_MAIN_INTERACTIVE_LAYER = process\.env\.DESKTOP_PET_PREWARM_INTERACTIVE_LAYER !== '0'/,
  'main transparent interactive layer should prewarm by default like the last known no-white-flash package',
);

assert.doesNotMatch(
  windowManagerSource,
  /function schedulePointerPassthroughStateApply\(/,
  'old-package passthrough recovery should apply pointer passthrough immediately like the no-white-flash package',
);

assert.match(
  windowManagerSource,
  /function setWindowPointerPassthrough\(ignore\) \{[\s\S]*requestedPointerPassthrough = Boolean\(ignore\);[\s\S]*applyPointerPassthroughState\(\);[\s\S]*\}/,
  'renderer pointer passthrough requests should use the old-package immediate main-process apply path',
);

assert.doesNotMatch(
  windowManagerSource,
  /normalizeInteractiveRegionPointerPassthroughGuard\(options\)|updatePointerPassthroughGuardState\(/,
  'main process should no longer accept failed scoped pointer guard metadata after old-package recovery',
);

assert.match(
  windowManagerSource,
  /nextInteractiveWindowShapeRegions\.length === 0[\s\S]*!requestedPointerPassthrough[\s\S]*retained interactive shape during active pointer interaction/,
  'main process should not clear native shape to an empty full-window interaction state during active pointer sessions',
);

assert.match(
  windowManagerSource,
  /PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS = 720[\s\S]*petDragFullWindowShapeHoldUntil[\s\S]*discarded deferred interactive shape after pet drag hold; requesting fresh shape[\s\S]*scheduleNativeShapeRefreshAfterPetDragHold\('post-drag-hold-expired'\)/,
  'main process should discard deferred local shape after the pet drag hold and request a fresh DOM shape snapshot',
);

assert.match(
  windowManagerSource,
  /let petDragNativeShapeActive = false[\s\S]*function setPetDragNativeShapeActive\(active\)[\s\S]*ensurePetDragFullWindowInteractiveShape\('active-session-start'\)[\s\S]*ensurePetDragFullWindowInteractiveShape\('active-session-end-hold'\)/,
  'main process should keep an explicit pet-drag native shape session active until renderer drag lifecycle ends',
);

assert.match(
  windowManagerSource,
  /function isPetDragFullWindowShapeRetained\(\)[\s\S]*return petDragNativeShapeActive \|\| Date\.now\(\) < petDragFullWindowShapeHoldUntil/,
  'main process should retain full-window drag shape for active drag sessions, not only a short time lease',
);

assert.match(
  windowManagerSource,
  /retained pet drag full-window shape while deferring/,
  'main process should retain pet-drag full-window shapes briefly so late local shape sync cannot clip Live2D after drag release',
);

assert.match(
  windowManagerSource,
  /ignored stale deferred interactive shape after pet drag hold[\s\S]*scheduleNativeShapeRefreshAfterPetDragHold\('stale-deferred-shape'\)[\s\S]*desktop-pet:refresh-native-interactive-regions/,
  'main process should reject stale post-drag local shapes and ask the renderer for a fresh native region snapshot',
);

assert.match(
  windowManagerSource,
  /setInteractiveRegions\(regions, options = null\)[\s\S]*normalizeInteractiveRegionSource\(options\)[\s\S]*interactiveRegionSource === 'pet-drag' && nextIsFullWindowShape/,
  'main process should only arm the full-window shape hold for renderer-marked pet drag regions',
);

assert.match(
  windowManagerSource,
  /DESKTOP_PET_FORCE_FULL_SHAPE_ON_DRAG/,
  'main process should pass the drag full-window shape diagnostic flag into the renderer query',
);

const fullWindowNativeShapeFunctionStart = petContainerShellEffectsSource.indexOf(
  'export function shouldUseFullWindowNativeShape',
);
const fullWindowNativeShapeFunctionEnd = petContainerShellEffectsSource.indexOf(
  'export function shouldSuspendNativePetShape',
);
assert.ok(
  fullWindowNativeShapeFunctionStart >= 0 && fullWindowNativeShapeFunctionEnd > fullWindowNativeShapeFunctionStart,
  'full-window native shape helper should stay discoverable for activity-region regression checks',
);
const fullWindowNativeShapeFunctionSource = petContainerShellEffectsSource.slice(
  fullWindowNativeShapeFunctionStart,
  fullWindowNativeShapeFunctionEnd,
);
assert.equal(
  fullWindowNativeShapeFunctionSource.includes('hasActivityRegionInteraction'),
  false,
  'activity-region drags should not expand the transparent input window to a full-window native shape',
);

assert.match(
  petContainerShellEffectsSource,
  /forceFullWindowOnPetDrag[\s\S]*hasPetDragInteraction \|\| hasCompanionPetDragInteraction/,
  'full-window native shape should be available only through the explicit drag gate',
);

assert.doesNotMatch(
  petContainerShellEffectsSource,
  /function shouldBlockPointerPassthroughForNativeInteraction\(\{[\s\S]*hasHoveredNonPetInteractiveElement[\s\S]*hasActivityRegionInteraction[\s\S]*hasPointerLock/,
  'renderer should not keep the failed scoped pointer guard helper after old-package recovery',
);

assert.doesNotMatch(
  petContainerShellEffectsSource,
  /pointerPassthroughGuardScope = \([\s\S]*hasActivityRegionShape[\s\S]*hasActivityRegionInteraction\(\)[\s\S]*hoveredNativeInteractiveScope === 'activity-region'[\s\S]*\? 'activity-region'[\s\S]*\? 'other'/,
  'renderer native shape sync should not send the failed scoped pointer guard metadata after old-package recovery',
);

assert.match(
  petContainerShellEffectsSource,
  /hoveredActivityRegionHandle[\s\S]*const hasHoveredPetHitArea = !hoveredActivityRegionHandle && isPetHitAreaElement\(hoveredElement\)/,
  'activity-region rectangle fallback should win over underlying pet hit areas when resolving hover scope',
);

assert.doesNotMatch(
  petContainerShellEffectsSource,
  /blocksPointerPassthrough = shouldBlockPointerPassthroughForNativeInteraction\(\{[\s\S]*hasActivityRegionShape,[\s\S]*hasHoveredNonPetInteractiveElement: hasHoveredNativeInteractiveElement && !hasHoveredNativePetElement[\s\S]*\? \{ blocksPointerPassthrough: true, guardScope: pointerPassthroughGuardScope \}/,
  'renderer native shape sync should not drive the failed main-process pointer guard experiment',
);

assert.match(
  petActivityRegionSource,
  /startActivityRegionDrag[\s\S]*event\.currentTarget\.setPointerCapture\(event\.pointerId\)/,
  'activity-region movement should capture the pointer instead of needing a full-window transparent input shape',
);

assert.match(
  petActivityRegionSource,
  /startActivityRegionResize[\s\S]*event\.currentTarget\.setPointerCapture\(event\.pointerId\)/,
  'activity-region resize should capture the pointer instead of needing a full-window transparent input shape',
);

assert.match(
  electronMainSource,
  /appendSwitch\('disable-gpu-compositing'\)/,
  'Windows transparent overlay compatibility should disable Electron GPU compositing by default',
);

assert.match(
  electronMainSource,
  /appendSwitch\('disable-direct-composition'\)/,
  'Windows transparent overlay compatibility should disable Electron direct composition by default',
);

assert.match(
  petContainerShellEffectsSource,
  /new MutationObserver\(handleNativeInteractiveRegionDirty\)/,
  'native interactive regions should resync when visible or input DOM regions actually change',
);

assert.match(
  petContainerOrchestratedEffectsSource,
  /isPetMotionActive:\s*isNativePetShapeMotionActive/,
  'native shape sync should treat 3D visual actions as motion, not only desktop auto movement',
);

assert.match(
  petNativeShapeMotionStateSource,
  /manualMotionBinding[\s\S]*return true/,
  'custom 3D motions should force the native shape sync into the motion path',
);

assert.match(
  petContainerShellEffectsSource,
  /if \(hasFullWindowNativeShape\(\) && !localPetOnly && !inputProxyOnly\)/,
  'visual native regions should expand to full window only outside the real input-proxy collection',
);

assert.match(
  petContainerShellEffectsSource,
  /inputProxyOnly[\s\S]*data-desktop-pet-interactive[\s\S]*localPetOnly[\s\S]*resolveNativeElementScope\(element\) !== PET_NATIVE_SCOPE[\s\S]*!localPetOnly[\s\S]*!inputProxyOnly[\s\S]*shouldCollectNativeInteractiveElement/,
  'input proxy collection should use real interactive elements instead of visual protection regions',
);

assert.match(
  petContainerShellEffectsSource,
  /source: 'post-drag-input-proxy'/,
  'post-drag input proxy regions should use a dedicated source instead of replacing the main window shape',
);

assert.match(
  windowManagerSource,
  /interactiveRegionSource === 'post-drag-input-proxy'[\s\S]*setPostDragInputProxyRegions\(nextInteractiveWindowShapeRegions\);[\s\S]*return;/,
  'main process should route post-drag proxy regions away from the main BrowserWindow shape',
);

assert.match(
  windowManagerSource,
  /interactiveWindowShapeRegions = nextInteractiveWindowShapeRegions;[\s\S]*if \(interactiveRegionSource === 'pet-drag'\) \{[\s\S]*setPostDragInputProxyRegions\(nextInteractiveWindowShapeRegions\);[\s\S]*\}[\s\S]*applyPointerPassthroughState\(\);[\s\S]*return;/,
  'ordinary visual regions must not replace the real input proxy regions on Windows',
);

assert.match(
  ipcHandlersSource,
  /registerLoggedEvent\(ipcMain, runtimeLogger, 'desktop-pet:post-drag-input-proxy-event'[\s\S]*logArgs: false, logLifecycle: false/,
  'high-frequency proxy pointer IPC must bypass lifecycle logging',
);

assert.match(
  electronMainSource,
  /const dragDiagnosticsEnabled = process\.env\.DESKTOP_PET_DRAG_DIAGNOSTICS === '1'/,
  'drag diagnostics must be opt-in so normal pointer input does not synchronously persist every frame',
);

assert.match(
  windowManagerSource,
  /const dragDiagnosticsEnabled = process\.env\.DESKTOP_PET_DRAG_DIAGNOSTICS === '1'/,
  'window manager drag diagnostics must also be opt-in',
);

assert.match(
  windowManagerSource,
  /postDragInputProxyWindow = new BrowserWindow\([\s\S]*postDragInputProxyPreload\.cjs/,
  'post-drag input proxy should be a separate transparent window',
);

assert.match(
  windowManagerSource,
  /postDragInputProxyWindow = new BrowserWindow\([\s\S]*?opacity: 0\.01,[\s\S]*?inputProxyWindow\.setOpacity\(0\.01\)/,
  'the input-only proxy should use a visually negligible opacity that remains non-zero after Windows 8-bit alpha quantization',
);

assert.match(
  windowManagerSource,
  /function applyPostDragInputProxyRegions\(\)[\s\S]*!mainWindow\.isVisible\(\)[\s\S]*return;[\s\S]*postDragInputProxyWindow\.setShape/,
  'the input proxy must remain hidden until the render window is visible',
);

assert.match(
  windowManagerSource,
  /mainWindow\.on\('show', \(\) => \{[\s\S]*applyPostDragInputProxyRegions\(\);[\s\S]*scheduleWindowStackOnTop\(\)/,
  'showing the render window should activate the already prepared invisible input proxy',
);

assert.match(
  windowManagerSource,
  /USE_SEPARATE_RENDER_AND_INPUT_WINDOWS = process\.platform === 'win32'/,
  'Windows should use separate render and input windows',
);

assert.match(
  windowManagerSource,
  /if \(USE_SEPARATE_RENDER_AND_INPUT_WINDOWS\) \{[\s\S]*const nextIgnore = true;[\s\S]*const nextForward = false;[\s\S]*mainWindow\.setIgnoreMouseEvents\(nextIgnore, \{ forward: nextForward \}\)/,
  'the render window should remain permanently click-through in the separated Windows path',
);

assert.match(
  windowManagerSource,
  /setPostDragInputProxyRegions\(regions\)[\s\S]*const nextRegions = normalizeInteractiveRegions\(regions\);[\s\S]*isFullWindowInteractiveShape\(nextRegions\)[\s\S]*return;/,
  'full-window drag protection signals should never expand the input proxy to the whole screen',
);

assert.match(
  windowManagerSource,
  /POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS = 5_000[\s\S]*schedulePostDragInputProxyIdleDestroy[\s\S]*postDragInputProxyWindow\.destroy\(\)/,
  'post-drag input proxy should release its renderer process after a short idle period',
);

assert.match(
  windowManagerSource,
  /function applyPostDragInputProxyRegions\([\s\S]*postDragInputProxyWindow\.setShape\(postDragInputProxyRegions\)/,
  'post-drag input proxy should use pet-local native shape regions',
);

assert.match(
  windowManagerSource,
  /function setPostDragInputProxyRegions\(regions\)[\s\S]*if \(postDragInputProxyPointerActive \|\| petDragNativeShapeActive\) \{[\s\S]*postDragInputProxyPendingRegions = nextRegions;[\s\S]*return;[\s\S]*postDragInputProxyRegions = nextRegions;[\s\S]*applyPostDragInputProxyRegions\(\)/,
  'captured pointer movement should cache the latest input regions instead of rebuilding the native proxy shape',
);

assert.match(
  windowManagerSource,
  /const nextShapeSignature = createInteractiveRegionsSignature\(postDragInputProxyRegions\);[\s\S]*if \(postDragInputProxyShapeSignature !== nextShapeSignature\) \{[\s\S]*setShape\(postDragInputProxyRegions\);[\s\S]*postDragInputProxyShapeSignature = nextShapeSignature;/,
  'the input proxy should skip native setShape calls when its region signature has not changed',
);

assert.match(
  windowManagerSource,
  /if \(!postDragInputProxyWindow\.isVisible\(\)\) \{[\s\S]*showInactive[\s\S]*keepWindowOnTop/,
  'an already visible input proxy should not be repeatedly shown or raised during region synchronization',
);

assert.match(
  windowManagerSource,
  /if \(type === 'mouseUp'\) \{[\s\S]*postDragInputProxyPointerActive = false;[\s\S]*flushPostDragInputProxyPendingRegions\('pointer-finished'\);[\s\S]*requestPostDragInputProxyRegions\('input-proxy-pointer-finished'\)/,
  'pointer release should flush the last deferred proxy shape and request a final renderer measurement',
);

assert.match(
  windowManagerSource,
  /if \(USE_SEPARATE_RENDER_AND_INPUT_WINDOWS\) \{[\s\S]*petDragNativeShapeActive = nextActive;[\s\S]*if \(nextActive\)[\s\S]*else \{[\s\S]*flushPostDragInputProxyPendingRegions\('drag-session-ended'\);[\s\S]*requestPostDragInputProxyRegions\('input-proxy-drag-ended'\)/,
  'drag end should clear the active guard before flushing the final deferred input regions',
);

assert.match(
  windowManagerSource,
  /forwardPostDragInputProxyEvent[\s\S]*mainWindow\.webContents\.sendInputEvent\(forwardedEvent\)/,
  'post-drag input proxy should forward captured input directly to the main renderer',
);

assert.match(
  windowManagerSource,
  /if \(type === 'mouseWheel'\) \{[\s\S]*forwardedEvent\.deltaX = Number\(inputEvent\.deltaX \|\| 0\);[\s\S]*forwardedEvent\.deltaY = -Number\(inputEvent\.deltaY \|\| 0\);/,
  'post-drag input proxy should normalize Electron mouseWheel deltaY back to DOM wheel semantics',
);

assert.match(
  postDragInputProxyPreloadSource,
  /pointerdown[\s\S]*setPointerCapture[\s\S]*mouseDown[\s\S]*pointermove[\s\S]*mouseMove[\s\S]*pointerup[\s\S]*mouseUp/,
  'post-drag input proxy preload should preserve a complete pointer gesture',
);

assert.match(
  postDragInputProxyPreloadSource,
  /setProxyCursor\('grab'\)[\s\S]*pointerdown[\s\S]*setProxyCursor\('grabbing'\)[\s\S]*finishPointer[\s\S]*setProxyCursor\('grab'\)/,
  'the input proxy should expose grab and grabbing cursors for model interaction',
);

assert.doesNotMatch(
  postDragInputProxyPreloadSource,
  /pointermove[\s\S]*if \(event\.buttons === 0\)[\s\S]*return;/,
  'the separated input proxy must forward hover moves as well as drag moves',
);

assert.match(
  petContainerShellEffectsSource,
  /const isPetNativeShapeSuspended = hasSuspendedNativePetShape\(\);[\s\S]*shouldCollectNativeInteractiveElement\(element, isPetNativeShapeSuspended\)/,
  'native shape collection should keep a single classifier hook instead of mixing visibility and input semantics inline',
);

assert.match(
  petContainerShellEffectsSource,
  /getNativeElementScopePriority[\s\S]*scope === PET_NATIVE_SCOPE[\s\S]*querySelectorAll\(NATIVE_WINDOW_SHAPE_SELECTOR\)\)[\s\S]*\.sort\(\(firstElement, secondElement\)/,
  'native shape collection should prioritize pet regions so activity-region controls cannot push visible pets past the native shape cap',
);

assert.match(
  petContainerShellEffectsSource,
  /BrowserWindow\.setShape clips the visible window[\s\S]*Pet-scoped visible\/protection regions must stay in the native shape[\s\S]*transparent pet hit areas stay out/,
  'native shape code should document that setShape is a visible-window clip, not just hit testing',
);

assert.match(
  petContainerShellEffectsSource,
  /const updatePassthroughFromPoint = \(clientX: number, clientY: number\) => \{[\s\S]*setHoveredNativeInteractiveState\([\s\S]*nextHoverState\.shouldUseHoveredElement[\s\S]*if \(nextHoverState\.shouldStayInteractive\) \{[\s\S]*applyPointerPassthrough\(false\);[\s\S]*schedulePointerPassthroughRelease\(\);[\s\S]*\};/,
  'renderer should keep hover activation immediate but delay releasing transparent-window passthrough to avoid compositor flicker loops',
);

assert.match(
  petContainerShellEffectsSource,
  /handleMouseLeave[\s\S]*schedulePointerPassthroughRelease\(\);/,
  'mouseleave should confirm cursor state before releasing passthrough instead of immediately flipping the transparent window',
);

assert.match(
  petContainerShellEffectsSource,
  /handleWindowBlur[\s\S]*schedulePointerPassthroughRelease\(\);/,
  'window blur should delay passthrough release so hover-induced focus churn cannot flicker the transparent window',
);

assert.match(
  petContainerShellEffectsSource,
  /if \(isInteractiveElement\(target\)\) \{[\s\S]*const isPetHitArea = isPetHitAreaElement\(target\);[\s\S]*if \(!isPetHitArea\) \{[\s\S]*setHoveredNativeInteractiveState\(true, false\);[\s\S]*applyPointerPassthrough\(false\);[\s\S]*\}/,
  'pet pointerdown should not force the whole transparent BrowserWindow into non-passthrough mode before a real drag starts',
);

assert.match(
  petContainerShellEffectsSource,
  /suppressPetHitAreaHoverActivation\s*=\s*true;[\s\S]*pointerInteractionLockRef\.current\s*=\s*false;[\s\S]*updatePassthroughFromPoint\(event\.clientX,\s*event\.clientY\);/,
  'pointerup on the pet body should release the transparent input window instead of keeping browser video covered while the cursor stays still',
);

assert.match(
  petContainerShellEffectsSource,
  /NATIVE_PET_SHAPE_STARTUP_SUPPRESSION_MS = 150_000/,
  'ordinary pet native shape should stay disabled during the startup compositor warmup window',
);

assert.equal(
  petContainerShellEffectsSource.includes("window.removeEventListener('scroll', handleNativeInteractiveRegionDirty, true);\n      desktopPetShellRuntime.setInteractiveRegions([]);"),
  false,
  'native shape should not be cleared during effect refreshes caused by drag or movement state changes',
);

assert.equal(
  petContainerShellEffectsSource.includes('hasEmbeddedPanelOpen() || hasActiveInteraction() || pointerInteractionLockRef.current'),
  false,
  'pet clicks and pointer lock should not directly expand native interactive shape to the full desktop window',
);

assert.match(
  petDragControllerSource,
  /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/,
  'primary pet and folder drags should capture the pointer instead of relying on full-screen native shape',
);

assert.match(
  companionPetInteractionControllerSource,
  /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/,
  'companion pet drags should capture the pointer instead of relying on full-screen native shape',
);

assert.match(
  petContainerShellEffectsSource,
  /NATIVE_INTERACTIVE_REGION_IDLE_RESYNC_MS = 1000/,
  'native interactive regions should keep a low-frequency safety resync instead of constant fast polling',
);

assert.match(
  petContainerShellEffectsSource,
  /const waitMs = resolveNativeInteractiveRegionSyncDelayMs\(/,
  'native region scheduling should use motion-aware delay instead of a fixed idle throttle',
);

assert.match(
  petContainerShellEffectsSource,
  /handlePointerMove[\s\S]*hasLiveNativeInteractiveRegionSync\(\)[\s\S]*scheduleNativeInteractiveRegionsSync\([^)]*\)/,
  'pet and activity-region pointer drags should actively schedule native shape refreshes instead of relying only on MutationObserver timing',
);

assert.match(
  petContainerShellEffectsSource,
  /hasLiveNativeInteractiveRegionSync[\s\S]*hasActivityRegionInteraction:\s*hasActivityRegionInteraction\(\)/,
  'activity-region edit sessions should use the immediate native shape sync path',
);

assert.match(
  petContainerShellEffectsSource,
  /resolveNativeInteractiveRegionSyncDelayMs\(\{[\s\S]*hasActivityRegionInteraction:\s*hasActivityRegionInteraction\(\)/,
  'activity-region edit sessions should bypass the idle native shape throttle',
);

assert.match(
  petContainerShellEffectsSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*nativeInteractiveRegionPostRenderSyncKey[\s\S]*nativeInteractiveRegionPostRenderSyncRef\.current\?\.\(\);/,
  'native shape should also resync after React commits drag transforms so BrowserWindow.setShape follows rendered pixels',
);

assert.match(
  petContainerShellEffectsSource,
  /nativeInteractiveRegionSyncDirtyWhilePending = true;[\s\S]*if \(nativeInteractiveRegionSyncDirtyWhilePending\) \{[\s\S]*scheduleNativeInteractiveRegionsSync\([^)]*\);/,
  'native shape scheduler should remember dirty drag frames that arrive while a previous RAF sync is pending',
);

assert.match(
  petNativeInteractiveRegionDragSyncSource,
  /resolveSweptWindowShapeRect[\s\S]*previousPosition[\s\S]*Math\.min\(previousRect\.left, currentRect\.left\)[\s\S]*Math\.max\(previousRect\.right, currentRect\.right\)/,
  'drag-time native shape prediction should cover the previous and next rendered positions so async shape commits do not clip the pet',
);

assert.match(
  petDragControllerSource,
  /resolveLatestPointerViewportPosition[\s\S]*getCoalescedEvents[\s\S]*onPetDragNativeRegionPreview\?\.\(\{[\s\S]*position: nextPosition,[\s\S]*previousPosition,[\s\S]*\}\);[\s\S]*onPetDragVisualPreview\?\.\(\{[\s\S]*position: nextPosition,[\s\S]*previousPosition,[\s\S]*\}\);[\s\S]*petPosRef\.current = nextPosition/,
  'primary pet dragging should push native shape and imperative visual previews from pointermove before committing React state',
);

assert.equal(
  /onPetDragVisualPreview\?\.\(\{[\s\S]*latestOptions\.setPetPos/.test(petDragControllerSource),
  false,
  'primary pet dragging should not call setPetPos in the high-frequency pointermove preview loop',
);

assert.match(
  petDragControllerSource,
  /pendingPointerViewportPosition[\s\S]*window\.requestAnimationFrame[\s\S]*flushPendingPointerMove\(\)/,
  'primary pet dragging should coalesce high-frequency pointermove updates into animation frames',
);

assert.match(
  petDragControllerSource,
  /finishDrag[\s\S]*flushPendingPointerMove\(\)[\s\S]*updatePetPosition\(petPosRef\.current\)/,
  'primary pet dragging should flush the last pending pointer position before saving the final pet position',
);

assert.match(
  companionPetInteractionControllerSource,
  /resolveLatestPointerViewportPosition[\s\S]*getCoalescedEvents[\s\S]*onCompanionDragNativeRegionPreview\?\.\(\{[\s\S]*position: nextPosition,[\s\S]*previousPosition,[\s\S]*\}\);[\s\S]*setCompanionDragPreview/,
  'companion pet dragging should push a native shape preview from pointermove before waiting for React to commit the transform',
);

assert.match(
  petDragControllerSource,
  /const isStartingNativeShapeSession = !nativeShapeActiveRef\.current;[\s\S]*nativeShapeActiveRef\.current = true;[\s\S]*onPetDragNativeShapeActiveChange\?\.\(true\);[\s\S]*onPetDragNativeRegionPreview/,
  'primary pet drag should arm the native input guard before sending pointer-time region predictions',
);

assert.match(
  companionPetInteractionControllerSource,
  /const isStartingNativeShapeSession = !nativeShapeActiveRef\.current;[\s\S]*nativeShapeActiveRef\.current = true;[\s\S]*onCompanionDragNativeShapeActiveChange\?\.\(true\);[\s\S]*companionDragPreviewRef\.current = nextPreview[\s\S]*onCompanionDragNativeRegionPreview/,
  'companion pet drag should arm the native input guard before sending pointer-time region predictions',
);

assert.match(
  petContainerShellEffectsSource,
  /nativeInteractiveRegionBaseRegionsRef\.current = regions/,
  'shell native shape sync should expose the latest DOM snapshot so drag-time prediction can merge with existing regions',
);

assert.match(
  petContainerNativeShapeSyncStateSource,
  /usePetContainerPostDragNativeShapeHold\(isAnyPetDragActive\)[\s\S]*useFullWindowNativeShapeForPetDrag = isAnyPetDragActive \|\| isPostDragNativeShapeHoldActive/,
  'native shape sync state should keep full-window native shape briefly after a real pet drag so Windows setShape does not clip the final Live2D frame',
);

assert.match(
  petContainerNativeShapeSyncStateSource,
  /nativeShapeDragState = isPetDragActive[\s\S]*\? dragState[\s\S]*: isPostDragNativeShapeHoldActive[\s\S]*\? POST_DRAG_NATIVE_SHAPE_HOLD_STATE[\s\S]*: null[\s\S]*nativeShapeCompanionDragState = isCompanionDragActive \? companionDragState : null/,
  'native shell effects should ignore pointerdown-only preparation but keep a short post-drag hold state for native shape recovery',
);

assert.match(
  petContainerSource,
  /usePetContainerUiSyncEffects\(\{[\s\S]*companionDragState: nativeShapeCompanionDragState[\s\S]*dragState: nativeShapeDragState/,
  'PetContainer should pass the derived native shape drag states into shell sync effects',
);

assert.match(
  petContainerSource,
  /usePetContainerRecoveryEffects\(\{[\s\S]*dragState:\s*nativeShapeDragState/,
  'PetContainer should keep boundary recovery paused during the short post-drag hold so Live2D bounds restore cannot reclamp the pet after release',
);

assert.match(
  petContainerPostDragNativeShapeHoldSource,
  /POST_DRAG_NATIVE_SHAPE_HOLD_MS = 360[\s\S]*const holdDurationMs =[\s\S]*holdUntilRef\.current = now \+ holdDurationMs[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setHoldTick\(\(currentTick\) => currentTick \+ 1\)/,
  'post-drag native shape hold should be synchronously armed on the drag-release render and then time out',
);

assert.match(
  petContainerOrchestratedEffectsSource,
  /useFullWindowNativeShapeForPetDrag[\s\S]*usePetContainerShellEffects\(\{[\s\S]*useFullWindowNativeShapeForPetDrag/,
  'orchestrated shell effects should forward the Unity 3D drag full-window shape gate into the shell hook',
);

assert.match(
  petContainerShellEffectsSource,
  /latestNativeShapeRuntimeStateRef[\s\S]*hasPetDragInteraction[\s\S]*latestNativeShapeRuntimeStateRef\.current\.dragState[\s\S]*hasCompanionPetDragInteraction[\s\S]*latestNativeShapeRuntimeStateRef\.current\.companionDragState[\s\S]*hasForceFullWindowOnPetDrag[\s\S]*latestNativeShapeRuntimeStateRef\.current\.useFullWindowNativeShapeForPetDrag/,
  'shell native shape effect should read live drag state from refs instead of remounting on drag activation',
);

assert.doesNotMatch(
  petContainerShellEffectsSource,
  /\}, \[[\s\S]*companionDragState[\s\S]*dragState[\s\S]*isPetMotionActive[\s\S]*useFullWindowNativeShapeForPetDrag[\s\S]*\]\);[\s\S]*useLayoutEffect/,
  'shell native shape effect should not depend on high-frequency drag/native-shape state that would remount listeners during a drag',
);

assert.match(
  [
    petContainerNativeDragPreviewSource,
    petContainerNativeDragInteropSource,
  ].join('\n'),
  /shouldUseFullWindowShapeForActiveDrag[\s\S]*activeModelType === '2d'[\s\S]*activeModelType === '3d'[\s\S]*activeModelType === 'live2d'[\s\S]*manualForceFullShapeOnDrag[\s\S]*desktopPetShellRuntime\.setInteractiveRegions\(\[fullWindowRegion\],\s*\{ source: 'pet-drag' \}\)/,
  'pet drag preview should use a full-window native shape for 2D, 3D, and Live2D while keeping the manual diagnostic override',
);

assert.match(
  petContainerNativeDragInteropWiringSource,
  /const setPetDragNativeShapeActive = useCallback\(\(active: boolean\) => \{[\s\S]*desktopPetShellRuntime\.setPetDragNativeShapeActive\(active\);[\s\S]*onPetDragNativeShapeActiveChange: setPetDragNativeShapeActive[\s\S]*onCompanionDragNativeShapeActiveChange: setPetDragNativeShapeActive/,
  'PetContainer should wire primary and companion real-drag lifecycle into the main-process native shape session',
);

assert.match(
  petContainerNativeDragInteropSource,
  /mergeNativeDragInteractiveRegions\([\s\S]*setInteractiveRegions\(mergedRegions, \{ source: 'pet-drag' \}\)/,
  'bounded pointer-time drag predictions should identify themselves to the main process',
);

assert.doesNotMatch(
  petContainerNativeDragInteropSource,
  /if \(activeModelType !== '3d'\) \{\s*return;\s*\}/,
  'PetContainer should use bounded pointer-time native shape prediction for 2D, 3D, and Live2D',
);

assert.match(
  petContainerNativeDragPreviewSource,
  /resolveNativeDragFallbackPredictionRegions[\s\S]*resolveNativeDragInteractiveRegions/,
  'PetContainer should keep pointer-time native shape prediction as a fallback after the all-model full-window drag path',
);

assert.match(
  petContainerNativeDragInteropSource,
  /syncActivityRegionNativeShapePreview[\s\S]*previousActivityCenter[\s\S]*resolveActivityRegionNativeShapePreviewRegions[\s\S]*mergeNativeDragInteractiveRegions/,
  'activity-region drag should push swept local native shape previews so BrowserWindow.setShape does not clip pets while the frame moves',
);

assert.match(
  petContainerNativeDragPreviewSource,
  /resolveActivityRegionNativeShapePreviewRegions[\s\S]*resolveNativeDragInteractiveRegions\(\{[\s\S]*previousActivityCenter: preview\.previousActivityCenter/,
  'activity-region drag should push swept local native shape previews so BrowserWindow.setShape does not clip pets while the frame moves',
);

assert.match(
  petActivityRegionSource,
  /onActivityRegionNativeShapePreview\?\.\(\{[\s\S]*previousActivityCenter: previousCenter[\s\S]*activityRegionOffsetPreviewRef\.current = nextOffset/,
  'activity-region movement should send native shape preview before committing the React preview offset',
);

assert.match(
  petActivityRegionSource,
  /onActivityRegionNativeShapePreview\?\.\(\{[\s\S]*activityArea: nextArea,[\s\S]*primaryPosition: previewPetPosition[\s\S]*petPosRef\.current = previewPetPosition/,
  'activity-region resize should include the clamped primary pet position in the native shape preview before React commits',
);

assert.match(
  petContainerNativeDragPreviewSource,
  /const companionNextPosition = preview\.activityArea[\s\S]*clampSceneEntityToActivityArea\(slot\.position, preview\.activityArea, 'pet'[\s\S]*previousPosition: companionCurrentPosition/,
  'activity-region resize should predict companion clamped next-frame positions and sweep from the previous rendered positions',
);

assert.match(
  [
    petContainerNativeDragPreviewSource,
    petContainerNativeDragInteropSource,
  ].join('\n'),
  /activeModelType !== '3d'[\s\S]*avatar3dRuntimeBackend !== 'unity'[\s\S]*resolveUnityDragLayoutPreviewCommand\(\{[\s\S]*position[\s\S]*desktopPetShellRuntime\.sendUnityBridgeCommand\(unityLayoutCommand\)/,
  'PetContainer should push Unity layout from the pointer-time drag preview only for active 3D Unity drags',
);

assert.match(
  desktopShellBridgeSource,
  /HIGH_FREQUENCY_UNITY_BRIDGE_COMMAND_TYPES = new Set\(\['setLayout', 'setSemanticState'\]\)[\s\S]*shouldSkipDuplicateUnityBridgeCommand[\s\S]*window\.desktopPetShell\?\.sendUnityBridgeCommand\?\.\(nextCommand\)/,
  'renderer bridge should dedupe repeated Unity layout and semantic commands so drag preview IPC stays light',
);

assert.match(
  petContainerNativeShapeSyncStateSource,
  /createNativeInteractiveRegionPostRenderSyncKey\(\{[\s\S]*companionSlots: companionRenderSlots\.map[\s\S]*primary:\s*\{[\s\S]*position: petPos/,
  'native shape sync state should build the post-render native sync key from actual primary and companion rendered positions',
);

assert.match(
  petContainerOrchestratedEffectsSource,
  /nativeInteractiveRegionPostRenderSyncKey/,
  'orchestrated shell effects should forward the post-render native region sync key into the desktop shell hook',
);

assert.equal(
  petContainerShellEffectsSource.includes('setInterval(\n        syncNativeInteractiveRegions'),
  false,
  'native interactive regions should not scan all shape elements on a fixed 120ms loop while idle',
);

assert.equal(
  petAvatarLayerSource.includes('data-desktop-pet-window-shape="true"\n              className="pointer-events-none absolute inset-0 flex items-center justify-center"'),
  false,
  'primary pet full square render shell should not be included in native shape because it exposes dark transparent-window blocks',
);

assert.match(
  petCompanionLayerSource,
  /style=\{windowShapeProxyStyle\}/,
  'companion pet should use a visual-bounds shape proxy instead of shaping the full square render shell',
);

assert.equal(
  petCompanionLayerSource.includes('data-desktop-pet-window-shape="true"\n            className="pointer-events-none absolute inset-0 flex items-center justify-center"'),
  false,
  'companion pet full square render shell should not be included in native shape because it exposes dark transparent-window blocks',
);

assert.match(
  petAvatarLayerSource,
  /style=\{windowShapeProxyStyle\}/,
  'primary pet should use a visual-bounds shape proxy so action poses have room without exposing the full render shell',
);

assert.match(
  petAvatarLayerSource,
  /data-desktop-pet-native-scope="pet"[\s\S]*data-desktop-pet-id=\{PRIMARY_DESKTOP_PET_SLOT_ID\}/,
  'primary pet hit area should be scoped separately from activity-region native shape controls',
);

assert.match(
  petCompanionLayerSource,
  /data-desktop-pet-native-scope="pet"[\s\S]*data-desktop-pet-id=\{slot\.id\}/,
  'companion pet hit area should be scoped as pet-native shape',
);

assert.match(
  petEnvironmentLayerSource,
  /data-desktop-pet-native-scope="activity-region"/,
  'activity region controls should be scoped separately from pet-native shape regions',
);

assert.match(
  petEnvironmentLayerSource,
  /left-0 right-0 top-0 h-4 cursor-ns-resize border-t border-\[#2F80ED\]\/70 bg-gradient-to-b from-\[#2F80ED\]\/10 to-transparent/,
  'activity-region edge handles should use the old-package h-4 interactive border',
);

assert.match(
  petEnvironmentLayerSource,
  /left-0 top-0 h-5 w-5 cursor-nwse-resize border-l border-t border-\[#2F80ED\]\/70 bg-gradient-to-br from-\[#2F80ED\]\/10 to-transparent/,
  'activity-region corner handles should use the old-package h-5/w-5 interactive corner',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /data-desktop-pet-window-shape="true"[\s\S]*data-desktop-pet-window-shape-padding="4"[\s\S]*data-desktop-pet-native-scope="activity-region"[\s\S]*ACTIVE \{activityAreaScale\}%/,
  'activity-region ACTIVE scale badge should stay visual-only so hover re-entry does not churn BrowserWindow.setShape for thin decorative chrome',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /data-desktop-pet-window-shape="true"[\s\S]*data-desktop-pet-window-shape-padding="0"[\s\S]*className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-primary\/45"/,
  'activity-region visible border strips should stay visual-only while resize handles carry the native shape',
);

assert.match(
  petEnvironmentLayerSource,
  /ACTIVE \{activityAreaScale\}%/,
  'activity-region scale badge should still render even though it is no longer a native window shape',
);

assert.match(
  petContainerShellEffectsSource,
  /const NATIVE_WINDOW_SHAPE_SELECTOR = '\[data-desktop-pet-interactive="true"\], \[data-desktop-pet-window-shape="true"\]'/,
  'native shape collection should exclude visual-only debug boxes so the large renderer shell cannot block nearby desktop clicks',
);

assert.doesNotMatch(
  petContainerShellEffectsSource,
  /body\.desktop-dom-debug \[data-desktop-pet-debug-box\]/,
  'DOM debug outlines must remain visual-only and must not expand the native BrowserWindow shape',
);

assert.match(
  petContainerShellEffectsSource,
  /scope === PET_NATIVE_SCOPE[\s\S]*element\.getAttribute\('data-desktop-pet-interactive'\) === 'true'[\s\S]*!element\.hasAttribute\('data-desktop-pet-window-shape'\)[\s\S]*return false/,
  'pet transparent hit areas should stay out of native shape so 3D display protection does not block nearby pets',
);

assert.match(
  petAvatarLayerSource,
  /showPetActions[\s\S]*data-desktop-pet-interactive="true"[\s\S]*data-desktop-pet-window-shape="true"[\s\S]*data-desktop-pet-native-scope="pet"/,
  'visible primary pet action controls should opt into native shape without relying on the transparent pet hit area',
);

const activityRegionHandleTags = extractTagsWithAttribute(
  petEnvironmentLayerSource,
  'data-desktop-pet-activity-region-handle="true"',
);
assert.equal(
  activityRegionHandleTags.length,
  8,
  'activity-region should still expose eight resize handles for pointer passthrough polling',
);
activityRegionHandleTags.forEach((tag) => {
  assert.ok(
    tag.includes('data-desktop-pet-interactive="true"'),
    'activity-region resize handles should keep the interactive marker',
  );
  assert.ok(
    tag.includes('data-desktop-pet-native-scope="activity-region"'),
    'activity-region resize handles should be scoped so their native shape guard does not apply to pet hit areas',
  );
});

assert.doesNotMatch(
  petContainerShellEffectsSource,
  /hover-input-patch|resolveNativeHoverInputPatchRegion|resolveNativeHoverInputPatchPoint|hoveredNativeInteractivePoint/,
  'hovering transparent activity handles should not create cursor-local native shape patches because BrowserWindow.setShape can expose white compositor blocks on re-entry',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /data-desktop-pet-activity-region-handle="true"[\s\S]{0,520}data-desktop-pet-window-shape="true"[\s\S]{0,180}className="pointer-events-none absolute[\s\S]{0,160}bg-gradient-to-[a-z]+ from-primary\/10 to-transparent/,
  'activity-region old-package recovery should not use the failed outer-hit-target plus inner-native-shape split',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /data-desktop-pet-window-shape="true"[\s\S]*data-desktop-pet-window-shape-padding="0"[\s\S]*data-desktop-pet-native-scope="activity-region"[\s\S]*className="pointer-events-none absolute left-0 right-0 top-0 h-4 border-t border-\[#2F80ED\]\/70 bg-gradient-to-b from-\[#2F80ED\]\/10 to-transparent"/,
  'activity-region old-package recovery should not use inner visible-fill native shape nodes',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /data-desktop-pet-window-shape="true"[\s\S]*data-desktop-pet-window-shape-padding="0"[\s\S]*data-desktop-pet-native-scope="activity-region"[\s\S]*className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l border-t border-\[#2F80ED\]\/70 bg-gradient-to-br from-\[#2F80ED\]\/10 to-transparent"/,
  'activity-region old-package recovery should not use inner corner native shape nodes',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /className="pointer-events-auto rounded bg-transparent p-3"[\s\S]{0,120}data-desktop-pet-window-shape="true"/,
  'transparent activity-region status control container should not be collected as one large native window shape',
);

assert.doesNotMatch(
  petEnvironmentLayerSource,
  /data-desktop-pet-interactive="true"\s+data-desktop-pet-native-scope="activity-region"\s+className="pointer-events-auto rounded bg-transparent p-3"/,
  'transparent status-control whitespace must not become one large input-proxy hit region',
);

assert.match(
  petEnvironmentLayerSource,
  /className="pointer-events-none rounded bg-transparent p-3"/,
  'the status-control layout container should leave its transparent whitespace pointer-through',
);

assert.match(
  petFoodCreationControlsSource,
  /<Button\s+data-desktop-pet-interactive="true"\s+data-desktop-pet-window-shape="true"[\s\S]{0,760}onClick=\{\(\) => onCreateFood\(\)\}/,
  'the create-food button should retain its own input-proxy hit region',
);

assert.equal(
  (petEnvironmentLayerSource.match(/<Slider\s+data-desktop-pet-interactive="true"\s+data-desktop-pet-window-shape="true"/gu) ?? []).length,
  3,
  'each status slider should retain a compact input-proxy hit region',
);

assert.equal(
  (petEnvironmentLayerSource.match(/<Slider[\s\S]{0,700}className="pointer-events-auto"/gu) ?? []).length,
  3,
  'each status slider should restore DOM pointer handling below the pointer-through parent',
);

assert.match(
  indexCssSource,
  /data-desktop-pet-debug-box\]::after[\s\S]*left:\s*2px;[\s\S]*top:\s*2px;[\s\S]*max-width:\s*min\(220px,\s*calc\(100% - 4px\)\)/,
  'DOM debug labels should render inside their boxes so labels remain visible at activity edges',
);

assert.doesNotMatch(
  indexCssSource,
  /data-desktop-pet-debug-box\]::after[\s\S]*transform:\s*translateY\(-100%\)/,
  'DOM debug labels should not be placed above the box where the scene edge can clip them',
);

assert.equal(
  petAvatarLayerSource.includes('data-desktop-pet-window-shape="true"\n              className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[800px] w-[800px]'),
  false,
  'primary pet vision SVG should not add an 800px native shape rectangle',
);

assert.match(
  appSource,
  /document\.body\.classList\.toggle\('desktop-dom-debug',\s*isDesktopShell && shouldShowDomDebug\)/,
  'desktop DOM debug outlines should remain scoped to the desktop shell and resolved debug state',
);

assert.match(
  appSource,
  /const shouldShowDomDebug = isDesktopShell[\s\S]*panel === ''[\s\S]*explicitDomDebugSetting === '1'/,
  'main desktop window should keep runtime bounds hidden unless domDebug=1 is explicitly requested',
);

assert.match(
  appSource,
  /return \(\) => \{[\s\S]*document\.body\.classList\.remove\('desktop-dom-debug'\);[\s\S]*if \(!isDesktopShell\) \{[\s\S]*document\.body\.classList\.remove\('desktop-shell'\);[\s\S]*\}/,
  'desktop shell cleanup should not remove the transparent shell class if a desktop React subtree unmounts',
);

assert.match(
  mainRendererSource,
  /isTransparentShell = isDesktopShell && \([\s\S]*panelMode === 'settings'[\s\S]*\)/,
  'main desktop pet window should be treated as a transparent shell before React effects run',
);

assert.match(
  mainRendererSource,
  /if \(isTransparentShell[\s\S]*document\.documentElement\.style\.background = 'transparent'[\s\S]*document\.body\.classList\.add\('desktop-shell'\)[\s\S]*document\.body\.style\.background = 'transparent'[\s\S]*rootElement\.style\.background = 'transparent'/,
  'transparent desktop shell should set html, body, and root backgrounds before the main app mounts',
);

assert.match(
  mainRendererSource,
  /if \(isTransparentShell\) \{[\s\S]*background:transparent/,
  'transparent desktop shell loading placeholder should not paint the default app background',
);

assert.match(
  indexCssSource,
  /body\.desktop-shell,[\s\S]*body\.desktop-shell #root,[\s\S]*body\.desktop-shell canvas[\s\S]*background-color:\s*transparent !important/,
  'desktop shell body, root, and canvases should stay transparent even when native shape exposes the full window',
);

assert.equal(
  petEnvironmentLayerSource.includes('VISION_PORTAL_01'),
  false,
  'desktop vision preview debug panel should stay removed because it paints a fixed dark rectangle on the transparent shell',
);

assert.equal(
  petEnvironmentLayerSource.includes('className="absolute h-32 w-48'),
  false,
  'environment layer should not add a fixed 192x128 native shape rectangle near the pet',
);

assert.equal(
  /<motion\.button[\s\S]*initial=\{\{ opacity: 0, x:/.test(petQuickActionMenuSource),
  false,
  'quick action menu buttons should not animate x because Motion would override the layout transform',
);

assert.equal(
  /<motion\.button[\s\S]*animate=\{\{ opacity: 1, x:/.test(petQuickActionMenuSource),
  false,
  'quick action menu buttons should not animate y because Motion would remove translateY(-50%) centering',
);

assert.match(
  avatar3DSceneSource,
  /premultipliedAlpha:\s*false/,
  'Three desktop canvas should avoid premultiplied transparent clear pixels that can show as black rectangles on Windows',
);

assert.match(
  avatar3DSceneSource,
  /gl\.domElement\.style\.background\s*=\s*'transparent'/,
  'Three desktop canvas DOM element should keep an explicit transparent background',
);

assert.match(
  ipcHandlersSource,
  /desktop-pet:set-interactive-regions/,
  'main process should accept renderer-supplied native interactive regions',
);

assert.match(
  ipcHandlersSource,
  /desktop-pet:set-pet-drag-native-shape-active[\s\S]*setPetDragNativeShapeActive\(Boolean\(active\)\)/,
  'main process should accept explicit pet drag native shape lifecycle updates',
);

assert.match(
  preloadSource,
  /setInteractiveRegions:\s*\(regions,\s*options\)[\s\S]*desktop-pet:set-interactive-regions[\s\S]*options && typeof options === 'object'/,
  'preload bridge should expose native interactive region updates and sync options to the renderer',
);

assert.match(
  preloadSource,
  /setPetDragNativeShapeActive:\s*\(active\)[\s\S]*desktop-pet:set-pet-drag-native-shape-active/,
  'preload bridge should expose pet drag native shape lifecycle updates to the renderer',
);

assert.match(
  preloadSource,
  /onRefreshNativeInteractiveRegions:[\s\S]*desktop-pet:refresh-native-interactive-regions/,
  'preload bridge should expose main-process native shape refresh requests to the renderer',
);

assert.doesNotMatch(
  desktopShellBridgeSource,
  /normalizedOptions\?\.guardScope \?\? ''[\s\S]*normalizedOptions\?\.blocksPointerPassthrough \? 'guard' : 'open'[\s\S]*lastInteractiveRegionsSignature === nextSignature[\s\S]*!normalizedOptions\?\.force[\s\S]*return;[\s\S]*setInteractiveRegions\?\.\(normalizedRegions, normalizedOptions\)/,
  'renderer bridge should not require pointer guard metadata for old-package activity-region recovery',
);

assert.doesNotMatch(
  windowManagerSource,
  /ACTIVITY_REGION_POINTER_GUARD_RELEASE_HOLD_MS = 900/,
  'main process should not keep the failed activity-region pointer guard hold experiment',
);

assert.doesNotMatch(
  windowManagerSource,
  /function updatePointerPassthroughGuardState\([\s\S]*previousBlocksPointerPassthrough && previousGuardScope === 'activity-region'[\s\S]*ACTIVITY_REGION_POINTER_GUARD_RELEASE_HOLD_MS[\s\S]*schedulePointerPassthroughGuardReleaseHoldExpiry/,
  'main process should not update scoped pointer guard state after old-package recovery',
);

assert.doesNotMatch(
  windowManagerSource,
  /function resetPointerPassthroughGuardState\(\)[\s\S]*interactiveWindowShapeBlocksPointerPassthrough = false[\s\S]*clearPointerPassthroughGuardReleaseHold/,
  'pet drag full-window sessions should not depend on scoped pointer guard state after old-package recovery',
);

assert.doesNotMatch(
  windowManagerSource,
  /if \(nextIsPetDragFullWindowShape\) \{[\s\S]*resetPointerPassthroughGuardState\(\)/,
  'pet drag full-window shape should not call removed scoped pointer guard reset',
);

assert.match(
  desktopShellBridgeSource,
  /setPetDragNativeShapeActive:\s*\(active: boolean\)[\s\S]*window\.desktopPetShell\?\.setPetDragNativeShapeActive\?\.\(Boolean\(active\)\)/,
  'renderer bridge should forward pet drag native shape lifecycle updates through the safe Electron API',
);

assert.match(
  desktopShellRuntimeSource,
  /setPetDragNativeShapeActive:\s*desktopPetShellBridge\.setPetDragNativeShapeActive/,
  'desktop shell runtime should expose pet drag native shape lifecycle updates to PetContainer',
);

assert.match(
  petContainerShellEffectsSource,
  /onRefreshNativeInteractiveRegions\(\(payload\) => \{[\s\S]*clearScheduledNativeInteractiveRegionSync\(\);[\s\S]*collectNativeInteractiveRegionEntries\([\s\S]*nativeInteractiveRegionBaseRegionsRef\.current = regions[\s\S]*setInteractiveRegions\(regions,\s*\{[\s\S]*force:\s*true,[\s\S]*source:\s*'fresh-shape'/,
  'renderer shell effect should force-send a fresh current DOM native shape when the main process rejects or expires a post-drag shape',
);

assert.match(
  ipcHandlersSource,
  /desktop-pet:mark-main-window-ready-to-show[\s\S]*markMainWindowReadyToShow\('renderer'\)/,
  'renderer should be able to notify the main process when the first avatar frame is ready to show',
);

assert.match(
  preloadSource,
  /markMainWindowReadyToShow[\s\S]*desktop-pet:mark-main-window-ready-to-show/,
  'preload bridge should expose the main-window ready notification',
);

assert.match(
  desktopShellBridgeSource,
  /markMainWindowReadyToShow[\s\S]*window\.desktopPetShell\?\.markMainWindowReadyToShow\?\.\(\)/,
  'renderer bridge should forward the main-window ready notification through the safe Electron API',
);

assert.match(
  desktopShellRuntimeSource,
  /markMainWindowReadyToShow:\s*desktopPetShellBridge\.markMainWindowReadyToShow/,
  'desktop shell runtime should expose the main-window ready notification to PetContainer',
);

assert.match(
  petContainerCharacterRuntimeBridgeSource,
  /mainWindowReadyMarkedRef[\s\S]*desktopPetShellRuntime\.isDesktopMode\(\)[\s\S]*requestAnimationFrame[\s\S]*desktopPetShellRuntime\.markMainWindowReadyToShow\(\)/,
  'PetContainer should show the desktop shell after its first paint without waiting for avatar model loading',
);

assert.match(
  petAvatarLayerSource,
  /data-desktop-pet-interactive=\{isInteractiveDialogueHidden \? undefined : 'true'\}[\s\S]*data-desktop-pet-id=\{PRIMARY_DESKTOP_PET_SLOT_ID\}/,
  'hidden primary pet hit areas should not keep contributing stale native shape regions',
);

assert.equal(
  petAvatarLayerSource.includes('data-desktop-pet-unity-interaction-proxy'),
  false,
  'Unity primary-display proxy should stay removed because it desynchronizes dragging from the rendered model',
);

assert.match(
  unityRuntimeWindowControllerSource,
  /FullScreenMode\.Windowed/,
  'Unity runtime should use a borderless window so it can span the virtual desktop',
);

assert.match(
  unityRuntimeWindowControllerSource,
  /SmCxVirtualScreen/,
  'Unity runtime should resolve the full virtual desktop width for the fixed transparent overlay',
);

assert.equal(
  unityRuntimeWindowControllerSource.includes('ApplyViewportLayout'),
  false,
  'Unity runtime should not resize or move the native window on every layout update',
);

assert.match(
  unityRuntimeWindowControllerSource,
  /left = 0,[\s\S]*right = 0,[\s\S]*top = 0,[\s\S]*bottom = 0/,
  'Unity runtime should avoid the full-client DWM glass path that can turn the desktop white',
);

assert.match(
  unityRuntimeWindowControllerSource,
  /SetLayeredWindowAttributes\(hwnd,\s*TransparentColorKey,\s*255,\s*LwaColorKey\)/,
  'Unity runtime should use a color-keyed transparent window instead of the white-prone alpha-only path',
);

assert.match(
  unityRuntimeWindowControllerSource,
  /IsTransparentHitTestInstalled\(hwnd\)/,
  'Unity runtime should treat a lost transparent hit-test hook as an invalid overlay so it can be reinstalled',
);

assert.equal(
  unityRuntimeWindowControllerSource.includes('LwaAlpha'),
  false,
  'Unity runtime should not use whole-window alpha transparency for the desktop overlay',
);

assert.match(
  unityRuntimeBuilderSource,
  /PlayerSettings\.fullScreenMode = FullScreenMode\.Windowed/,
  'Unity runtime build settings should start in windowed mode for virtual desktop positioning',
);

assert.match(
  unityRuntimeProcessServiceSource,
  /'-screen-fullscreen',\s*'0'/,
  'Electron should launch Unity windowed so the runtime controller can size it to the virtual desktop',
);

console.log('activity region pointer passthrough smoke ok');
