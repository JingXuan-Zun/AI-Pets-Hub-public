import { useEffect, type MutableRefObject } from 'react';
import { PRIMARY_DESKTOP_PET_SLOT_ID, applyDesktopPetSlotChanges } from '../../multiPetRoster';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';
import {
  measurePositionDistance,
  positionsMatch,
  preserveEdgeAnchoringAcrossBoundsChange,
} from './petContainerMath';

type Position = { x: number; y: number };

interface UsePetContainerBoundaryRecoveryEffectsOptions {
  activityArea: { width: number; height: number };
  clampPrimaryPetToAllowedAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  clampPetToRenderedActivityAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  clearRecovered3DVisibilitySignature: (petId: string) => void;
  companionDragState: unknown;
  companionVisualBoundsById: Record<string, DirectionalExtents>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  dragState: unknown;
  getScaledCompanionVisualBounds: (
    petId: string,
    currentScale: number,
    nextScale?: number,
  ) => DirectionalExtents;
  isAutoMoving: boolean;
  onUpdateConfig: PetConfigUpdateHandler;
  panelPetId: string;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petPos: Position;
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
  previousCompanionVisualBoundsByIdRef: MutableRefObject<Record<string, DirectionalExtents>>;
  previousPetVisualBoundsRef: MutableRefObject<DirectionalExtents>;
  recover3DPositionIntoVisibleViewport: (
    petId: string,
    petName: string,
    modelType: PetConfig['modelType'],
    modelUrl: string,
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  setPetPos: (position: Position) => void;
  showPetActions: boolean;
}

export function usePetContainerBoundaryRecoveryEffects({
  activityArea,
  clampPrimaryPetToAllowedAreaWithMetrics,
  clampPetToRenderedActivityAreaWithMetrics,
  clearRecovered3DVisibilitySignature,
  companionDragState,
  companionVisualBoundsById,
  config,
  configRef,
  dragState,
  getScaledCompanionVisualBounds,
  isAutoMoving,
  onUpdateConfig,
  panelPetId,
  pendingPetConfigSyncRef,
  petPos,
  petPosRef,
  petVisualBounds,
  previousCompanionVisualBoundsByIdRef,
  previousPetVisualBoundsRef,
  recover3DPositionIntoVisibleViewport,
  setPetPos,
  showPetActions,
}: UsePetContainerBoundaryRecoveryEffectsOptions) {
  useEffect(() => {
    if (pendingPetConfigSyncRef.current || isAutoMoving || dragState || companionDragState) {
      if (dragState) {
        clearRecovered3DVisibilitySignature(PRIMARY_DESKTOP_PET_SLOT_ID);
      }
      if (
        companionDragState
        && typeof companionDragState === 'object'
        && 'petId' in companionDragState
        && typeof companionDragState.petId === 'string'
      ) {
        clearRecovered3DVisibilitySignature(companionDragState.petId);
      }
      previousPetVisualBoundsRef.current = petVisualBounds;
      previousCompanionVisualBoundsByIdRef.current = companionVisualBoundsById;
      return;
    }

    const currentConfig = configRef.current;
    let nextConfig = currentConfig;
    let nextPrimaryPosition = petPosRef.current;
    let hasChanges = false;
    const isPrimaryPanelPositionLocked = showPetActions && panelPetId === PRIMARY_DESKTOP_PET_SLOT_ID;

    if (!isPrimaryPanelPositionLocked) {
      const primaryPositionWithEdgeAnchor = preserveEdgeAnchoringAcrossBoundsChange(
        petPosRef.current,
        activityArea,
        previousPetVisualBoundsRef.current,
        petVisualBounds,
      );
      if (measurePositionDistance(primaryPositionWithEdgeAnchor, petPosRef.current) >= 24) {
        pushFrontendRuntimeLog('drag-diagnose', 'primary boundary recovery edge-anchor shift', {
          activityArea,
          currentPosition: petPosRef.current,
          nextPosition: primaryPositionWithEdgeAnchor,
          previousVisualBounds: previousPetVisualBoundsRef.current,
          visualBounds: petVisualBounds,
        });
      }
      const clampedPrimaryPosition = clampPrimaryPetToAllowedAreaWithMetrics(
        primaryPositionWithEdgeAnchor,
        currentConfig.scale,
        petVisualBounds,
      );
      if (measurePositionDistance(clampedPrimaryPosition, primaryPositionWithEdgeAnchor) >= 24) {
        pushFrontendRuntimeLog('drag-diagnose', 'primary boundary recovery clamp shift', {
          activityArea,
          clampedPrimaryPosition,
          inputPosition: primaryPositionWithEdgeAnchor,
          visualBounds: petVisualBounds,
        });
      }

      if (!positionsMatch(clampedPrimaryPosition, petPosRef.current)) {
        nextPrimaryPosition = clampedPrimaryPosition;
        nextConfig = { ...nextConfig, position: clampedPrimaryPosition };
        hasChanges = true;
      }

      const recoveredPrimaryPosition = recover3DPositionIntoVisibleViewport(
        PRIMARY_DESKTOP_PET_SLOT_ID,
        currentConfig.personality.name,
        currentConfig.modelType,
        currentConfig.modelUrl,
        nextPrimaryPosition,
        currentConfig.scale,
        petVisualBounds,
      );

      if (!positionsMatch(recoveredPrimaryPosition, nextPrimaryPosition)) {
        nextPrimaryPosition = recoveredPrimaryPosition;
        nextConfig = { ...nextConfig, position: recoveredPrimaryPosition };
        hasChanges = true;
      }
    } else if (currentConfig.modelType !== '3d') {
      clearRecovered3DVisibilitySignature(PRIMARY_DESKTOP_PET_SLOT_ID);
    }

    currentConfig.companionPets.forEach((pet) => {
      if (!pet.enabled || !pet.modelVisible) {
        clearRecovered3DVisibilitySignature(pet.id);
        return;
      }
      if (showPetActions && panelPetId === pet.id) {
        return;
      }

      const previousVisualBounds = previousCompanionVisualBoundsByIdRef.current[pet.id]
        ?? getScaledCompanionVisualBounds(pet.id, pet.scale);
      const visualBounds = getScaledCompanionVisualBounds(pet.id, pet.scale);
      const positionWithEdgeAnchor = preserveEdgeAnchoringAcrossBoundsChange(
        pet.position,
        activityArea,
        previousVisualBounds,
        visualBounds,
      );
      let nextCompanionPosition = clampPetToRenderedActivityAreaWithMetrics(
        positionWithEdgeAnchor,
        pet.scale,
        visualBounds,
      );

      if (!positionsMatch(nextCompanionPosition, pet.position)) {
        nextConfig = applyDesktopPetSlotChanges(nextConfig, pet.id, {
          position: nextCompanionPosition,
        });
        hasChanges = true;
      }

      const recoveredCompanionPosition = recover3DPositionIntoVisibleViewport(
        pet.id,
        pet.personality.name,
        pet.modelType,
        pet.modelUrl,
        nextCompanionPosition,
        pet.scale,
        visualBounds,
      );

      if (!positionsMatch(recoveredCompanionPosition, nextCompanionPosition)) {
        nextCompanionPosition = recoveredCompanionPosition;
        nextConfig = applyDesktopPetSlotChanges(nextConfig, pet.id, {
          position: recoveredCompanionPosition,
        });
        hasChanges = true;
      }
    });

    if (!hasChanges) {
      return;
    }
    petPosRef.current = nextPrimaryPosition;
    setPetPos(nextPrimaryPosition);
    configRef.current = nextConfig;
    previousPetVisualBoundsRef.current = petVisualBounds;
    previousCompanionVisualBoundsByIdRef.current = companionVisualBoundsById;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [
    activityArea,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    clearRecovered3DVisibilitySignature,
    companionDragState,
    companionVisualBoundsById,
    config.companionPets,
    config.scale,
    dragState,
    getScaledCompanionVisualBounds,
    isAutoMoving,
    onUpdateConfig,
    panelPetId,
    pendingPetConfigSyncRef,
    petPos.x,
    petPos.y,
    petVisualBounds,
    previousCompanionVisualBoundsByIdRef,
    previousPetVisualBoundsRef,
    recover3DPositionIntoVisibleViewport,
    setPetPos,
    showPetActions,
  ]);
}
