import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type PetConfig } from '../../types';
import { type Area, type DirectionalExtents } from './petActivityRegionMath';
import { mergeNativeDragInteractiveRegions } from './petNativeInteractiveRegionDragSync';
import {
  isPointerDiagnosticsEnabled,
  pushNativeDragDiagnosticLog,
  resolveActivityRegionNativeShapePreviewRegions,
  resolveFullWindowInteractiveRegion,
  resolveNativeDragFallbackPredictionRegions,
  resolveNativeDragUnityLayoutCommand,
  shouldUseFullWindowShapeForActiveDrag,
  type NativeDragCompanionRenderSlot,
  type Position,
} from './petContainerNativeDragPreview';
import { isForceFullShapeOnDragEnabled } from './usePetContainerShellEffects';

interface UsePetContainerNativeDragInteropOptions {
  activityCenterRef: MutableRefObject<Position>;
  companionRenderedPositionByIdRef: MutableRefObject<Record<string, Position>>;
  companionVisualBoundsById: Record<string, DirectionalExtents>;
  configRef: MutableRefObject<PetConfig>;
  folderBoundaryExtents: DirectionalExtents;
  folderHalfHeight: number;
  folderHalfWidth: number;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => DirectionalExtents;
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
}

export function usePetContainerNativeDragInterop({
  activityCenterRef,
  companionRenderedPositionByIdRef,
  companionVisualBoundsById,
  configRef,
  folderBoundaryExtents,
  folderHalfHeight,
  folderHalfWidth,
  getScaledCompanionVisualBounds,
  petPosRef,
  petVisualBounds,
}: UsePetContainerNativeDragInteropOptions) {
  const companionRenderSlotsForNativeDragRef = useRef<NativeDragCompanionRenderSlot[]>([]);
  const companionVisualBoundsByIdRef = useRef<Record<string, DirectionalExtents>>({});
  const dragDiagnosticLogRef = useRef({ lastAt: 0, signature: '' });
  const nativeInteractiveRegionBaseRegionsRef = useRef<DesktopPetInteractiveRegionLike[]>([]);

  companionVisualBoundsByIdRef.current = companionVisualBoundsById;

  const setCompanionRenderSlotsForNativeDrag = useCallback((slots: NativeDragCompanionRenderSlot[]) => {
    companionRenderSlotsForNativeDragRef.current = slots;
  }, []);

  const syncActivityRegionNativeShapePreview = useCallback((preview: {
    activityArea?: Area;
    activityCenter: Position;
    previousActivityCenter: Position;
    previousPrimaryPosition?: Position;
    primaryPosition?: Position;
  }) => {
    if (typeof window === 'undefined' || !desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    const currentConfig = configRef.current;
    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const dragRegions = resolveActivityRegionNativeShapePreviewRegions({
      companionRenderedPositionById: companionRenderedPositionByIdRef.current,
      companionVisualBoundsById: companionVisualBoundsByIdRef.current,
      currentConfig,
      folderBoundaryExtents,
      folderHalfHeight,
      folderHalfWidth,
      getScaledCompanionVisualBounds,
      petPos: petPosRef.current,
      petVisualBounds,
      preview,
      viewport,
    });

    if (dragRegions.length === 0) {
      return;
    }

    desktopPetShellRuntime.setInteractiveRegions(
      mergeNativeDragInteractiveRegions(nativeInteractiveRegionBaseRegionsRef.current, dragRegions),
    );
  }, [
    companionRenderedPositionByIdRef,
    configRef,
    folderBoundaryExtents,
    folderHalfHeight,
    folderHalfWidth,
    getScaledCompanionVisualBounds,
    petPosRef,
    petVisualBounds,
  ]);

  const syncNativeDragInteractiveRegions = useCallback((preview: {
    petId: string;
    position: Position;
    previousPosition: Position;
  }) => {
    if (typeof window === 'undefined' || !desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    const currentConfig = configRef.current;
    const isPrimaryDrag = preview.petId === PRIMARY_DESKTOP_PET_SLOT_ID;
    const activeCompanionPet = isPrimaryDrag
      ? null
      : currentConfig.companionPets.find((slot) => slot.id === preview.petId) ?? null;
    const activeModelType = isPrimaryDrag
      ? currentConfig.modelType
      : activeCompanionPet?.modelType;

    if (!activeModelType) {
      return;
    }

    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const activityCenter = activityCenterRef.current;
    const manualForceFullShapeOnDrag = isForceFullShapeOnDragEnabled();
    const useFullWindowShapeForActiveDrag = shouldUseFullWindowShapeForActiveDrag(
      activeModelType,
      manualForceFullShapeOnDrag,
    );
    const pointerDiagnosticsEnabled = isPointerDiagnosticsEnabled();
    const unityLayoutCommand = resolveNativeDragUnityLayoutCommand({
      activeCompanionPet,
      activeModelType,
      activityCenter,
      currentConfig,
      isPrimaryDrag,
      petId: preview.petId,
      position: preview.position,
      viewport,
    });

    if (unityLayoutCommand) {
      void desktopPetShellRuntime.sendUnityBridgeCommand(unityLayoutCommand);
    }

    const dragDelta = {
      x: preview.position.x - preview.previousPosition.x,
      y: preview.position.y - preview.previousPosition.y,
    };

    if (useFullWindowShapeForActiveDrag) {
      const fullWindowRegion = resolveFullWindowInteractiveRegion(viewport);
      desktopPetShellRuntime.setInteractiveRegions([fullWindowRegion], { source: 'pet-drag' });
      pushNativeDragDiagnosticLog({
        enabled: pointerDiagnosticsEnabled,
        petId: preview.petId,
        position: preview.position,
        previousPosition: preview.previousPosition,
        regionMode: 'full-window',
        state: dragDiagnosticLogRef.current,
        details: {
          activeModelType,
          backend: currentConfig.settings.avatar3dRuntimeBackend,
          dragDelta,
          fullWindowShapeForDrag: useFullWindowShapeForActiveDrag,
          isPrimaryDrag,
          manualForceFullShapeOnDrag,
          petId: preview.petId,
          position: preview.position,
          previousPosition: preview.previousPosition,
          region: fullWindowRegion,
          unityLayout: unityLayoutCommand,
          viewport,
        },
      });
      return;
    }

    const dragRegions = resolveNativeDragFallbackPredictionRegions({
      activityCenter,
      companionRenderSlots: companionRenderSlotsForNativeDragRef.current,
      companionVisualBoundsById: companionVisualBoundsByIdRef.current,
      currentConfig,
      dragDelta,
      getScaledCompanionVisualBounds,
      isPrimaryDrag,
      petPos: petPosRef.current,
      petVisualBounds,
      preview,
      viewport,
    });

    if (dragRegions.length === 0) {
      pushNativeDragDiagnosticLog({
        enabled: pointerDiagnosticsEnabled,
        petId: preview.petId,
        position: preview.position,
        previousPosition: preview.previousPosition,
        regionMode: 'no-regions',
        state: dragDiagnosticLogRef.current,
        details: {
          activeModelType,
          backend: currentConfig.settings.avatar3dRuntimeBackend,
          dragDelta,
          fullWindowShapeForDrag: useFullWindowShapeForActiveDrag,
          isPrimaryDrag,
          manualForceFullShapeOnDrag,
          petId: preview.petId,
          position: preview.position,
          previousPosition: preview.previousPosition,
          unityLayout: unityLayoutCommand,
          viewport,
        },
      });
      return;
    }

    const mergedRegions = mergeNativeDragInteractiveRegions(
      nativeInteractiveRegionBaseRegionsRef.current,
      dragRegions,
    );
    desktopPetShellRuntime.setInteractiveRegions(mergedRegions, { source: 'pet-drag' });
    pushNativeDragDiagnosticLog({
      enabled: pointerDiagnosticsEnabled,
      petId: preview.petId,
      position: preview.position,
      previousPosition: preview.previousPosition,
      regionMode: 'predicted-regions',
      state: dragDiagnosticLogRef.current,
      details: {
        activeModelType,
        backend: currentConfig.settings.avatar3dRuntimeBackend,
        baseRegionCount: nativeInteractiveRegionBaseRegionsRef.current.length,
        dragDelta,
        dragRegionCount: dragRegions.length,
        firstDragRegion: dragRegions[0] ?? null,
        firstMergedRegion: mergedRegions[0] ?? null,
        fullWindowShapeForDrag: useFullWindowShapeForActiveDrag,
        isPrimaryDrag,
        manualForceFullShapeOnDrag,
        mergedRegionCount: mergedRegions.length,
        petId: preview.petId,
        position: preview.position,
        previousPosition: preview.previousPosition,
        unityLayout: unityLayoutCommand,
        viewport,
      },
    });
  }, [
    activityCenterRef,
    configRef,
    getScaledCompanionVisualBounds,
    petPosRef,
    petVisualBounds,
  ]);

  const syncPrimaryNativeDragInteractiveRegions = useCallback((preview: {
    position: Position;
    previousPosition: Position;
  }) => {
    syncNativeDragInteractiveRegions({
      ...preview,
      petId: PRIMARY_DESKTOP_PET_SLOT_ID,
    });
  }, [syncNativeDragInteractiveRegions]);

  const setPetDragNativeShapeActive = useCallback((active: boolean) => {
    if (typeof window === 'undefined' || !desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    desktopPetShellRuntime.setPetDragNativeShapeActive(active);
  }, []);

  useEffect(() => (
    () => {
      setPetDragNativeShapeActive(false);
    }
  ), [setPetDragNativeShapeActive]);

  return {
    nativeInteractiveRegionBaseRegionsRef,
    setCompanionRenderSlotsForNativeDrag,
    setPetDragNativeShapeActive,
    syncActivityRegionNativeShapePreview,
    syncNativeDragInteractiveRegions,
    syncPrimaryNativeDragInteractiveRegions,
  };
}
