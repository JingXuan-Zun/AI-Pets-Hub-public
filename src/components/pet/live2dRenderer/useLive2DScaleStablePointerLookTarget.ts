import { useEffect, useRef, useState } from 'react';
import {
  didLive2DPointerLookScaleChange,
  resolveLive2DScaleStablePointerLookTarget,
} from '../live2dPointerLookTarget';

type Position = {
  x: number;
  y: number;
};

const LIVE2D_SCALE_LOOK_SETTLE_MS = 320;

export function useLive2DScaleStablePointerLookTarget(
  scale: number,
  pointerLookTarget: Position | null,
) {
  const previousScaleRef = useRef(scale);
  const frozenTargetRef = useRef<Position | null>(pointerLookTarget);
  const lastResolvedTargetRef = useRef<Position | null>(pointerLookTarget);
  const settleUntilRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const [, setSettleTick] = useState(0);
  const now = typeof window === 'undefined'
    ? 0
    : window.performance?.now?.() ?? Date.now();

  if (didLive2DPointerLookScaleChange(previousScaleRef.current, scale)) {
    previousScaleRef.current = scale;
    frozenTargetRef.current = lastResolvedTargetRef.current
      ? { ...lastResolvedTargetRef.current }
      : null;
    settleUntilRef.current = now + LIVE2D_SCALE_LOOK_SETTLE_MS;
  }

  const shouldStabilize = typeof window !== 'undefined'
    && now < settleUntilRef.current;
  const stabilizedTarget = resolveLive2DScaleStablePointerLookTarget({
    currentTarget: pointerLookTarget,
    frozenTarget: frozenTargetRef.current,
    shouldStabilize,
  });

  if (!shouldStabilize) {
    lastResolvedTargetRef.current = stabilizedTarget;
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (!shouldStabilize) {
      return undefined;
    }

    const delayMs = Math.max(
      0,
      Math.ceil(settleUntilRef.current - (window.performance?.now?.() ?? Date.now())),
    );
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
  }, [scale, shouldStabilize]);

  return {
    shouldStabilize,
    stabilizedTarget,
  };
}
