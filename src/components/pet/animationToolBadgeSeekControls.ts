import { type DesktopPetAnimationToolAudioPlaybackState } from '../../chatState';
import { resolveAnimationToolAudioElapsedMs } from './animationToolAudioPlaybackProgress';

export type AnimationToolBadgeSeekDirection = 'backward' | 'forward';

export type AnimationToolBadgeSeekTarget = {
  disabled?: boolean;
  positionMs: number;
  title: string;
  visible: boolean;
};

export const ANIMATION_TOOL_BADGE_SEEK_STEP_MS = 5000;

function clampSeekPosition(positionMs: number, durationMs: number | undefined) {
  const nextPositionMs = Math.max(0, Math.round(positionMs));
  return durationMs === undefined ? nextPositionMs : Math.min(nextPositionMs, durationMs);
}

function createHiddenSeekTarget(direction: AnimationToolBadgeSeekDirection): AnimationToolBadgeSeekTarget {
  return {
    positionMs: 0,
    title: direction === 'backward' ? 'Seek back 5s' : 'Seek forward 5s',
    visible: false,
  };
}

export function createAnimationToolBadgeSeekTarget(options: {
  direction: AnimationToolBadgeSeekDirection;
  state: DesktopPetAnimationToolAudioPlaybackState | null | undefined;
  nowMs?: number;
}): AnimationToolBadgeSeekTarget {
  if (
    !options.state
    || (options.state.status !== 'playing' && options.state.status !== 'paused')
    || options.state.resumeSupported !== true
  ) {
    return createHiddenSeekTarget(options.direction);
  }

  const elapsedMs = resolveAnimationToolAudioElapsedMs(options.state, options.nowMs);
  const deltaMs = options.direction === 'backward'
    ? -ANIMATION_TOOL_BADGE_SEEK_STEP_MS
    : ANIMATION_TOOL_BADGE_SEEK_STEP_MS;
  const positionMs = clampSeekPosition(elapsedMs + deltaMs, options.state.durationMs);
  const disabled = positionMs === elapsedMs;
  const title = options.direction === 'backward'
    ? 'Seek back 5s'
    : 'Seek forward 5s';

  return {
    ...(disabled ? { disabled: true } : {}),
    positionMs,
    title,
    visible: true,
  };
}
