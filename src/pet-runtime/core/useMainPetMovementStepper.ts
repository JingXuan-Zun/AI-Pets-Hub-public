import { useEffect, type MutableRefObject } from 'react';
import { resolvePetMovementDeltaSeconds } from '../../components/pet/petBehaviorMath';
import { subscribeSharedAnimationTick } from '../../components/pet/sharedAnimationTicker';
import { type FolderItem, type PetAction, type PetConfig } from '../../types';
import {
  type MainPetAutoMovePlan,
  measurePetRuntimeDistance,
  pickMainPetAvoidanceTarget,
} from './petMovementController';
import { type PetRuntimePosition } from './petRuntimeTypes';

const MAIN_PET_STEP_INTERVAL_MS = 32;

type UseMainPetMovementStepperOptions = {
  autoMovePlanRef: MutableRefObject<MainPetAutoMovePlan>;
  autoMoveTickUnsubscribeRef: MutableRefObject<(() => void) | null>;
  canEatFoodFromPosition: (position: PetRuntimePosition, foodPosition: PetRuntimePosition) => boolean;
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition;
  clearAutoMove: (nextAction?: PetAction, syncAction?: boolean) => void;
  configRef: MutableRefObject<PetConfig>;
  consecutiveBlockedStepsRef: MutableRefObject<number>;
  eatFolder: (folder: FolderItem, positionOverride?: PetRuntimePosition) => void;
  isAutoMoving: boolean;
  isMovementPaused: boolean;
  isTemporarilyMovementPaused: boolean;
  lastFrameTimeRef: MutableRefObject<number | null>;
  movementPausedRef: MutableRefObject<boolean>;
  petPosRef: MutableRefObject<PetRuntimePosition>;
  resolveFolderTargetPosition: (folderId: string, fallbackPosition: PetRuntimePosition) => PetRuntimePosition;
  resolveUsableRoamTarget: (from: PetRuntimePosition) => PetRuntimePosition;
  syncPetPositionDuringMovement: (position: PetRuntimePosition, timestamp: number) => void;
  syncRenderedPetPositionDuringMovement: (position: PetRuntimePosition, timestamp: number, force?: boolean) => void;
  temporarilyMovementPausedRef: MutableRefObject<boolean>;
  updateMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
  updatePetAction: (action: PetAction) => void;
  updatePetPosition: (position: PetRuntimePosition) => void;
};

