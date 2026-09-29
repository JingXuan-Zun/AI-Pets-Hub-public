import { type DesktopPetAnimationToolAudioPlaybackState } from '../../chatState';
import {
  formatAnimationToolPlaybackMs,
  resolveAnimationToolAudioElapsedMs,
} from './animationToolAudioPlaybackProgress';

export interface AnimationToolBadgeScrubberState {
  disabled?: boolean;
  durationMs: number;
  elapsedMs: number;
  label: string;
  percent: number;
  title: string;
  visible: boolean;
}

function createHiddenScrubberState(): AnimationToolBadgeScrubberState {
  return {
    durationMs: 0,
    elapsedMs: 0,
    label: '',
    percent: 0,
    title: 'Seek timeline',
    visible: false,
  };
}

function clampScrubberPosition(positionMs: number, durationMs: number) {
  return Math.max(0, Math.min(Math.round(positionMs), durationMs));
}

export function createAnimationToolBadgeScrubberLabel(options: {
  durationMs: number;
  positionMs: number;
}) {
  const position = formatAnimationToolPlaybackMs(options.positionMs) || '0ms';
  const duration = formatAnimationToolPlaybackMs(options.durationMs) || '0ms';
  return `${position}/${duration}`;
}

export function createAnimationToolBadgeScrubberState(options: {
  state: DesktopPetAnimationToolAudioPlaybackState | null | undefined;
  nowMs?: number;
}): AnimationToolBadgeScrubberState {
  if (
    !options.state
    || options.state.durationMs === undefined
    || options.state.durationMs <= 0
    || options.state.resumeSupported !== true
    || (options.state.status !== 'playing' && options.state.status !== 'paused')
  ) {
    return createHiddenScrubberState();
  }

  const durationMs = Math.round(options.state.durationMs);
  const elapsedMs = clampScrubberPosition(
    resolveAnimationToolAudioElapsedMs(options.state, options.nowMs),
    durationMs,
  );
  return {
    ...(durationMs === 0 ? { disabled: true } : {}),
    durationMs,
    elapsedMs,
    label: createAnimationToolBadgeScrubberLabel({
      durationMs,
      positionMs: elapsedMs,
    }),
    percent: durationMs > 0 ? Math.round((elapsedMs / durationMs) * 100) : 0,
    title: 'Seek timeline',
    visible: true,
  };
}

export function resolveAnimationToolBadgeScrubberSeekPosition(options: {
  durationMs: number;
  percent: number;
}) {
  const normalizedPercent = Math.max(0, Math.min(100, Math.round(options.percent)));
  return clampScrubberPosition((options.durationMs * normalizedPercent) / 100, options.durationMs);
}
