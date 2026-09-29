import { type MutableRefObject } from 'react';
import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { type PetModelMotionBinding } from '../../types';
import { createAnimationTriggerPlaybackBatches } from './animationTriggerPlaybackSchedule';
import {
  resolveAnimationTriggerBatchDelayMs,
  resolveAnimationTriggerScheduleBaseDelayMs,
  shouldWaitForAnimationToolAudioScheduleTiming,
} from './animationTriggerScheduleTiming';
import {
  cancelAnimationToolAudioScheduleTimingWait,
  waitForAnimationToolAudioScheduleTiming,
} from './animationToolAudioScheduleSync';
import {
  type AnimationTriggerDriftReporter,
  type AnimationTriggerDriftScheduler,
  createAnimationTriggerDriftSample,
  getAnimationTriggerDriftNowMs,
  reportAnimationTriggerDriftSample,
} from './animationTriggerDriftMeasurement';

interface ScheduledAnimationTriggerBatchRecord {
  batchDelayMs: number;
  enqueueBindings: (bindings: PetModelMotionBinding[]) => void;
  motionBindings: PetModelMotionBinding[];
  nowMs: () => number;
  plannedDelayMs: number;
  reportDrift: AnimationTriggerDriftReporter;
  scheduleBaseDelayMs: number;
  scheduledAtMs: number;
  scheduler: AnimationTriggerDriftScheduler;
  timeoutId: number;
  trigger: DesktopPetAnimationToolTrigger;
}

type PausedAnimationTriggerBatchRecord =
  Omit<ScheduledAnimationTriggerBatchRecord, 'plannedDelayMs' | 'scheduledAtMs' | 'timeoutId'> & {
    remainingDelayMs: number;
  };

const scheduledBatchRecordsByTimeoutId = new Map<number, ScheduledAnimationTriggerBatchRecord>();
const pausedBatchRecordsByRef = new WeakMap<MutableRefObject<number[]>, PausedAnimationTriggerBatchRecord[]>();

function removeScheduledBatchTimeoutId(
  timeoutIdsRef: MutableRefObject<number[]>,
  timeoutId: number,
) {
  scheduledBatchRecordsByTimeoutId.delete(timeoutId);
  timeoutIdsRef.current = timeoutIdsRef.current
    .filter((scheduledTimeoutId) => scheduledTimeoutId !== timeoutId);
}

export function clearAnimationTriggerBatchTimeouts(
  timeoutIdsRef: MutableRefObject<number[]>,
) {
  pausedBatchRecordsByRef.delete(timeoutIdsRef);
  timeoutIdsRef.current.forEach((timeoutId) => {
    if (timeoutId < 0) {
      cancelAnimationToolAudioScheduleTimingWait(timeoutId);
      return;
    }

    scheduledBatchRecordsByTimeoutId.delete(timeoutId);
    window.clearTimeout(timeoutId);
  });
  timeoutIdsRef.current = [];
}

function reportAndEnqueueScheduledBatch(record: ScheduledAnimationTriggerBatchRecord) {
  record.reportDrift(createAnimationTriggerDriftSample({
    actualFiredAtMs: record.nowMs(),
    batchDelayMs: record.batchDelayMs,
    batchSize: record.motionBindings.length,
    plannedDelayMs: record.plannedDelayMs,
    scheduledAtMs: record.scheduledAtMs,
    scheduleBaseDelayMs: record.scheduleBaseDelayMs,
    scheduler: record.scheduler,
    token: record.trigger.token,
    triggerSource: record.trigger.source,
  }));
  record.enqueueBindings(record.motionBindings);
}

