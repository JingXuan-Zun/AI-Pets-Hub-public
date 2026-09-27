import { useEffect, useRef, useState, type RefObject } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { subscribeSharedAnimationTick } from '../../components/pet/sharedAnimationTicker';
import { type PetHoverState } from './petHoverController';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';

export type PetPointerLookTarget = {
  x: number;
  y: number;
};

type UsePetPointerLookTargetOptions = {
  enabled?: boolean;
  hoverState: PetHoverState;
  trackingFallbackPaddingPx?: number;
  trackingFallbackElementRef?: RefObject<HTMLElement | null>;
  trackingElementRef?: RefObject<HTMLElement | null>;
  trackingLostHoldMs?: number;
  trackingMovementEpsilon?: number;
  trackingStillReturnMs?: number | null;
};

export const POINTER_LOOK_DEFAULT_FALLBACK_RECT_PADDING_PX = 12;
const POINTER_LOOK_HOLD_MS = 500;
const POINTER_LOOK_TRACKING_LERP = 0.34;
const POINTER_LOOK_RETURN_LERP = 0.16;
const POINTER_LOOK_REST_EPSILON = 0.6;
const POINTER_LOOK_ACTIVE_MOVEMENT_EPSILON = 0.6;
const DESKTOP_CURSOR_POLL_INTERVAL_MS = 48;
const POINTER_LOOK_DIAGNOSTIC_LOG_INTERVAL_MS = 420;

type ClientPoint = {
  x: number;
  y: number;
};

type PointerLookTargetRect = Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>;

export type PointerLookTrackingTimingState = {
  lastActiveAtMs: number | null;
  lastActiveMovedAtMs: number | null;
  lastActiveTarget: PetPointerLookTarget | null;
};

type ResolvePointerLookTimedTargetOptions = {
  activeTarget: PetPointerLookTarget | null;
  holdMs?: number;
  movementEpsilon?: number;
  nowMs: number;
  state: PointerLookTrackingTimingState;
  stillReturnMs?: number | null;
};

type PointerLookTimedTargetPhase = 'active' | 'center' | 'held' | 'still-return';

type PointerLookTimedTargetResult = {
  phase: PointerLookTimedTargetPhase;
  state: PointerLookTrackingTimingState;
  target: PetPointerLookTarget;
};

type DesktopCursorPointSubscriber = (point: DesktopPetCursorPointLike | null) => void;

const desktopCursorSubscribers = new Set<DesktopCursorPointSubscriber>();
let desktopCursorPollIntervalId: number | null = null;
let desktopCursorRequestInFlight = false;

function isPointerLookDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('pointerDiagnostics') === '1';
}

function getWindowScreenOffset() {
  const x = Number.isFinite(window.screenX) ? window.screenX : window.screenLeft;
  const y = Number.isFinite(window.screenY) ? window.screenY : window.screenTop;

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

export function mapDesktopCursorPointToClientPoint(
  point: DesktopPetCursorPointLike | null | undefined,
  windowOffset: ClientPoint,
): ClientPoint | null {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(windowOffset.x)
    || !Number.isFinite(windowOffset.y)
  ) {
    return null;
  }

  return {
    x: Math.round(x - windowOffset.x),
    y: Math.round(y - windowOffset.y),
  };
}

