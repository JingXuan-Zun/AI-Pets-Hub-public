import { type DesktopPetAnimationToolAudioPlaybackState } from '../../chatState';

export function formatAnimationToolPlaybackMs(value: number | undefined) {
  if (value === undefined || value <= 0) {
    return '';
  }

  return value >= 1000
    ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}s`
    : `${value}ms`;
}

function clampPlaybackProgressMs(value: number, durationMs: number | undefined) {
  const nextValue = Math.max(0, Math.round(value));
  return durationMs === undefined ? nextValue : Math.min(nextValue, durationMs);
}

export function resolveAnimationToolAudioElapsedMs(
  state: DesktopPetAnimationToolAudioPlaybackState,
  nowMs = Date.now(),
) {
  const basePositionMs = Math.max(0, state.playbackPositionMs ?? 0);
  if (state.status === 'playing') {
    return clampPlaybackProgressMs(
      basePositionMs + Math.max(0, nowMs - state.updatedAt),
      state.durationMs,
    );
  }

  if (state.status === 'ended' && state.durationMs !== undefined) {
    return state.durationMs;
  }

  return clampPlaybackProgressMs(basePositionMs, state.durationMs);
}

export function createAnimationToolAudioProgressDetail(
  state: DesktopPetAnimationToolAudioPlaybackState,
  nowMs = Date.now(),
) {
  const shouldShowPosition = state.status === 'paused'
    || state.status === 'ended'
    || (state.status === 'playing' && state.durationMs !== undefined)
    || (state.status === 'playing' && state.resumeSupported === true);

  if (!shouldShowPosition) {
    return '';
  }

  const elapsed = formatAnimationToolPlaybackMs(
    resolveAnimationToolAudioElapsedMs(state, nowMs),
  ) || '0ms';
  const duration = formatAnimationToolPlaybackMs(state.durationMs);
  return duration ? `elapsed ${elapsed} / ${duration}` : `position ${elapsed}`;
}
