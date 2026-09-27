type Position = {
  x: number;
  y: number;
};

const MIN_HORIZONTAL_FACING_DELTA = 0.25;

export function resolveRelativeFocusTarget(
  motionTarget: Position | null,
  currentPosition: Position,
) {
  if (!motionTarget) {
    return null;
  }

  return {
    x: motionTarget.x - currentPosition.x,
    y: motionTarget.y - currentPosition.y,
  } satisfies Position;
}

export function resolveVisualFacingTarget(
  movementFocusTarget: Position | null,
  motionFocusTarget: Position | null,
) {
  if (movementFocusTarget && Math.abs(movementFocusTarget.x) >= MIN_HORIZONTAL_FACING_DELTA) {
    return movementFocusTarget;
  }

  if (motionFocusTarget && Math.abs(motionFocusTarget.x) >= MIN_HORIZONTAL_FACING_DELTA) {
    return motionFocusTarget;
  }

  return movementFocusTarget ?? motionFocusTarget;
}

export function resolve2dFaceDirectionScale(horizontalDelta: number) {
  if (Math.abs(horizontalDelta) < MIN_HORIZONTAL_FACING_DELTA) {
    return null;
  }

  return horizontalDelta < 0 ? -1 : 1;
}
