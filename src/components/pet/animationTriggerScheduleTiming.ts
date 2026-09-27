import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import {
  resolveAnimationToolTriggerAudioStartDelayMs,
  resolveAnimationToolTriggerPlayableAudio,
} from './animationToolTriggerAudio';

export function resolveAnimationTriggerScheduleBaseDelayMs(
  trigger: DesktopPetAnimationToolTrigger,
) {
  return resolveAnimationToolTriggerPlayableAudio(trigger.audio)
    ? resolveAnimationToolTriggerAudioStartDelayMs(trigger.audio)
    : 0;
}

export function shouldWaitForAnimationToolAudioScheduleTiming(
  trigger: DesktopPetAnimationToolTrigger,
) {
  return Boolean(resolveAnimationToolTriggerPlayableAudio(trigger.audio));
}

export function resolveAnimationTriggerBatchDelayMs(options: {
  batchDelayMs: number;
  scheduleBaseDelayMs: number;
}) {
  return Math.max(0, Math.round(options.scheduleBaseDelayMs + options.batchDelayMs));
}