export function resolvePetPointerLookTargetFromClientPoint(
  clientPoint: ClientPoint | null | undefined,
  rect: PointerLookTargetRect | null | undefined,
): PetPointerLookTarget | null {
  if (!clientPoint || !rect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const isInsideRect = clientPoint.x >= rect.left
    && clientPoint.x <= rect.right
    && clientPoint.y >= rect.top
    && clientPoint.y <= rect.bottom;
  if (!isInsideRect) {
    return null;
  }

  return {
    x: Math.round(((clientPoint.x - rect.left) / rect.width - 0.5) * 56),
    y: Math.round(((clientPoint.y - rect.top) / rect.height - 0.5) * 84),
  };
}

function subscribeDesktopCursorPoint(callback: DesktopCursorPointSubscriber) {
  desktopCursorSubscribers.add(callback);

  const loadCursorPoint = () => {
    if (desktopCursorRequestInFlight) {
      return;
    }

    desktopCursorRequestInFlight = true;
    desktopPetShellRuntime.getCursorScreenPoint()
      .then((point) => {
        desktopCursorSubscribers.forEach((subscriber) => {
          subscriber(point);
        });
      })
      .catch(() => {
        desktopCursorSubscribers.forEach((subscriber) => {
          subscriber(null);
        });
      })
      .finally(() => {
        desktopCursorRequestInFlight = false;
      });
  };

  if (desktopCursorPollIntervalId === null) {
    loadCursorPoint();
    desktopCursorPollIntervalId = window.setInterval(
      loadCursorPoint,
      DESKTOP_CURSOR_POLL_INTERVAL_MS,
    );
  }

  return () => {
    desktopCursorSubscribers.delete(callback);
    if (desktopCursorSubscribers.size === 0 && desktopCursorPollIntervalId !== null) {
      window.clearInterval(desktopCursorPollIntervalId);
      desktopCursorPollIntervalId = null;
      desktopCursorRequestInFlight = false;
    }
  };
}

function lerpValue(currentValue: number, targetValue: number, factor: number) {
  return currentValue + (targetValue - currentValue) * factor;
}

export function createPointerLookTrackingTimingState(): PointerLookTrackingTimingState {
  return {
    lastActiveAtMs: null,
    lastActiveMovedAtMs: null,
    lastActiveTarget: null,
  };
}

function sanitizePointerLookDuration(value: number | null | undefined, fallback: number) {
  return Number.isFinite(value) && value !== null && value >= 0
    ? value
    : fallback;
}

function didPointerLookTargetMove(
  previousTarget: PetPointerLookTarget | null,
  nextTarget: PetPointerLookTarget,
  movementEpsilon: number,
) {
  return !previousTarget
    || Math.abs(previousTarget.x - nextTarget.x) >= movementEpsilon
    || Math.abs(previousTarget.y - nextTarget.y) >= movementEpsilon;
}

export function resolvePointerLookTimedTarget({
  activeTarget,
  holdMs = POINTER_LOOK_HOLD_MS,
  movementEpsilon = POINTER_LOOK_ACTIVE_MOVEMENT_EPSILON,
  nowMs,
  state,
  stillReturnMs = null,
}: ResolvePointerLookTimedTargetOptions): PointerLookTimedTargetResult {
  const safeHoldMs = sanitizePointerLookDuration(holdMs, POINTER_LOOK_HOLD_MS);
  const safeMovementEpsilon = Math.max(0, Number.isFinite(movementEpsilon)
    ? movementEpsilon
    : POINTER_LOOK_ACTIVE_MOVEMENT_EPSILON);
  const safeStillReturnMs = stillReturnMs === null
    ? null
    : sanitizePointerLookDuration(stillReturnMs, Number.POSITIVE_INFINITY);
  const centerTarget = { x: 0, y: 0 };

  if (activeTarget) {
    const nextLastActiveMovedAtMs = didPointerLookTargetMove(
      state.lastActiveTarget,
      activeTarget,
      safeMovementEpsilon,
    )
      ? nowMs
      : state.lastActiveMovedAtMs ?? nowMs;
    const nextState = {
      lastActiveAtMs: nowMs,
      lastActiveMovedAtMs: nextLastActiveMovedAtMs,
      lastActiveTarget: activeTarget,
    } satisfies PointerLookTrackingTimingState;
    const isStillExpired = safeStillReturnMs !== null
      && nowMs - nextLastActiveMovedAtMs >= safeStillReturnMs;

    return {
      phase: isStillExpired ? 'still-return' : 'active',
      state: nextState,
      target: isStillExpired ? centerTarget : activeTarget,
    };
  }

  const isHoldActive = state.lastActiveTarget
    && state.lastActiveAtMs !== null
    && nowMs - state.lastActiveAtMs < safeHoldMs;
  const isStillExpired = safeStillReturnMs !== null
    && state.lastActiveMovedAtMs !== null
    && nowMs - state.lastActiveMovedAtMs >= safeStillReturnMs;

  if (isHoldActive && !isStillExpired) {
    return {
      phase: 'held',
      state,
      target: state.lastActiveTarget!,
    };
  }

  return {
    phase: 'center',
    state,
    target: centerTarget,
  };
}

function resolveNextLookTarget(
  currentTarget: PetPointerLookTarget | null,
  target: PetPointerLookTarget,
  lerpFactor: number,
) {
  if (!currentTarget) {
    return target.x === 0 && target.y === 0
      ? null
      : { ...target };
  }

  const nextTarget = {
    x: lerpValue(currentTarget.x, target.x, lerpFactor),
    y: lerpValue(currentTarget.y, target.y, lerpFactor),
  };

  if (
    target.x === 0
    && target.y === 0
    && Math.abs(nextTarget.x) < POINTER_LOOK_REST_EPSILON
    && Math.abs(nextTarget.y) < POINTER_LOOK_REST_EPSILON
  ) {
    return null;
  }

  return nextTarget;
}

function summarizePointerLookPoint(point: ClientPoint | null) {
  return point
    ? { x: Math.round(point.x), y: Math.round(point.y) }
    : null;
}

function summarizePointerLookRect(rect: PointerLookTargetRect | null) {
  return rect
    ? {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      }
    : null;
}

function resolvePaddedPointerLookRect(
  rect: PointerLookTargetRect | null,
  padding: number,
): PointerLookTargetRect | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const safePadding = Math.max(0, Math.round(padding));

  return {
    bottom: rect.bottom + safePadding,
    height: rect.height + safePadding * 2,
    left: rect.left - safePadding,
    right: rect.right + safePadding,
    top: rect.top - safePadding,
    width: rect.width + safePadding * 2,
  };
}

