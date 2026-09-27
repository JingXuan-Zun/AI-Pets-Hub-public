import { useEffect, useRef, useState } from 'react';
import { resolveLive2DDragSettledFocusTarget } from './live2dPointerLookTarget';

type Position = {
  x: number;
  y: number;
};

export const LIVE2D_DRAG_LOOK_SETTLE_MS = 900;

function useLive2DDragLookSettleTimer(
  isDragging: boolean,
  shouldSettle: boolean,
  settleUntilRef: { current: number },
) {
  const settleTimerRef = useRef<number | null>(null);
  const [, setSettleTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (isDragging || !shouldSettle) return undefined;

    const now = window.performance?.now?.() ?? Date.now();
    const delayMs = Math.max(0, Math.ceil(settleUntilRef.current - now));
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      setSettleTick((currentTick) => currentTick + 1);
    }, delayMs);

    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [isDragging, settleUntilRef, shouldSettle]);
}

export function useLive2DDragLookSettle(
  isDragging: boolean,
  focusTarget: Position | null,
) {
  const wasDraggingRef = useRef(false);
  const lastDragFocusTargetRef = useRef<Position | null>(null);
  const settleUntilRef = useRef(0);
  const now = typeof window === 'undefined'
    ? 0
    : window.performance?.now?.() ?? Date.now();

  if (isDragging && !wasDraggingRef.current) {
    lastDragFocusTargetRef.current = null;
  }
  if (isDragging) {
    wasDraggingRef.current = true;
    settleUntilRef.current = 0;
    lastDragFocusTargetRef.current = focusTarget ?? lastDragFocusTargetRef.current;
  } else if (wasDraggingRef.current) {
    wasDraggingRef.current = false;
    settleUntilRef.current = now + LIVE2D_DRAG_LOOK_SETTLE_MS;
  }

  const shouldSettle = isDragging || (
    typeof window !== 'undefined'
    && now < settleUntilRef.current
  );
  const settledFocusTarget = resolveLive2DDragSettledFocusTarget({
    focusTarget,
    lastDragFocusTarget: lastDragFocusTargetRef.current,
    shouldSettle,
  });
  useLive2DDragLookSettleTimer(isDragging, shouldSettle, settleUntilRef);

  return { settledFocusTarget, shouldSettle };
}
