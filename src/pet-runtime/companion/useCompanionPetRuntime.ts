import { useCallback, useEffect, type MutableRefObject } from 'react';
import { applyDesktopPetSlotChanges, getDesktopPetSlot, type DesktopPetSlot } from '../../multiPetRoster';
import { resolvePet2DMotionOverrideState } from '../../components/pet/pet2dMotionOverrideController';
import { applyFoodConsumedStats } from '../../components/pet/petStatsMath';
import { type PetMessageExpressionAction } from '../../components/pet/usePetMessageExpressionAction';
import { type PetContentManifest } from '../content/petContentManifest';
import { type CompanionPetConfig, type PetAction, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type PetRuntimeActivityArea, type PetRuntimePosition, type PetRuntimeRenderState } from '../core/petRuntimeTypes';
import { useCompanionPetMotionController } from './useCompanionPetMotionController';
import { useCompanionPetRenderState } from './useCompanionPetRenderState';

interface UseCompanionPetRuntimeOptions {
  activityArea: PetRuntimeActivityArea;
  addLog?: (message: string) => void;
  clampCompanionPosition: (position: PetRuntimePosition, pet: CompanionPetConfig) => PetRuntimePosition;
  configRef: MutableRefObject<PetConfig>;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => PetRuntimePosition;
  draggingCompanionPetIdRef?: MutableRefObject<string | null>;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  isMovementPaused: boolean;
  manualEatingUntilByPetIdRef?: MutableRefObject<Record<string, number>>;
  onEatScaleBoost?: (slotId: string) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  pauseMovementForInteraction: boolean;
  reactionContentManifest?: PetContentManifest | null;
  reactionExpressionAction?: PetMessageExpressionAction | null;
  satiatedThreshold: number;
  slot: DesktopPetSlot;
}

export function useCompanionPetRuntime({
  activityArea,
  addLog,
  clampCompanionPosition,
  configRef,
  createCompanionRoamTarget,
  draggingCompanionPetIdRef,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  isMovementPaused,
  manualEatingUntilByPetIdRef,
  onEatScaleBoost,
  onUpdateConfig,
  pauseMovementForInteraction,
  reactionContentManifest = null,
  reactionExpressionAction = null,
  satiatedThreshold,
  slot,
}: UseCompanionPetRuntimeOptions): PetRuntimeRenderState<PetAction> {
  const reactionMovementPaused = resolvePet2DMotionOverrideState({
    action: slot.currentAction,
    contentManifest: reactionContentManifest,
    expressionAction: reactionExpressionAction,
    isMoving: false,
  }).pauseMovement;
  const isTemporarilyMovementPaused = reactionMovementPaused || pauseMovementForInteraction;
  const {
    movementPausedRef,
    renderPositionRef,
    renderState,
    setRenderAction,
    setRenderPosition,
    temporarilyMovementPausedRef,
    updateRenderMotionTarget,
  } = useCompanionPetRenderState({
    initialAction: slot.currentAction,
    initialPosition: slot.position,
    isMovementPaused,
    isTemporarilyMovementPaused,
  });
  const liveReactionMovementPaused = resolvePet2DMotionOverrideState({
    action: renderState.action,
    contentManifest: reactionContentManifest,
    expressionAction: reactionExpressionAction,
    isMoving: renderState.motionTarget !== null,
  }).pauseMovement;
  const runtimeMovementPaused = liveReactionMovementPaused || pauseMovementForInteraction;

  useEffect(() => {
    temporarilyMovementPausedRef.current = runtimeMovementPaused;
  }, [runtimeMovementPaused, temporarilyMovementPausedRef]);

  const getLiveCompanionPet = useCallback(() => {
    const currentSlot = getDesktopPetSlot(configRef.current, slot.id);
    if (!currentSlot || currentSlot.isPrimary || !currentSlot.enabled || !currentSlot.modelVisible) {
      return null;
    }

    return configRef.current.companionPets.find((pet) => pet.id === slot.id) ?? null;
  }, [configRef, slot.id]);

  const commitCompanionUpdates = useCallback((updates: Partial<Pick<DesktopPetSlot, 'currentAction' | 'position' | 'stats'>>) => {
    const currentConfig = configRef.current;
    const nextConfig = applyDesktopPetSlotChanges(currentConfig, slot.id, updates);
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [configRef, onUpdateConfig, slot.id]);

  const commitCompanionFoodEat = useCallback((
    pet: CompanionPetConfig,
    position: PetRuntimePosition,
    folderId: string,
    nextAction: PetAction,
  ) => {
    const currentConfig = configRef.current;
    const nextConfig = applyDesktopPetSlotChanges({
      ...currentConfig,
      folders: currentConfig.folders.filter((folder) => folder.id !== folderId),
    }, slot.id, {
      position,
      stats: applyFoodConsumedStats(pet.stats),
      currentAction: nextAction,
    });
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [configRef, onUpdateConfig, slot.id]);

  useCompanionPetMotionController({
    activityArea,
    addLog,
    clampCompanionPosition,
    commitCompanionFoodEat,
    commitCompanionUpdates,
    configRef,
    createCompanionRoamTarget,
    draggingCompanionPetIdRef,
    getLiveCompanionPet,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    isMovementPaused,
    isTemporarilyMovementPaused: runtimeMovementPaused,
    manualEatingUntilByPetIdRef,
    movementPausedRef,
    onEatScaleBoost,
    renderPositionRef,
    satiatedThreshold,
    setRenderAction,
    setRenderPosition,
    slot,
    temporarilyMovementPausedRef,
    updateRenderMotionTarget,
  });

  return renderState;
}
