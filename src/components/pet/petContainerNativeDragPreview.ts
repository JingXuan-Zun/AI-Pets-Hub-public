import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type PetConfig } from '../../types';
import {
  clampSceneEntityToActivityArea,
  type Area,
  type DirectionalExtents,
} from './petActivityRegionMath';
import { resolveNativeDragInteractiveRegions } from './petNativeInteractiveRegionDragSync';
import { resolveUnityDragLayoutPreviewCommand } from './petUnityDragLayoutPreview';

export type Position = {
  x: number;
  y: number;
};

export type NativeDragCompanionRenderSlot = {
  id: string;
  modelType: PetConfig['modelType'];
  position: Position;
  scale: number;
};

export type NativeDragDiagnosticLogState = {
  lastAt: number;
  signature: string;
};

export type NativeDragRegionMode = 'full-window' | 'predicted-regions' | 'no-regions';

export interface ActivityRegionNativeShapePreview {
  activityArea?: Area;
  activityCenter: Position;
  previousActivityCenter: Position;
  previousPrimaryPosition?: Position;
  primaryPosition?: Position;
}

const DRAG_DIAGNOSTIC_LOG_INTERVAL_MS = 120;

export function isPointerDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('pointerDiagnostics') === '1';
}

export function resolveFullWindowInteractiveRegion(viewport: { height: number; width: number }) {
  return {
    height: Math.max(1, Math.round(viewport.height)),
    width: Math.max(1, Math.round(viewport.width)),
    x: 0,
    y: 0,
  } satisfies DesktopPetInteractiveRegionLike;
}

export function shouldUseFullWindowShapeForActiveDrag(
  activeModelType: PetConfig['modelType'],
  manualForceFullShapeOnDrag: boolean,
) {
  return activeModelType === '2d'
    || activeModelType === '3d'
    || activeModelType === 'live2d'
    || manualForceFullShapeOnDrag;
}

export function resolveActivityRegionNativeShapePreviewRegions({
  companionRenderedPositionById,
  companionVisualBoundsById,
  currentConfig,
  folderBoundaryExtents,
  folderHalfHeight,
  folderHalfWidth,
  getScaledCompanionVisualBounds,
  petPos,
  petVisualBounds,
  preview,
  viewport,
}: {
  companionRenderedPositionById: Record<string, Position>;
  companionVisualBoundsById: Record<string, DirectionalExtents>;
  currentConfig: PetConfig;
  folderBoundaryExtents: DirectionalExtents;
  folderHalfHeight: number;
  folderHalfWidth: number;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => DirectionalExtents;
  petPos: Position;
  petVisualBounds: DirectionalExtents;
  preview: ActivityRegionNativeShapePreview;
  viewport: { height: number; width: number };
}) {
  const companionPets = currentConfig.companionPets
    .filter((slot) => slot.enabled && slot.modelVisible)
    .map((slot) => {
      const visualBounds = companionVisualBoundsById[slot.id] ?? getScaledCompanionVisualBounds(slot.id, slot.scale);
      const companionCurrentPosition = companionRenderedPositionById[slot.id] ?? slot.position;
      const companionNextPosition = preview.activityArea
        ? clampSceneEntityToActivityArea(slot.position, preview.activityArea, 'pet', {
          folderHalfHeight,
          folderHalfWidth,
          folderBoundaryExtents,
          petScale: slot.scale,
          petVisualBounds: visualBounds,
        })
        : companionCurrentPosition;

      return {
        id: slot.id,
        isDragging: true,
        modelType: slot.modelType,
        position: companionNextPosition,
        previousActivityCenter: preview.previousActivityCenter,
        previousPosition: companionCurrentPosition,
        visualBounds,
      };
    });

  return resolveNativeDragInteractiveRegions({
    activityCenter: preview.activityCenter,
    pets: [
      {
        id: PRIMARY_DESKTOP_PET_SLOT_ID,
        isDragging: true,
        modelType: currentConfig.modelType,
        position: preview.primaryPosition ?? petPos,
        previousActivityCenter: preview.previousActivityCenter,
        previousPosition: preview.previousPrimaryPosition ?? petPos,
        visualBounds: petVisualBounds,
      },
      ...companionPets,
    ],
    viewport,
  });
}

