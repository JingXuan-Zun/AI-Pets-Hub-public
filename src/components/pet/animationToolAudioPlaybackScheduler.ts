import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import {
  resolveAnimationToolTriggerAudioStartDelayMs,
  resolveAnimationToolTriggerPlayableAudio,
} from './animationToolTriggerAudio';

export type AnimationToolAudioPlaybackStart = {
  playbackUrl: string;
  startDelayMs: number;
};

export function resolveAnimationToolAudioPlaybackStart(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
): AnimationToolAudioPlaybackStart | null {
  const audio = resolveAnimationToolTriggerPlayableAudio(trigger?.audio);
  if (!audio) {
    return null;
  }

  return {
    playbackUrl: audio.playbackUrl,
    startDelayMs: resolveAnimationToolTriggerAudioStartDelayMs(audio),
  };
}

export function scheduleAnimationToolAudioPlaybackStart(options: {
  onStart: () => void;
  startDelayMs: number;
}) {
  if (options.startDelayMs <= 0) {
    options.onStart();
    return null;
  }

  return window.setTimeout(options.onStart, options.startDelayMs);
}
