import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { type PetConfig } from '../../types';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetDragState } from '../interactions/petDragController';
import { type PetRuntimePosition } from './petRuntimeTypes';

const DEFAULT_RENDER_SYNC_INTERVAL_MS = 16;
const DEFAULT_LIVE_SYNC_INTERVAL_MS = 140;
const DEFAULT_LIVE_SYNC_DISTANCE = 28;

type UsePetRuntimeStoreOptions = {
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition;
  configPosition: PetRuntimePosition;
  configRef: MutableRefObject<PetConfig>;
  dragState: PetDragState;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petPosRef: MutableRefObject<PetRuntimePosition>;
  setPetPos: Dispatch<SetStateAction<PetRuntimePosition>>;
  updatePetPosition: (position: PetRuntimePosition) => void;
};

export function arePetRuntimePositionsEqual(
  left: PetRuntimePosition | null | undefined,
  right: PetRuntimePosition | null | undefined,
) {
  return Boolean(
    left
    && right
    && left.x === right.x
    && left.y === right.y,
  );
}

export function shouldSyncPetRuntimeLivePosition({
  lastSyncedAt,
  lastSyncedPosition,
  nextPosition,
  timestamp,
}: {
  lastSyncedAt: number;
  lastSyncedPosition: PetRuntimePosition | null;
  nextPosition: PetRuntimePosition;
  timestamp: number;
}) {
  const timeSinceLastSync = timestamp - lastSyncedAt;
  if (timeSinceLastSync >= DEFAULT_LIVE_SYNC_INTERVAL_MS) {
    return true;
  }

  if (!lastSyncedPosition) {
    return true;
  }

  const dx = nextPosition.x - lastSyncedPosition.x;
  const dy = nextPosition.y - lastSyncedPosition.y;
  return Math.sqrt(dx * dx + dy * dy) >= DEFAULT_LIVE_SYNC_DISTANCE;
}

export function usePetRuntimeStore({
  clampPetPosition,
  configPosition,
  configRef,
  dragState,
  pendingPetConfigSyncRef,
  petPosRef,
  setPetPos,
  updatePetPosition,
}: UsePetRuntimeStoreOptions) {
  const [isAutoMoving, setIsAutoMoving] = useState(false);
  const [motionTarget, setMotionTarget] = useState<PetRuntimePosition | null>(null);
  const [visionTarget, setVisionTarget] = useState<PetRuntimePosition | null>(null);
  const motionTargetRef = useRef<PetRuntimePosition | null>(null);
  const lastRenderStateSyncAtRef = useRef(0);
  const lastLivePositionSyncAtRef = useRef(0);
  const lastLivePositionSyncPosRef = useRef<PetRuntimePosition | null>(null);
  const lastConfigToRuntimeSyncSignatureRef = useRef<string | null>(null);

  const updateMotionTarget = useCallback((nextTarget: PetRuntimePosition | null) => {
    const currentTarget = motionTargetRef.current;
    const isUnchanged = currentTarget === nextTarget
      || arePetRuntimePositionsEqual(currentTarget, nextTarget);

    if (isUnchanged) {
      return;
    }

    motionTargetRef.current = nextTarget;
    setMotionTarget(nextTarget);
  }, []);

  const resetMovementSyncState = useCallback(() => {
    lastRenderStateSyncAtRef.current = 0;
    lastLivePositionSyncAtRef.current = 0;
    lastLivePositionSyncPosRef.current = null;
  }, []);

  const syncPetPositionDuringMovement = useCallback((
    position: PetRuntimePosition,
    timestamp: number,
  ) => {
    if (!shouldSyncPetRuntimeLivePosition({
      lastSyncedAt: lastLivePositionSyncAtRef.current,
      lastSyncedPosition: lastLivePositionSyncPosRef.current,
      nextPosition: position,
      timestamp,
    })) {
      return;
    }

    lastLivePositionSyncAtRef.current = timestamp;
    lastLivePositionSyncPosRef.current = position;
    configRef.current = {
      ...configRef.current,
      position,
    };
  }, [configRef]);

  const syncRenderedPetPositionDuringMovement = useCallback((
    position: PetRuntimePosition,
    timestamp: number,
    force = false,
  ) => {
    petPosRef.current = position;

    if (!force && (timestamp - lastRenderStateSyncAtRef.current) < DEFAULT_RENDER_SYNC_INTERVAL_MS) {
      return;
    }

    lastRenderStateSyncAtRef.current = timestamp;
    setPetPos(position);
  }, [petPosRef, setPetPos]);

  useEffect(() => {
    if (isAutoMoving || dragState) {
      return;
    }

    const clampedConfigPosition = clampPetPosition(configPosition);
    if (pendingPetConfigSyncRef.current) {
      if (arePetRuntimePositionsEqual(configPosition, petPosRef.current)) {
        pendingPetConfigSyncRef.current = false;
      }
      return;
    }

    const currentRuntimePosition = petPosRef.current;
    const syncSignature = `${currentRuntimePosition.x},${currentRuntimePosition.y}->${clampedConfigPosition.x},${clampedConfigPosition.y}`;
    const deltaX = clampedConfigPosition.x - currentRuntimePosition.x;
    const deltaY = clampedConfigPosition.y - currentRuntimePosition.y;
    if (
      !arePetRuntimePositionsEqual(currentRuntimePosition, clampedConfigPosition)
      && Math.hypot(deltaX, deltaY) >= 48
    ) {
      if (lastConfigToRuntimeSyncSignatureRef.current !== syncSignature) {
        lastConfigToRuntimeSyncSignatureRef.current = syncSignature;
        pushFrontendRuntimeLog('drag-diagnose', 'runtime store applied config position', {
          clampedConfigPosition,
          configPosition,
          currentRuntimePosition,
          deltaX,
          deltaY,
        });
      }
    } else {
      lastConfigToRuntimeSyncSignatureRef.current = null;
    }

    petPosRef.current = clampedConfigPosition;
    setPetPos(clampedConfigPosition);

    if (!arePetRuntimePositionsEqual(clampedConfigPosition, configPosition)) {
      updatePetPosition(clampedConfigPosition);
    }
  }, [
    clampPetPosition,
    configPosition,
    dragState,
    isAutoMoving,
    pendingPetConfigSyncRef,
    petPosRef,
    setPetPos,
    updatePetPosition,
  ]);

  return {
    isAutoMoving,
    motionTarget,
    resetMovementSyncState,
    setIsAutoMoving,
    setVisionTarget,
    syncPetPositionDuringMovement,
    syncRenderedPetPositionDuringMovement,
    updateMotionTarget,
    visionTarget,
  };
}
