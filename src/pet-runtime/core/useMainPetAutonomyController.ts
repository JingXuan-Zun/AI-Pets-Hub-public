import { useEffect, useRef, type MutableRefObject } from 'react';
import { type FolderItem, type PetAction, type PetConfig } from '../../types';
import { type PetDragState } from '../interactions/petDragController';
import {
  type MainPetAutoMovePlan,
  pickMainPetDesktopIconTarget,
  pickMainPetDesktopMouseTarget,
  resolveMainPetRoamProfile,
} from './petMovementController';
import { type DesktopIconInteractionTarget } from '../../components/pet/desktopIconTargets';
import { type DesktopMouseInteractionTarget } from '../../components/pet/desktopMouseTarget';
import { type PetRuntimePosition } from './petRuntimeTypes';

type StartAutoMove = (
  plan: Exclude<MainPetAutoMovePlan, null>,
  target: PetRuntimePosition,
  logMessage?: string,
) => void;

type UseMainPetAutonomyControllerOptions = {
  autoMovePlanRef: MutableRefObject<MainPetAutoMovePlan>;
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition;
  clearAutoMove: (nextAction?: PetAction, syncAction?: boolean) => void;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  desktopIconTargets: DesktopIconInteractionTarget[];
  desktopMouseTarget: DesktopMouseInteractionTarget | null;
  dragState: PetDragState;
  findNearestFolder: (from: PetRuntimePosition) => FolderItem | null;
  foodDriveActiveRef: MutableRefObject<boolean>;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  isAutoMoving: boolean;
  isMovementPaused: boolean;
  isTemporarilyMovementPaused: boolean;
  petPosRef: MutableRefObject<PetRuntimePosition>;
  resolveFolderTargetPosition: (folderId: string, fallbackPosition: PetRuntimePosition) => PetRuntimePosition;
  resolveUsableRoamTarget: (from: PetRuntimePosition) => PetRuntimePosition;
  satiatedThreshold: number;
  startAutoMove: StartAutoMove;
  updateMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
};

