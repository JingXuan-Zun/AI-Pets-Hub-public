import { type DesktopPetAnimationToolTrigger } from './chatState';

function cloneAnimationToolTriggerAudio(
  audio: DesktopPetAnimationToolTrigger['audio'],
): DesktopPetAnimationToolTrigger['audio'] {
  return audio ? { ...audio } : undefined;
}

function cloneAnimationToolTriggerSchedule(
  schedule: DesktopPetAnimationToolTrigger['schedule'],
): DesktopPetAnimationToolTrigger['schedule'] {
  return schedule?.map((item) => ({ ...item }));
}

export function isReplayableAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
) {
  return Boolean(trigger && !trigger.control && trigger.animationIds.length > 0);
}

export function cloneReplayableAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger,
  token: number,
): DesktopPetAnimationToolTrigger {
  return {
    ...(trigger.audio ? { audio: cloneAnimationToolTriggerAudio(trigger.audio) } : {}),
    animationIds: [...trigger.animationIds],
    ...(trigger.schedule ? { schedule: cloneAnimationToolTriggerSchedule(trigger.schedule) } : {}),
    source: trigger.source,
    token,
  };
}
