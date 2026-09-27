import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import {
  pauseScheduledAnimationTriggerBatches,
  resumePausedAnimationTriggerBatches,
  clearAnimationTriggerBatchTimeouts,
  enqueueScheduledAnimationTriggerBatches,
} from './animationTriggerBatchScheduler';
import {
  isPauseAnimationToolTrigger,
  isResumeAnimationToolTrigger,
  isSeekAnimationToolTrigger,
  isStopAnimationToolTrigger,
  resolveAnimationToolTriggerSeekPositionMs,
} from './animationToolTriggerControl';
import { createSeekedAnimationToolTrigger } from './animationToolScheduleSeek';
import {
  reportAnimationToolScheduleSeekTelemetrySample,
  type AnimationToolScheduleSeekTelemetryReporter,
  createAnimationToolScheduleSeekTelemetrySample,
} from './animationToolScheduleSeekTelemetry';
import { type AnimationToolTriggerPlaybackResult } from './animationToolTriggerPlaybackTypes';
import { type PetModelMotionBinding } from '../../types';

function reportSeekTelemetry(options: {
  animationToolTrigger: DesktopPetAnimationToolTrigger;
  lastReplayableTrigger?: DesktopPetAnimationToolTrigger | null;
  outcome: 'applied' | 'empty' | 'unavailable';
  reason: string;
  reportSeek?: AnimationToolScheduleSeekTelemetryReporter;
  seekedTrigger?: DesktopPetAnimationToolTrigger | null;
  seekPositionMs: number;
}) {
  (options.reportSeek ?? reportAnimationToolScheduleSeekTelemetrySample)(
    createAnimationToolScheduleSeekTelemetrySample({
      controlTrigger: options.animationToolTrigger,
      lastReplayableTrigger: options.lastReplayableTrigger,
      outcome: options.outcome,
      reason: options.reason,
      seekedTrigger: options.seekedTrigger,
      seekPositionMs: options.seekPositionMs,
    }),
  );
}

export function handleAnimationToolTriggerControlPlayback(options: {
  animationToolTrigger: DesktopPetAnimationToolTrigger;
  enqueueAnimationBindings?: (bindings: PetModelMotionBinding[], preserveRepeats?: boolean) => void;
  lastReplayableTrigger?: DesktopPetAnimationToolTrigger | null;
  motionBindings?: PetModelMotionBinding[];
  nowMs?: () => number;
  reportSeek?: AnimationToolScheduleSeekTelemetryReporter;
  resetMotionPlayback: () => void;
  scheduledTriggerTimeoutsRef: { current: number[] };
}): AnimationToolTriggerPlaybackResult | null {
  if (isStopAnimationToolTrigger(options.animationToolTrigger)) {
    options.resetMotionPlayback();
    return { handled: true, itemCount: 0, status: 'cancelled' };
  }

  if (isPauseAnimationToolTrigger(options.animationToolTrigger)) {
    const itemCount = pauseScheduledAnimationTriggerBatches({
      nowMs: options.nowMs,
      timeoutIdsRef: options.scheduledTriggerTimeoutsRef,
    });
    return itemCount > 0
      ? { handled: true, itemCount, status: 'paused', triggerKind: 'scheduled' }
      : { handled: false };
  }

  if (isResumeAnimationToolTrigger(options.animationToolTrigger)) {
    const itemCount = resumePausedAnimationTriggerBatches({
      nowMs: options.nowMs,
      timeoutIdsRef: options.scheduledTriggerTimeoutsRef,
    });
    return itemCount > 0
      ? { handled: true, itemCount, status: 'playing', triggerKind: 'scheduled' }
      : { handled: false };
  }

  if (isSeekAnimationToolTrigger(options.animationToolTrigger)) {
    const positionMs = resolveAnimationToolTriggerSeekPositionMs(options.animationToolTrigger);
    const seekedTrigger = createSeekedAnimationToolTrigger(options.lastReplayableTrigger, positionMs ?? 0);
    if (!seekedTrigger || !options.motionBindings || !options.enqueueAnimationBindings) {
      reportSeekTelemetry({
        animationToolTrigger: options.animationToolTrigger,
        lastReplayableTrigger: options.lastReplayableTrigger,
        outcome: seekedTrigger ? 'unavailable' : 'empty',
        reason: seekedTrigger ? 'missing-runtime-bindings' : 'no-future-schedule',
        reportSeek: options.reportSeek,
        seekedTrigger,
        seekPositionMs: positionMs ?? 0,
      });
      clearAnimationTriggerBatchTimeouts(options.scheduledTriggerTimeoutsRef);
      options.resetMotionPlayback();
      return { handled: true, itemCount: 0, status: 'ended', triggerKind: 'scheduled' };
    }

    const queued = enqueueScheduledAnimationTriggerBatches({
      cancelCurrentPlayback: options.resetMotionPlayback,
      enqueueBindings: (bindings) => options.enqueueAnimationBindings?.(bindings, true),
      motionBindings: options.motionBindings,
      nowMs: options.nowMs,
      timeoutIdsRef: options.scheduledTriggerTimeoutsRef,
      trigger: seekedTrigger,
    });
    reportSeekTelemetry({
      animationToolTrigger: options.animationToolTrigger,
      lastReplayableTrigger: options.lastReplayableTrigger,
      outcome: queued ? 'applied' : 'empty',
      reason: queued ? 'rebased-schedule' : 'no-matching-bindings',
      reportSeek: options.reportSeek,
      seekedTrigger,
      seekPositionMs: positionMs ?? 0,
    });
    return {
      handled: true,
      itemCount: queued ? seekedTrigger.schedule?.length ?? 0 : 0,
      status: queued ? 'playing' : 'ended',
      triggerKind: 'scheduled',
    };
  }

  return null;
}