function scheduleAnimationTriggerBatch(options: {
  batchDelayMs: number;
  enqueueBindings: (bindings: PetModelMotionBinding[]) => void;
  motionBindings: PetModelMotionBinding[];
  nowMs: () => number;
  plannedDelayMs: number;
  reportDrift: AnimationTriggerDriftReporter;
  scheduleBaseDelayMs: number;
  scheduler: AnimationTriggerDriftScheduler;
  timeoutIdsRef: MutableRefObject<number[]>;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  const scheduledAtMs = options.nowMs();
  const timeoutId = window.setTimeout(() => {
    removeScheduledBatchTimeoutId(options.timeoutIdsRef, timeoutId);
    reportAndEnqueueScheduledBatch({
      ...options,
      scheduledAtMs,
      timeoutId,
    });
  }, options.plannedDelayMs);
  scheduledBatchRecordsByTimeoutId.set(timeoutId, {
    ...options,
    scheduledAtMs,
    timeoutId,
  });
  options.timeoutIdsRef.current.push(timeoutId);
}

function enqueuePlaybackBatches(options: {
  batches: ReturnType<typeof createAnimationTriggerPlaybackBatches>;
  enqueueBindings: (bindings: PetModelMotionBinding[]) => void;
  nowMs: () => number;
  reportDrift: AnimationTriggerDriftReporter;
  scheduleBaseDelayMs: number;
  scheduler: AnimationTriggerDriftScheduler;
  timeoutIdsRef: MutableRefObject<number[]>;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  options.batches.forEach((batch) => {
    const batchDelayMs = resolveAnimationTriggerBatchDelayMs({
      batchDelayMs: batch.delayMs,
      scheduleBaseDelayMs: options.scheduleBaseDelayMs,
    });
    scheduleAnimationTriggerBatch({
      batchDelayMs: batch.delayMs,
      enqueueBindings: options.enqueueBindings,
      motionBindings: batch.motionBindings,
      nowMs: options.nowMs,
      plannedDelayMs: batchDelayMs,
      reportDrift: options.reportDrift,
      scheduleBaseDelayMs: options.scheduleBaseDelayMs,
      scheduler: options.scheduler,
      timeoutIdsRef: options.timeoutIdsRef,
      trigger: options.trigger,
    });
  });
}

function createPausedBatchRecord(
  record: ScheduledAnimationTriggerBatchRecord,
  nowMs: number,
): PausedAnimationTriggerBatchRecord {
  return {
    batchDelayMs: record.batchDelayMs,
    enqueueBindings: record.enqueueBindings,
    motionBindings: record.motionBindings,
    nowMs: record.nowMs,
    remainingDelayMs: Math.max(0, Math.round(record.scheduledAtMs + record.plannedDelayMs - nowMs)),
    reportDrift: record.reportDrift,
    scheduleBaseDelayMs: record.scheduleBaseDelayMs,
    scheduler: record.scheduler,
    trigger: record.trigger,
  };
}

function enqueueAudioClockedPlaybackBatches(options: {
  batches: ReturnType<typeof createAnimationTriggerPlaybackBatches>;
  enqueueBindings: (bindings: PetModelMotionBinding[]) => void;
  fallbackBaseDelayMs: number;
  nowMs: () => number;
  reportDrift: AnimationTriggerDriftReporter;
  timeoutIdsRef: MutableRefObject<number[]>;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  const waitHandle = waitForAnimationToolAudioScheduleTiming({
    fallbackBaseDelayMs: options.fallbackBaseDelayMs,
    onTiming: (timing) => {
      options.timeoutIdsRef.current = options.timeoutIdsRef.current
        .filter((scheduledTimeoutId) => scheduledTimeoutId !== waitHandle);
      enqueuePlaybackBatches({
        batches: options.batches,
        enqueueBindings: options.enqueueBindings,
        nowMs: options.nowMs,
        reportDrift: options.reportDrift,
        scheduleBaseDelayMs: timing.baseDelayMs,
        scheduler: timing.scheduler,
        timeoutIdsRef: options.timeoutIdsRef,
        trigger: options.trigger,
      });
    },
    token: options.trigger.token,
  });
  if (waitHandle < 0) {
    options.timeoutIdsRef.current.push(waitHandle);
  }
}

export function pauseScheduledAnimationTriggerBatches(options: {
  nowMs?: () => number;
  timeoutIdsRef: MutableRefObject<number[]>;
}) {
  const nowMs = (options.nowMs ?? getAnimationTriggerDriftNowMs)();
  const scheduledRecords = options.timeoutIdsRef.current
    .map((timeoutId) => scheduledBatchRecordsByTimeoutId.get(timeoutId))
    .filter((record): record is ScheduledAnimationTriggerBatchRecord => Boolean(record));
  const pausedRecords = scheduledRecords.map((record) => createPausedBatchRecord(record, nowMs));
  if (pausedRecords.length === 0) {
    return 0;
  }

  scheduledRecords.forEach((record) => {
    window.clearTimeout(record.timeoutId);
  });
  options.timeoutIdsRef.current = options.timeoutIdsRef.current
    .filter((timeoutId) => {
      const shouldRemove = scheduledBatchRecordsByTimeoutId.has(timeoutId);
      if (shouldRemove) {
        scheduledBatchRecordsByTimeoutId.delete(timeoutId);
      }
      return !shouldRemove;
    });
  pausedBatchRecordsByRef.set(options.timeoutIdsRef, pausedRecords
    .sort((left, right) => left.remainingDelayMs - right.remainingDelayMs));

  return pausedRecords.length;
}

export function resumePausedAnimationTriggerBatches(options: {
  nowMs?: () => number;
  timeoutIdsRef: MutableRefObject<number[]>;
}) {
  const pausedRecords = pausedBatchRecordsByRef.get(options.timeoutIdsRef) ?? [];
  if (pausedRecords.length === 0) {
    return 0;
  }

  pausedBatchRecordsByRef.delete(options.timeoutIdsRef);
  const nowMs = options.nowMs ?? getAnimationTriggerDriftNowMs;
  pausedRecords.forEach((record) => {
    scheduleAnimationTriggerBatch({
      ...record,
      nowMs,
      plannedDelayMs: record.remainingDelayMs,
      timeoutIdsRef: options.timeoutIdsRef,
    });
  });

  return pausedRecords.length;
}

export function enqueueScheduledAnimationTriggerBatches(options: {
  cancelCurrentPlayback?: () => void;
  enqueueBindings: (bindings: PetModelMotionBinding[]) => void;
  motionBindings: PetModelMotionBinding[];
  nowMs?: () => number;
  reportDrift?: AnimationTriggerDriftReporter;
  timeoutIdsRef: MutableRefObject<number[]>;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  const batches = createAnimationTriggerPlaybackBatches(
    options.motionBindings,
    options.trigger.schedule,
  );
  if (batches.length === 0) {
    return false;
  }

  clearAnimationTriggerBatchTimeouts(options.timeoutIdsRef);
  options.cancelCurrentPlayback?.();
  const nowMs = options.nowMs ?? getAnimationTriggerDriftNowMs;
  const reportDrift = options.reportDrift ?? reportAnimationTriggerDriftSample;
  const fallbackBaseDelayMs = resolveAnimationTriggerScheduleBaseDelayMs(options.trigger);
  if (!shouldWaitForAnimationToolAudioScheduleTiming(options.trigger)) {
    enqueuePlaybackBatches({
      batches,
      enqueueBindings: options.enqueueBindings,
      nowMs,
      reportDrift,
      scheduleBaseDelayMs: fallbackBaseDelayMs,
      scheduler: 'timer',
      timeoutIdsRef: options.timeoutIdsRef,
      trigger: options.trigger,
    });
    return true;
  }

  enqueueAudioClockedPlaybackBatches({
    batches,
    enqueueBindings: options.enqueueBindings,
    fallbackBaseDelayMs,
    nowMs,
    reportDrift,
    timeoutIdsRef: options.timeoutIdsRef,
    trigger: options.trigger,
  });
  return true;
}
