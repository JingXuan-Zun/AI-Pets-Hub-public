export const DEFAULT_GAME_COMPANION_OBSERVATION_INTERVAL_MS = 8_000;
export const MIN_GAME_COMPANION_OBSERVATION_INTERVAL_MS = 200;
export const MAX_GAME_COMPANION_OBSERVATION_INTERVAL_MS = 10_000;

export function normalizeGameCompanionObservationInterval(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_GAME_COMPANION_OBSERVATION_INTERVAL_MS;
  }

  return Math.max(
    MIN_GAME_COMPANION_OBSERVATION_INTERVAL_MS,
    Math.min(MAX_GAME_COMPANION_OBSERVATION_INTERVAL_MS, Math.round(numericValue / 100) * 100),
  );
}

export function formatGameCompanionObservationRate(intervalMs: number) {
  const framesPerSecond = 1_000 / Math.max(1, intervalMs);
  return `${framesPerSecond.toFixed(2)} 帧/秒`;
}