export function usePetPointerLookTarget({
  enabled = true,
  hoverState,
  trackingFallbackPaddingPx = POINTER_LOOK_DEFAULT_FALLBACK_RECT_PADDING_PX,
  trackingFallbackElementRef,
  trackingElementRef,
  trackingLostHoldMs = POINTER_LOOK_HOLD_MS,
  trackingMovementEpsilon = POINTER_LOOK_ACTIVE_MOVEMENT_EPSILON,
  trackingStillReturnMs = null,
}: UsePetPointerLookTargetOptions) {
  const hoverStateRef = useRef(hoverState);
  const enabledRef = useRef(enabled);
  const desktopCursorClientPointRef = useRef<ClientPoint | null>(null);
  const windowPointerClientPointRef = useRef<ClientPoint | null>(null);
  const currentTargetRef = useRef<PetPointerLookTarget | null>(null);
  const diagnosticsRef = useRef({ lastAt: 0, signature: '' });
  const trackingTimingStateRef = useRef(createPointerLookTrackingTimingState());
  const [pointerLookTarget, setPointerLookTarget] = useState<PetPointerLookTarget | null>(null);

  useEffect(() => {
    hoverStateRef.current = hoverState;
  }, [hoverState]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      desktopCursorClientPointRef.current = null;
      windowPointerClientPointRef.current = null;
      currentTargetRef.current = null;
      trackingTimingStateRef.current = createPointerLookTrackingTimingState();
      setPointerLookTarget(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || (!trackingElementRef && !trackingFallbackElementRef)) {
      desktopCursorClientPointRef.current = null;
      return undefined;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      windowPointerClientPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      windowPointerClientPointRef.current = null;
    };
  }, [enabled, trackingElementRef, trackingFallbackElementRef]);

  useEffect(() => {
    if (
      !enabled
      || (!trackingElementRef && !trackingFallbackElementRef)
      || !desktopPetShellRuntime.isDesktopMode()
    ) {
      desktopCursorClientPointRef.current = null;
      return undefined;
    }

    return subscribeDesktopCursorPoint((point) => {
      desktopCursorClientPointRef.current = mapDesktopCursorPointToClientPoint(
        point,
        getWindowScreenOffset(),
      );
    });
  }, [enabled, trackingElementRef, trackingFallbackElementRef]);

  useEffect(() => subscribeSharedAnimationTick((timestamp) => {
    if (!enabledRef.current) {
      return;
    }

    const hoverTarget = hoverStateRef.current.activeRegion
      ? hoverStateRef.current.focusTarget
      : null;
    const trackingElement = trackingElementRef?.current ?? null;
    const trackingFallbackElement = trackingFallbackElementRef?.current ?? null;
    const trackingRect = trackingElement?.getBoundingClientRect() ?? null;
    const rawFallbackTrackingRect = trackingFallbackElement && trackingFallbackElement !== trackingElement
      ? trackingFallbackElement.getBoundingClientRect()
      : null;
    const fallbackTrackingRect = resolvePaddedPointerLookRect(
      rawFallbackTrackingRect,
      trackingFallbackPaddingPx,
    );
    const desktopHitAreaFallbackTarget = hoverTarget
      ? null
      : resolvePetPointerLookTargetFromClientPoint(desktopCursorClientPointRef.current, trackingRect);
    const desktopSurfaceFallbackTarget = hoverTarget || desktopHitAreaFallbackTarget
      ? null
      : resolvePetPointerLookTargetFromClientPoint(desktopCursorClientPointRef.current, fallbackTrackingRect);
    const desktopFallbackTarget = desktopHitAreaFallbackTarget ?? desktopSurfaceFallbackTarget;
    const windowHitAreaFallbackTarget = hoverTarget || desktopFallbackTarget
      ? null
      : resolvePetPointerLookTargetFromClientPoint(windowPointerClientPointRef.current, trackingRect);
    const windowSurfaceFallbackTarget = hoverTarget || desktopFallbackTarget || windowHitAreaFallbackTarget
      ? null
      : resolvePetPointerLookTargetFromClientPoint(windowPointerClientPointRef.current, fallbackTrackingRect);
    const windowFallbackTarget = windowHitAreaFallbackTarget ?? windowSurfaceFallbackTarget;
    const fallbackTarget = desktopFallbackTarget ?? windowFallbackTarget;
    const activeLookTarget = hoverTarget ?? fallbackTarget;
    const activeSource = hoverTarget
      ? 'hover'
      : desktopHitAreaFallbackTarget
        ? 'desktop-hit-area'
        : desktopSurfaceFallbackTarget
          ? 'desktop-surface'
          : windowHitAreaFallbackTarget
            ? 'window-hit-area'
            : windowSurfaceFallbackTarget
              ? 'window-surface'
              : 'none';
    const timedTarget = resolvePointerLookTimedTarget({
      activeTarget: activeLookTarget,
      holdMs: trackingLostHoldMs,
      movementEpsilon: trackingMovementEpsilon,
      nowMs: timestamp,
      state: trackingTimingStateRef.current,
      stillReturnMs: trackingStillReturnMs,
    });
    trackingTimingStateRef.current = timedTarget.state;
    const nextTarget = timedTarget.target;
    const nextLerpFactor = timedTarget.phase === 'active' || timedTarget.phase === 'held'
      ? POINTER_LOOK_TRACKING_LERP
      : POINTER_LOOK_RETURN_LERP;

    const resolvedTarget = resolveNextLookTarget(
      currentTargetRef.current,
      nextTarget ?? { x: 0, y: 0 },
      nextLerpFactor,
    );

    if (isPointerLookDiagnosticsEnabled()) {
      const signature = [
        activeSource,
        timedTarget.phase,
        hoverStateRef.current.activeRegion ?? 'none',
        Math.round(resolvedTarget?.x ?? 0),
        Math.round(resolvedTarget?.y ?? 0),
      ].join(':');
      const shouldLog = diagnosticsRef.current.signature !== signature
        || timestamp - diagnosticsRef.current.lastAt >= POINTER_LOOK_DIAGNOSTIC_LOG_INTERVAL_MS;

      if (shouldLog) {
        diagnosticsRef.current = { lastAt: timestamp, signature };
        pushFrontendRuntimeLog('pointer-look', 'pointer look target resolved', {
          activeSource,
          desktopClientPoint: summarizePointerLookPoint(desktopCursorClientPointRef.current),
          enabled: enabledRef.current,
          hoverRegion: hoverStateRef.current.activeRegion,
          pointerLookPhase: timedTarget.phase,
          resolvedTarget,
          fallbackTrackingRect: summarizePointerLookRect(fallbackTrackingRect),
          trackingRect: summarizePointerLookRect(trackingRect),
          viewport: {
            height: Math.round(window.innerHeight),
            width: Math.round(window.innerWidth),
          },
          windowPointerClientPoint: summarizePointerLookPoint(windowPointerClientPointRef.current),
          windowScreenOffset: {
            x: Math.round(getWindowScreenOffset().x),
            y: Math.round(getWindowScreenOffset().y),
          },
        });
      }
    }

    if (
      currentTargetRef.current?.x === resolvedTarget?.x
      && currentTargetRef.current?.y === resolvedTarget?.y
    ) {
      return;
    }

    currentTargetRef.current = resolvedTarget;
    setPointerLookTarget(resolvedTarget);
  }), []);

  return pointerLookTarget;
}
