import { type DesktopPetAnimationToolTrigger } from '../../chatState';

export function createSeekedAnimationToolTrigger(
  trigger: DesktopPetAnimationToolTrigger | null | undefined,
  positionMs: number,
): DesktopPetAnimationToolTrigger | null {
  if (!trigger?.schedule?.length) {
    return null;
  }

  const normalizedPositionMs = Math.max(0, Math.round(Number(positionMs) || 0));
  const nextSchedule = trigger.schedule
    .filter((item) => item.delayMs >= normalizedPositionMs)
    .map((item) => ({
      animationId: item.animationId,
      delayMs: Math.max(0, item.delayMs - normalizedPositionMs),
    }));

  if (nextSchedule.length === 0) {
    return null;
  }

  return {
    animationIds: trigger.animationIds,
    schedule: nextSchedule,
    source: trigger.source,
    token: trigger.token,
  };
}
