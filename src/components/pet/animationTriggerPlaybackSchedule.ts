import { type DesktopPetAnimationToolTriggerScheduleItem } from '../../chatState';
import { type PetModelMotionBinding } from '../../types';
import { resolveMessageAnimationBindingQueue } from './petMessageAnimationQueueResolvers';
import { CHARACTER_ANIMATION_TRIGGER_ID_LIMIT } from '../../characterAnimationChoreographyLimits';

export interface AnimationTriggerPlaybackBatch {
  delayMs: number;
  motionBindings: PetModelMotionBinding[];
}

function groupScheduleByDelay(schedule: DesktopPetAnimationToolTriggerScheduleItem[]) {
  const groups = new Map<number, string[]>();
  schedule.forEach((item) => {
    const delayMs = Math.max(0, Math.round(Number(item.delayMs) || 0));
    const animationId = item.animationId.trim();
    if (!animationId) {
      return;
    }

    groups.set(delayMs, [...(groups.get(delayMs) ?? []), animationId]);
  });

  return groups;
}

export function createAnimationTriggerPlaybackBatches(
  motionBindings: PetModelMotionBinding[],
  schedule: DesktopPetAnimationToolTriggerScheduleItem[] | null | undefined,
) {
  if (!schedule || schedule.length === 0) {
    return [];
  }

  return Array.from(groupScheduleByDelay(schedule).entries())
    .map(([delayMs, animationIds]) => ({
      delayMs,
      motionBindings: resolveMessageAnimationBindingQueue(
        '',
        motionBindings,
        animationIds,
        CHARACTER_ANIMATION_TRIGGER_ID_LIMIT,
      ),
    }))
    .filter((batch) => batch.motionBindings.length > 0)
    .sort((left, right) => left.delayMs - right.delayMs);
}