export function useMainPetMovementStepper({
  autoMovePlanRef,
  autoMoveTickUnsubscribeRef,
  canEatFoodFromPosition,
  clampPetPosition,
  clearAutoMove,
  configRef,
  consecutiveBlockedStepsRef,
  eatFolder,
  isAutoMoving,
  isMovementPaused,
  isTemporarilyMovementPaused,
  lastFrameTimeRef,
  movementPausedRef,
  petPosRef,
  resolveFolderTargetPosition,
  resolveUsableRoamTarget,
  syncPetPositionDuringMovement,
  syncRenderedPetPositionDuringMovement,
  temporarilyMovementPausedRef,
  updateMotionTarget,
  updatePetAction,
  updatePetPosition,
}: UseMainPetMovementStepperOptions) {
  useEffect(() => {
    if (isMovementPaused || isTemporarilyMovementPaused || !isAutoMoving || !autoMovePlanRef.current) {
      return;
    }

    const stepAutoMove = (timestamp: number) => {
      if (movementPausedRef.current) {
        if (autoMovePlanRef.current) {
          clearAutoMove('IDLE');
        }
        lastFrameTimeRef.current = null;
        return;
      }

      if (temporarilyMovementPausedRef.current) {
        lastFrameTimeRef.current = null;
        return;
      }

      const plan = autoMovePlanRef.current;
      if (!plan) {
        return;
      }

      const deltaSeconds = resolvePetMovementDeltaSeconds(
        lastFrameTimeRef.current,
        timestamp,
        MAIN_PET_STEP_INTERVAL_MS,
      );
      lastFrameTimeRef.current = timestamp;

      const currentConfig = configRef.current;
      const currentPosition = petPosRef.current;
      let target = plan.kind === 'roam' || plan.kind === 'desktop-icon' || plan.kind === 'desktop-mouse'
        ? plan.target
        : null;
      let targetFolder: FolderItem | undefined;

      if (plan.kind === 'food') {
        targetFolder = currentConfig.folders.find((folder) => folder.id === plan.folderId);
        if (!targetFolder) {
          updatePetPosition(currentPosition);
          clearAutoMove('IDLE');
          return;
        }
        target = resolveFolderTargetPosition(plan.folderId, targetFolder.position);
      }

      if (!target) {
        clearAutoMove('IDLE');
        return;
      }

      const movementTarget = clampPetPosition(target);
      if (plan.kind === 'roam' && measurePetRuntimeDistance(currentPosition, movementTarget) < 18) {
        const replacementTarget = resolveUsableRoamTarget(currentPosition);
        if (measurePetRuntimeDistance(currentPosition, replacementTarget) >= 18) {
          autoMovePlanRef.current = { ...plan, target: replacementTarget };
          updateMotionTarget(replacementTarget);
          return;
        }
        clearAutoMove('IDLE');
        return;
      }

      updateMotionTarget(movementTarget);
      const dx = movementTarget.x - currentPosition.x;
      const dy = movementTarget.y - currentPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxStep = plan.speed * deltaSeconds;

      if (distance <= Math.max(6, maxStep)) {
        const finalPosition = { ...movementTarget };
        if (plan.kind === 'food' && targetFolder && !canEatFoodFromPosition(finalPosition, targetFolder.position)) {
          const avoidanceTarget = pickMainPetAvoidanceTarget(currentPosition, movementTarget, clampPetPosition);
          if (avoidanceTarget) {
            autoMovePlanRef.current = {
              kind: 'roam',
              target: avoidanceTarget,
              action: 'WALKING',
              speed: Math.max(96, plan.speed * 0.84),
            };
            updateMotionTarget(avoidanceTarget);
            updatePetAction('WALKING');
            return;
          }
          clearAutoMove('IDLE');
          return;
        }

        syncRenderedPetPositionDuringMovement(finalPosition, timestamp, true);
        if (plan.kind === 'food' && targetFolder) {
          clearAutoMove('IDLE', false);
          eatFolder(targetFolder, finalPosition);
          return;
        }

        updatePetPosition(finalPosition);
        clearAutoMove(plan.kind === 'desktop-icon' || plan.kind === 'desktop-mouse' ? 'HAPPY' : 'IDLE');
        return;
      }

      const nextPosition = clampPetPosition({
        x: currentPosition.x + (dx / distance) * maxStep,
        y: currentPosition.y + (dy / distance) * maxStep,
      });
      const movedDistance = measurePetRuntimeDistance(currentPosition, nextPosition);
      consecutiveBlockedStepsRef.current = movedDistance < 0.5
        ? consecutiveBlockedStepsRef.current + 1
        : 0;

      if (consecutiveBlockedStepsRef.current >= 4 && distance > Math.max(22, maxStep * 1.5)) {
        consecutiveBlockedStepsRef.current = 0;
        if (plan.kind === 'roam') {
          const replacementTarget = resolveUsableRoamTarget(currentPosition);
          if (measurePetRuntimeDistance(currentPosition, replacementTarget) > measurePetRuntimeDistance(currentPosition, movementTarget)) {
            autoMovePlanRef.current = { ...plan, target: replacementTarget };
            updateMotionTarget(replacementTarget);
            return;
          }
        }

        const avoidanceTarget = pickMainPetAvoidanceTarget(currentPosition, movementTarget, clampPetPosition);
        if (avoidanceTarget) {
          autoMovePlanRef.current = {
            kind: 'roam',
            target: avoidanceTarget,
            action: 'WALKING',
            speed: Math.max(96, plan.speed * 0.84),
          };
          updateMotionTarget(avoidanceTarget);
          updatePetAction('WALKING');
          return;
        }

        clearAutoMove('IDLE');
        return;
      }

      syncRenderedPetPositionDuringMovement(nextPosition, timestamp);
      syncPetPositionDuringMovement(nextPosition, timestamp);
    };

    const unsubscribe = subscribeSharedAnimationTick(stepAutoMove);
    autoMoveTickUnsubscribeRef.current = unsubscribe;

    return () => {
      if (autoMoveTickUnsubscribeRef.current === unsubscribe) {
        autoMoveTickUnsubscribeRef.current();
        autoMoveTickUnsubscribeRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [
    autoMovePlanRef,
    autoMoveTickUnsubscribeRef,
    canEatFoodFromPosition,
    clampPetPosition,
    clearAutoMove,
    configRef,
    consecutiveBlockedStepsRef,
    eatFolder,
    isAutoMoving,
    isMovementPaused,
    isTemporarilyMovementPaused,
    lastFrameTimeRef,
    movementPausedRef,
    petPosRef,
    resolveFolderTargetPosition,
    resolveUsableRoamTarget,
    syncPetPositionDuringMovement,
    syncRenderedPetPositionDuringMovement,
    temporarilyMovementPausedRef,
    updateMotionTarget,
    updatePetAction,
    updatePetPosition,
  ]);
}
