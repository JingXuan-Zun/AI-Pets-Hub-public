import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { CHARACTER_ANIMATION_TRIGGER_ID_LIMIT } from '../../characterAnimationChoreographyLimits';
import { type PetModelMotionBinding } from '../../types';
import { enqueueScheduledAnimationTriggerBatches } from './animationTriggerBatchScheduler';
import { handleAnimationToolTriggerControlPlayback } from './animationToolTriggerPlaybackControl';
import { type AnimationToolScheduleSeekTelemetryReporter } from './animationToolScheduleSeekTelemetry';
import { type AnimationToolTriggerPlaybackResult } from './animationToolTriggerPlaybackTypes';
import { resolveMessageAnimationBindingQueue } from './petMessageAnimationQueueResolvers';

type AnimationToolTriggerPlaybackOptions = {
  animationToolTrigger: DesktopPetAnimationToolTrigger;
  enqueueAnimationBindings: (bindings: PetModelMotionBinding[], preserveRepeats?: boolean) => void;
  lastReplayableTrigger?: DesktopPetAnimationToolTrigger | null;
  motionBindings: PetModelMotionBinding[];
  nowMs?: () => number;
  reportSeek?: AnimationToolScheduleSeekTelemetryReporter;
  resetMotionPlayback: () => void;
  scheduledTriggerTimeoutsRef: { current: number[] };
};

function handleScheduledAnimationToolTriggerPlayback(
  options: AnimationToolTriggerPlaybackOptions,
): AnimationToolTriggerPlaybackResult | null {
  if (!options.animationToolTrigger.schedule || !enqueueScheduledAnimationTriggerBatches({
    cancelCurrentPlayback: options.resetMotionPlayback,
    enqueueBindings: (bindings) => options.enqueueAnimationBindings(bindings, true),
    motionBindings: options.motionBindings,
    nowMs: options.nowMs,
    timeoutIdsRef: options.scheduledTriggerTimeoutsRef,
    trigger: options.animationToolTrigger,
  })) {
    return null;
  }

  return {
    handled: true,
    itemCount: options.animationToolTrigger.schedule.length,
    status: 'playing',
    triggerKind: 'scheduled',
  };
}

export function handleAnimationToolTriggerPlayback(
  options: AnimationToolTriggerPlaybackOptions,
): AnimationToolTriggerPlaybackResult {
  const controlResult = handleAnimationToolTriggerControlPlayback({
    animationToolTrigger: options.animationToolTrigger,
    enqueueAnimationBindings: options.enqueueAnimationBindings,
    lastReplayableTrigger: options.lastReplayableTrigger,
    motionBindings: options.motionBindings,
    nowMs: options.nowMs,
    reportSeek: options.reportSeek,
    resetMotionPlayback: options.resetMotionPlayback,
    scheduledTriggerTimeoutsRef: options.scheduledTriggerTimeoutsRef,
  });
  if (controlResult) {
    return controlResult;
  }

  const scheduledResult = handleScheduledAnimationToolTriggerPlayback(options);
  if (scheduledResult) {
    return scheduledResult;
  }

  const nextMotionBindings = resolveMessageAnimationBindingQueue(
    '',
    options.motionBindings,
    options.animationToolTrigger.animationIds,
    CHARACTER_ANIMATION_TRIGGER_ID_LIMIT,
  );
  if (nextMotionBindings.length === 0) {
    return { handled: false };
  }

  options.resetMotionPlayback();
  options.enqueueAnimationBindings(nextMotionBindings);
  return {
    handled: true,
    itemCount: nextMotionBindings.length,
    status: 'playing',
    triggerKind: 'direct',
  };
}
