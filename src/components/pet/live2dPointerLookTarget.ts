import {
  POINTER_LOOK_HEAD_HORIZON_Y,
  resolvePointerLookNormalizedTarget,
} from '../../pet-runtime/interactions/pointerLookTargetNormalization';
import { resolvePetPerformanceLookInput } from '../../pet-runtime/interactions/petPerformanceLookInput';

type Position = {
  x: number;
  y: number;
};

export function didLive2DPointerLookScaleChange(
  previousScale: number,
  currentScale: number,
) {
  return Number.isFinite(previousScale)
    && Number.isFinite(currentScale)
    && Math.abs(currentScale - previousScale) >= 0.001;
}

export function resolveLive2DScaleStablePointerLookTarget({
  currentTarget,
  frozenTarget,
  shouldStabilize,
}: {
  currentTarget: Position | null | undefined;
  frozenTarget: Position | null | undefined;
  shouldStabilize: boolean;
}): Position | null {
  return (shouldStabilize ? frozenTarget : currentTarget) ?? null;
}

export function resolveLive2DDragSettledPointerLookTarget({
  pointerLookTarget,
  shouldSettle,
}: {
  pointerLookTarget: Position | null | undefined;
  shouldSettle: boolean;
}): Position | null {
  return shouldSettle ? null : pointerLookTarget ?? null;
}

export function resolveLive2DDragSettledFocusTarget({
  focusTarget,
  lastDragFocusTarget,
  shouldSettle,
}: {
  focusTarget: Position | null | undefined;
  lastDragFocusTarget: Position | null | undefined;
  shouldSettle: boolean;
}): Position | null {
  return focusTarget ?? (shouldSettle ? lastDragFocusTarget ?? null : null);
}

export type Live2DPointerLookSource = 'center' | 'focus' | 'pointer';

export type Live2DResolvedPointerLookPosition = {
  source: Live2DPointerLookSource;
  x: number;
  y: number;
};

export type Live2DPointerLookTrackerState = {
  inputTarget: Live2DResolvedPointerLookPosition;
  lastPointerMovedAtMs: number | null;
  lastPointerTarget: Live2DResolvedPointerLookPosition | null;
  pointerLostAtMs: number | null;
};

export type Live2DPointerLookTimingOptions = {
  leaveHoldMs?: number;
  movementEpsilon?: number;
  stillReturnMs?: number;
};

export const LIVE2D_POINTER_LOOK_LEAVE_HOLD_MS = 5000;
export const LIVE2D_POINTER_LOOK_STILL_RETURN_MS = 10000;
export const LIVE2D_POINTER_LOOK_MOVEMENT_EPSILON = 0.02;
const LIVE2D_POINTER_LOOK_DOWNWARD_GAIN = 1.75;
const LIVE2D_FOCUS_FALLBACK_HORIZONTAL_SCALE = 0.64;
const LIVE2D_FOCUS_FALLBACK_VERTICAL_SCALE = 0.52;

const LIVE2D_POINTER_LOOK_CENTER_TARGET: Live2DResolvedPointerLookPosition = {
  source: 'center',
  x: 0,
  y: 0,
};

function clampLive2DPointerLookValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, value));
}

function resolveLive2DPointerLookVerticalGain(y: number) {
  return y < 0
    ? clampLive2DPointerLookValue(y * LIVE2D_POINTER_LOOK_DOWNWARD_GAIN)
    : y;
}

function resolveLive2DFocusFallbackTarget(target: Position): Position {
  return {
    x: clampLive2DPointerLookValue(target.x * LIVE2D_FOCUS_FALLBACK_HORIZONTAL_SCALE),
    y: clampLive2DPointerLookValue(target.y * LIVE2D_FOCUS_FALLBACK_VERTICAL_SCALE),
  };
}

function resolveLive2DPointerLookTimingOptions(options: Live2DPointerLookTimingOptions = {}) {
  return {
    leaveHoldMs: options.leaveHoldMs ?? LIVE2D_POINTER_LOOK_LEAVE_HOLD_MS,
    movementEpsilon: options.movementEpsilon ?? LIVE2D_POINTER_LOOK_MOVEMENT_EPSILON,
    stillReturnMs: options.stillReturnMs ?? LIVE2D_POINTER_LOOK_STILL_RETURN_MS,
  };
}

function didLive2DPointerLookTargetMove(
  previousTarget: Live2DResolvedPointerLookPosition | null,
  nextTarget: Live2DResolvedPointerLookPosition,
  movementEpsilon: number,
) {
  return !previousTarget
    || Math.abs(previousTarget.x - nextTarget.x) >= movementEpsilon
    || Math.abs(previousTarget.y - nextTarget.y) >= movementEpsilon;
}

