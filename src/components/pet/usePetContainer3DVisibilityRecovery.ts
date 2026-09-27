import { useCallback, useRef } from 'react';
import { type PetConfig } from '../../types';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type DirectionalExtents } from './petActivityRegionMath';
import {
  clampPetPositionToViewport,
  isPetPositionVisibleInViewport,
  positionsMatch,
  type ViewportRect,
} from './petContainerMath';

type Position = { x: number; y: number };

type VisibilityRecoverySnapshot = {
  activityDisplayId: string;
  modelType: PetConfig['modelType'];
  modelUrl: string;
  viewport: ViewportRect;
  visualBounds: DirectionalExtents;
};

interface UsePetContainer3DVisibilityRecoveryOptions {
  activityCenter: Position;
  activityDisplayId: string;
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
  visibleDisplayViewport: ViewportRect;
}

export function usePetContainer3DVisibilityRecovery({
  activityCenter,
  activityDisplayId,
  clampPrimaryPetToAllowedAreaWithMetrics,
  clampPetToRenderedActivityAreaWithMetrics,
  visibleDisplayViewport,
}: UsePetContainer3DVisibilityRecoveryOptions) {
  const recovered3DVisibilitySignatureByPetIdRef = useRef<Record<string, string>>({});
  const previous3DVisibilitySnapshotByPetIdRef = useRef<Record<string, VisibilityRecoverySnapshot>>({});

  const clearRecovered3DVisibilitySignature = useCallback((petId: string) => {
    delete recovered3DVisibilitySignatureByPetIdRef.current[petId];
    delete previous3DVisibilitySnapshotByPetIdRef.current[petId];
  }, []);

  const recover3DPositionIntoVisibleViewport = useCallback((
    petId: string,
    petName: string,
    modelType: PetConfig['modelType'],
    modelUrl: string,
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => {
    if (modelType !== '3d' || !modelUrl.trim()) {
      clearRecovered3DVisibilitySignature(petId);
      return position;
    }

    if (visibleDisplayViewport.width < 64 || visibleDisplayViewport.height < 64) {
      return position;
    }

    const visibilitySignature = [
      modelType,
      modelUrl,
      activityDisplayId,
      visibleDisplayViewport.x,
      visibleDisplayViewport.y,
      visibleDisplayViewport.width,
      visibleDisplayViewport.height,
    ].join('|');

    if (recovered3DVisibilitySignatureByPetIdRef.current[petId] === visibilitySignature) {
      return position;
    }

    const previousSnapshot = previous3DVisibilitySnapshotByPetIdRef.current[petId];
    previous3DVisibilitySnapshotByPetIdRef.current[petId] = {
      activityDisplayId,
      modelType,
      modelUrl,
      viewport: visibleDisplayViewport,
      visualBounds,
    };

    recovered3DVisibilitySignatureByPetIdRef.current[petId] = visibilitySignature;

    if (isPetPositionVisibleInViewport(position, activityCenter, visibleDisplayViewport, visualBounds)) {
      return position;
    }

    const viewportRecoveredPosition = clampPetPositionToViewport(
      position,
      activityCenter,
      visibleDisplayViewport,
      visualBounds,
    );
    const clampedRecoveredPosition = petId === PRIMARY_DESKTOP_PET_SLOT_ID
      ? clampPrimaryPetToAllowedAreaWithMetrics(
          viewportRecoveredPosition,
          petScale,
          visualBounds,
        )
      : clampPetToRenderedActivityAreaWithMetrics(
          viewportRecoveredPosition,
          petScale,
          visualBounds,
        );

    if (!positionsMatch(clampedRecoveredPosition, position)) {
      pushFrontendRuntimeLog('model', `3d visibility recovery pet=${petId} name=${petName}`, {
        activityCenter,
        fromPosition: position,
        modelType,
        modelUrl,
        petId,
        petName,
        previousVisualBounds: previousSnapshot?.visualBounds ?? null,
        recoveredPosition: clampedRecoveredPosition,
        scale: petScale,
        viewport: visibleDisplayViewport,
        visualBounds,
      });
    }

    return clampedRecoveredPosition;
  }, [
    activityCenter,
    activityDisplayId,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    clearRecovered3DVisibilitySignature,
    visibleDisplayViewport,
  ]);

  return {
    clearRecovered3DVisibilitySignature,
    recover3DPositionIntoVisibleViewport,
  };
}
