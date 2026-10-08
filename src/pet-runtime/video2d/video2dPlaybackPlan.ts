import { type PetVideoEmotionAction } from '../../types';

export type Video2DClipSource = 'emotion' | 'idle' | 'item';

export type Video2DNextStep =
  | { kind: 'emotion'; action: PetVideoEmotionAction }
  | { kind: 'idle' }
  | { kind: 'base' };

/** Consecutive playback failures tolerated before idle rotation pauses. */
export const VIDEO_2D_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * What to play after the current clip ends: a queued emotion first, then the
 * next random library clip, otherwise the looping default video.
 */
export function resolveVideo2DNextStep({
  idleRotationActive,
  pendingEmotion,
}: {
  idleRotationActive: boolean;
  pendingEmotion: PetVideoEmotionAction | null;
}): Video2DNextStep {
  if (pendingEmotion) return { kind: 'emotion', action: pendingEmotion };
  return idleRotationActive ? { kind: 'idle' } : { kind: 'base' };
}

/**
 * A new emotion waits for an emotion clip that is still playing, so a reply
 * that moves from 开心 to 伤心 shows both instead of cutting the first one.
 */
export function shouldQueueVideo2DEmotion(activeSource: Video2DClipSource | null) {
  return activeSource === 'emotion';
}

/** The default video only loops when nothing will advance playback on end. */
export function shouldLoopVideo2DBase(hasActiveClip: boolean, idleRotationActive: boolean) {
  return !hasActiveClip && !idleRotationActive;
}