export function resolveNativeDragUnityLayoutCommand({
  activeCompanionPet,
  activeModelType,
  activityCenter,
  currentConfig,
  isPrimaryDrag,
  petId,
  position,
  viewport,
}: {
  activeCompanionPet: PetConfig['companionPets'][number] | null;
  activeModelType: PetConfig['modelType'];
  activityCenter: Position;
  currentConfig: PetConfig;
  isPrimaryDrag: boolean;
  petId: string;
  position: Position;
  viewport: { height: number; width: number };
}) {
  if (
    activeModelType !== '3d'
    || currentConfig.settings.avatar3dRuntimeBackend !== 'unity'
  ) {
    return null;
  }

  const activeScale = isPrimaryDrag
    ? currentConfig.scale
    : activeCompanionPet?.scale ?? 1;

  return resolveUnityDragLayoutPreviewCommand({
    activityCenter,
    petId: isPrimaryDrag ? 'main' : petId,
    position,
    scale: activeScale,
    screen: viewport,
  });
}

export function resolveNativeDragFallbackPredictionRegions({
  activityCenter,
  companionRenderSlots,
  companionVisualBoundsById,
  currentConfig,
  dragDelta,
  getScaledCompanionVisualBounds,
  isPrimaryDrag,
  petPos,
  petVisualBounds,
  preview,
  viewport,
}: {
  activityCenter: Position;
  companionRenderSlots: NativeDragCompanionRenderSlot[];
  companionVisualBoundsById: Record<string, DirectionalExtents>;
  currentConfig: PetConfig;
  dragDelta: Position;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => DirectionalExtents;
  isPrimaryDrag: boolean;
  petPos: Position;
  petVisualBounds: DirectionalExtents;
  preview: { petId: string; position: Position; previousPosition: Position };
  viewport: { height: number; width: number };
}) {
  const companionPets = companionRenderSlots.map((slot) => {
    const isDragging = preview.petId === slot.id;
    return {
      dragDelta: isDragging ? dragDelta : null,
      id: slot.id,
      isDragging,
      modelType: slot.modelType,
      position: isDragging ? preview.position : slot.position,
      previousPosition: isDragging ? preview.previousPosition : null,
      visualBounds: companionVisualBoundsById[slot.id] ?? getScaledCompanionVisualBounds(slot.id, slot.scale),
    };
  });

  return resolveNativeDragInteractiveRegions({
    activityCenter,
    pets: [
      {
        dragDelta: isPrimaryDrag ? dragDelta : null,
        id: PRIMARY_DESKTOP_PET_SLOT_ID,
        isDragging: isPrimaryDrag,
        modelType: currentConfig.modelType,
        position: isPrimaryDrag ? preview.position : petPos,
        previousPosition: isPrimaryDrag ? preview.previousPosition : null,
        visualBounds: petVisualBounds,
      },
      ...companionPets,
    ],
    viewport,
  });
}

export function pushNativeDragDiagnosticLog({
  details,
  enabled,
  petId,
  position,
  previousPosition,
  regionMode,
  state,
}: {
  details: Record<string, unknown>;
  enabled: boolean;
  petId: string;
  position: Position;
  previousPosition: Position;
  regionMode: NativeDragRegionMode;
  state: NativeDragDiagnosticLogState;
}) {
  if (!enabled) {
    return;
  }

  const now = window.performance?.now?.() ?? Date.now();
  const signature = [
    regionMode,
    petId,
    Math.round(position.x),
    Math.round(position.y),
    Math.round(previousPosition.x),
    Math.round(previousPosition.y),
  ].join(':');
  if (
    state.signature === signature
    && now - state.lastAt < DRAG_DIAGNOSTIC_LOG_INTERVAL_MS
  ) {
    return;
  }

  state.lastAt = now;
  state.signature = signature;
  pushFrontendRuntimeLog('drag-diagnose', '3d drag native shape preview', details);
}
