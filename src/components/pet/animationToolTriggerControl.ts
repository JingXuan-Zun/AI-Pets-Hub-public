import { type DesktopPetAnimationToolTrigger } from '../../chatState';

export function isStopAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return trigger?.control === 'stop';
}

export function isPauseAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return trigger?.control === 'pause';
}

export function isResumeAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return trigger?.control === 'resume';
}

export function isSeekAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return trigger?.control === 'seek';
}

export function resolveAnimationToolTriggerSeekPositionMs(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return Number.isFinite(Number(trigger?.seekPositionMs))
    ? Math.max(0, Math.round(Number(trigger?.seekPositionMs)))
    : null;
}

export function isNonStopAnimationToolControlTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return isPauseAnimationToolTrigger(trigger)
    || isResumeAnimationToolTrigger(trigger)
    || isSeekAnimationToolTrigger(trigger);
}
