import { type DesktopPetAnimationToolTriggerScheduleItem } from '../../chatState';
import {
  CHARACTER_ANIMATION_SCHEDULE_ITEM_LIMIT,
  CHARACTER_ANIMATION_TRIGGER_ID_LIMIT,
} from '../../characterAnimationChoreographyLimits';

export function normalizeAnimationToolTriggerIds(animationIds: string[]) {
  return Array.from(new Set(
    animationIds
      .map((animationId) => animationId.trim())
      .filter(Boolean),
  )).slice(0, CHARACTER_ANIMATION_TRIGGER_ID_LIMIT);
}

export function normalizeAnimationToolTriggerSchedule(
  animationIds: string[],
  schedule: DesktopPetAnimationToolTriggerScheduleItem[] | null | undefined,
) {
  if (!schedule || schedule.length === 0) {
    return undefined;
  }

  const allowedAnimationIds = new Set(animationIds);
  const normalizedSchedule = schedule
    .map((item) => ({
      animationId: item.animationId.trim(),
      delayMs: Math.max(0, Math.round(Number(item.delayMs) || 0)),
    }))
    .filter((item) => allowedAnimationIds.has(item.animationId))
    .slice(0, CHARACTER_ANIMATION_SCHEDULE_ITEM_LIMIT);

  return normalizedSchedule.length > 0 ? normalizedSchedule : undefined;
}
