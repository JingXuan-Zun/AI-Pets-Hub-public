import { type PetModelMotionBinding } from '../../types';

export const MESSAGE_ANIMATION_DURATION_MS = 4200;

const MULTI_ANIMATION_DURATION_MS = 3800;
const KNOWN_ANIMATION_DURATION_PADDING_MS = 250;
const MIN_KNOWN_ANIMATION_DURATION_MS = 600;
const MAX_KNOWN_ANIMATION_DURATION_MS = 120000;
const MIN_ANIMATION_DURATION_MS_BY_MOTION_KEY: Partial<Record<PetModelMotionBinding['motionKey'], number>> = {
  eating: 3600,
  happy: 3600,
  idle: 3800,
  running: 3200,
  sad: 3800,
  sleeping: 4400,
  swimming: 3200,
  walking: 3200,
};

function normalizeKnownAnimationDurationMs(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.min(
    MAX_KNOWN_ANIMATION_DURATION_MS,
    Math.max(
      MIN_KNOWN_ANIMATION_DURATION_MS,
      Math.round(numericValue + KNOWN_ANIMATION_DURATION_PADDING_MS),
    ),
  );
}

export function resolveAnimationBindingPlaybackDurationMs(
  binding: PetModelMotionBinding,
  bindingCount: number,
  defaultDurationMs = MESSAGE_ANIMATION_DURATION_MS,
  runtimeDurationMs: number | null = null,
) {
  const knownDurationMs = normalizeKnownAnimationDurationMs(binding.durationMs)
    ?? normalizeKnownAnimationDurationMs(runtimeDurationMs);
  if (knownDurationMs !== null) {
    return knownDurationMs;
  }

  const queueDurationMs = bindingCount <= 1
    ? defaultDurationMs
    : Math.min(defaultDurationMs, MULTI_ANIMATION_DURATION_MS);

  return Math.max(
    queueDurationMs,
    MIN_ANIMATION_DURATION_MS_BY_MOTION_KEY[binding.motionKey] ?? 3200,
  );
}

export function shouldResetAnimationPlaybackOnTypingStart(
  activeBinding: PetModelMotionBinding | null,
  queuedBindingCount: number,
) {
  return !activeBinding && queuedBindingCount <= 0;
}
