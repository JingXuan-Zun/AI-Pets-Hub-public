import { useEffect, useRef, useState } from 'react';

const POST_DRAG_NATIVE_SHAPE_HOLD_MS = 360;

export const POST_DRAG_NATIVE_SHAPE_HOLD_STATE = {
  kind: 'post-pet-drag-native-shape-hold',
};

export function isPostDragNativeShapeHoldProbeDisabled(search = '') {
  return new URLSearchParams(search).get('disablePostDragShapeHold') === '1';
}

export function usePetContainerPostDragNativeShapeHold(isAnyPetDragActive: boolean) {
  const wasPetDragActiveRef = useRef(false);
  const holdUntilRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const [, setHoldTick] = useState(0);

  const now = typeof window === 'undefined'
    ? 0
    : window.performance?.now?.() ?? Date.now();
  const holdDurationMs = typeof window !== 'undefined'
    && isPostDragNativeShapeHoldProbeDisabled(window.location.search)
    ? 0
    : POST_DRAG_NATIVE_SHAPE_HOLD_MS;

  // Compute the hold during render so the drag-release commit never drops back
  // to a local native shape before the full-window hold is active.
  if (isAnyPetDragActive) {
    wasPetDragActiveRef.current = true;
    holdUntilRef.current = 0;
  } else if (wasPetDragActiveRef.current) {
    wasPetDragActiveRef.current = false;
    holdUntilRef.current = now + holdDurationMs;
  }

  const isPostDragNativeShapeHoldActive = !isAnyPetDragActive
    && typeof window !== 'undefined'
    && now < holdUntilRef.current;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!isPostDragNativeShapeHoldActive) {
      return undefined;
    }

    const delayMs = Math.max(
      0,
      Math.ceil(holdUntilRef.current - (window.performance?.now?.() ?? Date.now())),
    );
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setHoldTick((currentTick) => currentTick + 1);
    }, delayMs);

    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [isAnyPetDragActive, isPostDragNativeShapeHoldActive]);

  return isPostDragNativeShapeHoldActive;
}