export function createLive2DPointerLookTrackerState(): Live2DPointerLookTrackerState {
  return {
    inputTarget: LIVE2D_POINTER_LOOK_CENTER_TARGET,
    lastPointerMovedAtMs: null,
    lastPointerTarget: null,
    pointerLostAtMs: null,
  };
}

export function resolveLive2DPointerLookFocusPosition(pointerLookTarget: Position | null | undefined) {
  const normalizedTarget = resolvePointerLookNormalizedTarget(pointerLookTarget, {
    neutralY: POINTER_LOOK_HEAD_HORIZON_Y,
    xDivisor: 16,
    yDivisor: 24,
  });

  return normalizedTarget
    ? {
        ...normalizedTarget,
        y: resolveLive2DPointerLookVerticalGain(normalizedTarget.y),
      }
    : null;
}

export function resolveLive2DPointerLookPosition(
  pointerLookTarget: Position | null | undefined,
): Live2DResolvedPointerLookPosition {
  const pointerPosition = resolveLive2DPointerLookFocusPosition(pointerLookTarget);
  if (pointerPosition) {
    return {
      ...pointerPosition,
      source: 'pointer',
    };
  }

  return {
    ...LIVE2D_POINTER_LOOK_CENTER_TARGET,
  };
}

export function resolveLive2DFocusLookPosition(focusTarget: Position | null | undefined) {
  const normalizedTarget = resolvePointerLookNormalizedTarget(focusTarget, {
    xDivisor: 16,
    yDivisor: 24,
  });

  return normalizedTarget
    ? {
        ...resolveLive2DFocusFallbackTarget({
          x: normalizedTarget.x,
          y: resolveLive2DPointerLookVerticalGain(normalizedTarget.y),
        }),
        source: 'focus' as const,
      }
    : null;
}

export function resolveLive2DLookPosition({
  focusTarget,
  pointerLookTarget,
}: {
  focusTarget?: Position | null;
  pointerLookTarget?: Position | null;
}): Live2DResolvedPointerLookPosition {
  const lookInput = resolvePetPerformanceLookInput({
    focusTarget,
    pointerLookTarget,
  });

  if (lookInput.source === 'pointer') {
    return resolveLive2DPointerLookPosition(lookInput.target);
  }

  if (lookInput.source === 'focus') {
    return resolveLive2DFocusLookPosition(lookInput.target) ?? {
      ...LIVE2D_POINTER_LOOK_CENTER_TARGET,
    };
  }

  return {
    ...LIVE2D_POINTER_LOOK_CENTER_TARGET,
  };
}

export function advanceLive2DPointerLookTrackerState(
  currentState: Live2DPointerLookTrackerState,
  inputTarget: Live2DResolvedPointerLookPosition,
  nowMs: number,
  options: Live2DPointerLookTimingOptions = {},
): Live2DPointerLookTrackerState {
  const { movementEpsilon } = resolveLive2DPointerLookTimingOptions(options);

  if (inputTarget.source === 'pointer') {
    return {
      inputTarget,
      lastPointerMovedAtMs: didLive2DPointerLookTargetMove(
        currentState.lastPointerTarget,
        inputTarget,
        movementEpsilon,
      )
        ? nowMs
        : currentState.lastPointerMovedAtMs ?? nowMs,
      lastPointerTarget: inputTarget,
      pointerLostAtMs: null,
    };
  }

  if (inputTarget.source === 'focus') {
    return {
      ...currentState,
      inputTarget,
      pointerLostAtMs: currentState.inputTarget.source === 'pointer'
        ? nowMs
        : currentState.pointerLostAtMs,
    };
  }

  return {
    ...currentState,
    inputTarget: LIVE2D_POINTER_LOOK_CENTER_TARGET,
    pointerLostAtMs: currentState.inputTarget.source === 'pointer'
      ? nowMs
      : currentState.pointerLostAtMs,
  };
}

export function resolveLive2DPointerLookTimedPosition(
  state: Live2DPointerLookTrackerState,
  nowMs: number,
  options: Live2DPointerLookTimingOptions = {},
): Live2DResolvedPointerLookPosition {
  const {
    leaveHoldMs,
    stillReturnMs,
  } = resolveLive2DPointerLookTimingOptions(options);
  const lastMovedAtMs = state.lastPointerMovedAtMs;
  const isStillExpired = lastMovedAtMs !== null && nowMs - lastMovedAtMs >= stillReturnMs;

  if (state.inputTarget.source === 'pointer') {
    return isStillExpired ? LIVE2D_POINTER_LOOK_CENTER_TARGET : state.inputTarget;
  }

  if (
    state.lastPointerTarget
    && state.pointerLostAtMs !== null
    && nowMs - state.pointerLostAtMs < leaveHoldMs
    && !isStillExpired
  ) {
    return state.lastPointerTarget;
  }

  if (state.inputTarget.source === 'focus') {
    return state.inputTarget;
  }

  return LIVE2D_POINTER_LOOK_CENTER_TARGET;
}
