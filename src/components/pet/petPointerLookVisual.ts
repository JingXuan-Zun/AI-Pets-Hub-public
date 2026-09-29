import { type CSSProperties } from 'react';

type Position = {
  x: number;
  y: number;
} | null | undefined;

type ResolvePointerLookVisualStyleOptions = {
  maxRotateDeg?: number;
  maxTranslateX?: number;
  maxTranslateY?: number;
  strength?: number;
  target: Position;
  xDivisor?: number;
  yDivisor?: number;
};

export function resolvePointerLookVisualStyle({
  maxRotateDeg = 4,
  maxTranslateX = 6,
  maxTranslateY = 4,
  strength = 1,
  target,
  xDivisor = 28,
  yDivisor = 42,
}: ResolvePointerLookVisualStyleOptions): CSSProperties {
  const resolvedStrength = Number.isFinite(strength)
    ? Math.max(0, Math.min(1, strength))
    : 1;
  const x = target
    ? Math.max(-1, Math.min(1, target.x / xDivisor)) * resolvedStrength
    : 0;
  const y = target
    ? Math.max(-1, Math.min(1, target.y / yDivisor)) * resolvedStrength
    : 0;

  return {
    transform: `translate3d(${(x * maxTranslateX).toFixed(2)}px, ${(y * maxTranslateY).toFixed(2)}px, 0) rotate(${(x * -maxRotateDeg).toFixed(2)}deg)`,
    transformOrigin: 'center bottom',
    transition: target ? 'transform 80ms linear' : 'transform 260ms ease-out',
    willChange: 'transform',
  };
}

export function resolvePointerLook3DVisualStyle(
  target: Position,
  baseTransform = 'translate(-50%, -50%)',
): CSSProperties {
  return {
    transform: baseTransform,
    transformOrigin: 'center bottom',
    transition: target ? 'transform 80ms linear' : 'transform 260ms ease-out',
  };
}
