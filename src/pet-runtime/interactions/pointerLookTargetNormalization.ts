export type PointerLookTargetLike = {
  x: number;
  y: number;
};

type PointerLookNormalizationOptions = {
  neutralY?: number;
  xDivisor: number;
  yDivisor: number;
};

export const POINTER_LOOK_HEAD_HORIZON_Y = -24;

function clampNormalizedPointerLookValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, value));
}

export function resolvePointerLookNormalizedY(
  targetY: number,
  options: Pick<PointerLookNormalizationOptions, 'neutralY' | 'yDivisor'>,
) {
  const adjustedY = targetY - (options.neutralY ?? 0);
  const divisor = Math.max(1, Math.abs(options.yDivisor));
  const normalizedY = -adjustedY / divisor;
  if (Math.abs(normalizedY) < 0.000001) {
    return 0;
  }

  return clampNormalizedPointerLookValue(normalizedY);
}

export function resolvePointerLookNormalizedTarget(
  target: PointerLookTargetLike | null | undefined,
  options: PointerLookNormalizationOptions,
) {
  if (!target) {
    return null;
  }

  return {
    x: clampNormalizedPointerLookValue(target.x / options.xDivisor),
    y: resolvePointerLookNormalizedY(target.y, options),
  };
}