export function useMainPetAutonomyController({
  autoMovePlanRef,
  clampPetPosition,
  clearAutoMove,
  config,
  configRef,
  desktopIconTargets,
  desktopMouseTarget,
  dragState,
  findNearestFolder,
  foodDriveActiveRef,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  isAutoMoving,
  isMovementPaused,
  isTemporarilyMovementPaused,
  petPosRef,
  resolveFolderTargetPosition,
  resolveUsableRoamTarget,
  satiatedThreshold,
  startAutoMove,
  updateMotionTarget,
}: UseMainPetAutonomyControllerOptions) {
  const roamTimerRef = useRef<number | null>(null);
  const desktopMouseTargetRef = useRef<DesktopMouseInteractionTarget | null>(desktopMouseTarget);

  useEffect(() => {
    desktopMouseTargetRef.current = desktopMouseTarget;
  }, [desktopMouseTarget]);

  useEffect(() => {
    if (
      isMovementPaused
      || isTemporarilyMovementPaused
      || !foodDriveActiveRef.current
      || configRef.current.folders.length === 0
      || dragState?.kind === 'pet'
    ) {
      return;
    }

    const currentPosition = petPosRef.current;
    const nearestFolder = findNearestFolder(currentPosition);
    if (!nearestFolder) {
      return;
    }

    const currentPlan = autoMovePlanRef.current;
    const targetPosition = resolveFolderTargetPosition(nearestFolder.id, nearestFolder.position);

    if (
      currentPlan?.kind === 'food'
      && currentPlan.folderId === nearestFolder.id
      && isAutoMoving
    ) {
      updateMotionTarget(targetPosition);
      return;
    }

    startAutoMove(
      {
        kind: 'food',
        folderId: nearestFolder.id,
        action: config.stats.hunger >= 92 ? 'RUNNING' : 'WALKING',
        speed: config.stats.hunger >= 92 ? 210 : 150,
      },
      targetPosition,
      `Primary pet moving toward food: ${nearestFolder.name}`,
    );
  }, [
    autoMovePlanRef,
    config.stats.hunger,
    dragState,
    findNearestFolder,
    foodDriveActiveRef,
    isAutoMoving,
    isMovementPaused,
    isTemporarilyMovementPaused,
    petPosRef,
    resolveFolderTargetPosition,
    startAutoMove,
    updateMotionTarget,
    configRef,
  ]);

  useEffect(() => {
    const hasFood = configRef.current.folders.length > 0;
    const shouldPrioritizeFood = foodDriveActiveRef.current && hasFood;

    if (isMovementPaused || isTemporarilyMovementPaused || shouldPrioritizeFood || isAutoMoving || dragState) {
      return undefined;
    }

    const roamProfile = resolveMainPetRoamProfile(config.stats.hunger, satiatedThreshold, hungerTriggerThreshold);
    const roamDelayMs = Math.max(
      480,
      Math.round((roamProfile.delayMinMs + Math.random() * (roamProfile.delayMaxMs - roamProfile.delayMinMs)) * 0.55),
    );

    roamTimerRef.current = window.setTimeout(() => {
      roamTimerRef.current = null;
      const liveHunger = configRef.current.stats.hunger;
      const liveHasFood = configRef.current.folders.length > 0;
      const shouldResumeFoodDrive = liveHunger >= hungerTriggerThreshold
        || (foodDriveActiveRef.current && liveHunger >= hungerAutoEatStopThreshold);

      if (autoMovePlanRef.current || dragState || (shouldResumeFoodDrive && liveHasFood)) {
        return;
      }

      const desktopMouseMoveTarget = Math.random() < 0.38
        ? pickMainPetDesktopMouseTarget(petPosRef.current, desktopMouseTargetRef.current, clampPetPosition)
        : null;

      if (desktopMouseMoveTarget) {
        startAutoMove(
          {
            kind: 'desktop-mouse',
            target: desktopMouseMoveTarget.target,
            action: desktopMouseMoveTarget.action,
            speed: desktopMouseMoveTarget.speed,
          },
          desktopMouseMoveTarget.target,
          desktopMouseMoveTarget.label,
        );
        return;
      }

      const desktopIconTarget = desktopIconTargets.length && Math.random() < 0.46
        ? pickMainPetDesktopIconTarget(petPosRef.current, desktopIconTargets)
        : null;

      if (desktopIconTarget) {
        startAutoMove(
          {
            kind: 'desktop-icon',
            iconId: desktopIconTarget.id,
            iconName: desktopIconTarget.name,
            target: desktopIconTarget.position,
            action: 'WALKING',
            speed: 108,
          },
          desktopIconTarget.position,
          `Primary pet inspecting desktop icon: ${desktopIconTarget.name}`,
        );
        return;
      }

      const target = resolveUsableRoamTarget(petPosRef.current);
      startAutoMove(
        {
          kind: 'roam',
          target,
          action: roamProfile.action,
          speed: roamProfile.speed,
        },
        target,
        roamProfile.label,
      );
    }, roamDelayMs);

    return () => {
      if (roamTimerRef.current !== null) {
        window.clearTimeout(roamTimerRef.current);
        roamTimerRef.current = null;
      }
    };
  }, [
    autoMovePlanRef,
    clampPetPosition,
    config.stats.hunger,
    desktopIconTargets,
    dragState,
    foodDriveActiveRef,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    isAutoMoving,
    isMovementPaused,
    isTemporarilyMovementPaused,
    petPosRef,
    resolveUsableRoamTarget,
    satiatedThreshold,
    startAutoMove,
    configRef,
  ]);

  useEffect(() => {
    if (
      autoMovePlanRef.current?.kind === 'food'
      && config.stats.hunger < hungerAutoEatStopThreshold
    ) {
      clearAutoMove('IDLE');
    }
  }, [autoMovePlanRef, clearAutoMove, config.stats.hunger, hungerAutoEatStopThreshold]);

  useEffect(() => {
    if (isMovementPaused || isTemporarilyMovementPaused) {
      return undefined;
    }

    const watchdogInterval = window.setInterval(() => {
      const liveHasFood = configRef.current.folders.length > 0;
      const liveHunger = configRef.current.stats.hunger;
      const shouldPrioritizeFood = foodDriveActiveRef.current && liveHasFood;

      if (
        dragState
        || isAutoMoving
        || autoMovePlanRef.current
        || roamTimerRef.current !== null
        || shouldPrioritizeFood
      ) {
        return;
      }

      const roamProfile = resolveMainPetRoamProfile(liveHunger, satiatedThreshold, hungerTriggerThreshold);
      const desktopMouseMoveTarget = Math.random() < 0.34
        ? pickMainPetDesktopMouseTarget(petPosRef.current, desktopMouseTargetRef.current, clampPetPosition)
        : null;

      if (desktopMouseMoveTarget) {
        startAutoMove(
          {
            kind: 'desktop-mouse',
            target: desktopMouseMoveTarget.target,
            action: desktopMouseMoveTarget.action,
            speed: desktopMouseMoveTarget.speed,
          },
          desktopMouseMoveTarget.target,
          desktopMouseMoveTarget.label,
        );
        return;
      }

      const desktopIconTarget = desktopIconTargets.length && Math.random() < 0.36
        ? pickMainPetDesktopIconTarget(petPosRef.current, desktopIconTargets)
        : null;

      if (desktopIconTarget) {
        startAutoMove(
          {
            kind: 'desktop-icon',
            iconId: desktopIconTarget.id,
            iconName: desktopIconTarget.name,
            target: desktopIconTarget.position,
            action: 'WALKING',
            speed: 108,
          },
          desktopIconTarget.position,
          `Primary pet inspecting desktop icon: ${desktopIconTarget.name}`,
        );
        return;
      }

      const target = resolveUsableRoamTarget(petPosRef.current);

      startAutoMove(
        {
          kind: 'roam',
          target,
          action: roamProfile.action,
          speed: roamProfile.speed,
        },
        target,
        'Primary pet watchdog resumed roaming',
      );
    }, 4000);

    return () => {
      window.clearInterval(watchdogInterval);
    };
  }, [
    autoMovePlanRef,
    clampPetPosition,
    desktopIconTargets,
    dragState,
    foodDriveActiveRef,
    hungerTriggerThreshold,
    isAutoMoving,
    isMovementPaused,
    isTemporarilyMovementPaused,
    petPosRef,
    resolveUsableRoamTarget,
    satiatedThreshold,
    startAutoMove,
    configRef,
  ]);
}
