import {
  beginQueuedReplyVoiceSegment,
  QUEUED_REPLY_VOICE_PREPARATION_CANCELLED,
} from './queuedReplyVoiceSegmentQueueState';
import {
  prepareQueuedReplyVoiceSegmentTask,
  runQueuedReplyVoiceSegmentTask,
} from './queuedReplyVoiceSegmentTask';
import { type EnqueueQueuedReplyVoiceSegmentOptions } from './queuedReplyVoiceSegmentQueueTypes';

const MAX_PARALLEL_QUEUED_VOICE_PREPARATIONS = 8;

function releaseQueuedVoicePreparationSlot({
  epoch,
  queuedVoicePreparationActiveCountRef,
  queuedVoicePreparationEpochRef,
  queuedVoicePreparationWaitersRef,
}: Pick<
  EnqueueQueuedReplyVoiceSegmentOptions,
  'queuedVoicePreparationActiveCountRef'
  | 'queuedVoicePreparationEpochRef'
  | 'queuedVoicePreparationWaitersRef'
> & {
  epoch: number;
}) {
  if (queuedVoicePreparationEpochRef.current !== epoch) {
    return;
  }

  const nextWaiterIndex = queuedVoicePreparationWaitersRef.current.findIndex((waiter) => waiter.epoch === epoch);
  const nextWaiter = nextWaiterIndex >= 0
    ? queuedVoicePreparationWaitersRef.current.splice(nextWaiterIndex, 1)[0]
    : null;

  if (nextWaiter) {
    nextWaiter.resolve(true);
    return;
  }

  queuedVoicePreparationActiveCountRef.current = Math.max(0, queuedVoicePreparationActiveCountRef.current - 1);
}

async function acquireQueuedVoicePreparationSlot({
  queuedVoicePreparationActiveCountRef,
  queuedVoicePreparationEpochRef,
  queuedVoicePreparationWaitersRef,
}: Pick<
  EnqueueQueuedReplyVoiceSegmentOptions,
  'queuedVoicePreparationActiveCountRef'
  | 'queuedVoicePreparationEpochRef'
  | 'queuedVoicePreparationWaitersRef'
>) {
  const epoch = queuedVoicePreparationEpochRef.current;

  if (queuedVoicePreparationActiveCountRef.current < MAX_PARALLEL_QUEUED_VOICE_PREPARATIONS) {
    queuedVoicePreparationActiveCountRef.current += 1;
  } else {
    const granted = await new Promise<boolean>((resolve) => {
      queuedVoicePreparationWaitersRef.current.push({ epoch, resolve });
    });

    if (!granted || queuedVoicePreparationEpochRef.current !== epoch) {
      throw new Error(QUEUED_REPLY_VOICE_PREPARATION_CANCELLED);
    }
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }

    released = true;
    releaseQueuedVoicePreparationSlot({
      epoch,
      queuedVoicePreparationActiveCountRef,
      queuedVoicePreparationEpochRef,
      queuedVoicePreparationWaitersRef,
    });
  };
}

async function prepareQueuedReplyVoiceSegmentWithConcurrency({
  configRef,
  queuedVoicePreparationActiveCountRef,
  queuedVoicePreparationEpochRef,
  queuedVoicePreparationWaitersRef,
  segmentText,
  targetPetId,
}: Pick<
  EnqueueQueuedReplyVoiceSegmentOptions,
  'configRef'
  | 'queuedVoicePreparationActiveCountRef'
  | 'queuedVoicePreparationEpochRef'
  | 'queuedVoicePreparationWaitersRef'
  | 'targetPetId'
> & {
  segmentText: string;
}) {
  const releaseSlot = await acquireQueuedVoicePreparationSlot({
    queuedVoicePreparationActiveCountRef,
    queuedVoicePreparationEpochRef,
    queuedVoicePreparationWaitersRef,
  });

  try {
    return await prepareQueuedReplyVoiceSegmentTask({
      configRef,
      segmentText,
      targetPetId,
    });
  } finally {
    releaseSlot();
  }
}

export function enqueueQueuedReplyVoiceSegment({
  configRef,
  playbackToken,
  publishStatusMessage,
  queuedVoicePlaybackCursorRef,
  queuedVoicePlaybackSessionsRef,
  queuedVoicePreparationActiveCountRef,
  queuedVoicePreparationEpochRef,
  queuedVoicePreparationWaitersRef,
  queuedVoicePlaybackTaskRef,
  queuedVoiceSegmentCountRef,
  targetPetId,
  text,
  voicePlaybackTokenRef,
}: EnqueueQueuedReplyVoiceSegmentOptions) {
  const segmentText = text.trim();
  if (!segmentText) {
    return;
  }

  const queueDepth = beginQueuedReplyVoiceSegment(targetPetId, queuedVoiceSegmentCountRef);
  const preparedPlaybackPromise = prepareQueuedReplyVoiceSegmentWithConcurrency({
    configRef,
    queuedVoicePreparationActiveCountRef,
    queuedVoicePreparationEpochRef,
    queuedVoicePreparationWaitersRef,
    segmentText,
    targetPetId,
  });
  void preparedPlaybackPromise.catch(() => undefined);

  const previousTask = queuedVoicePlaybackTaskRef.current.catch(() => undefined);
  const queueTask = previousTask
    .then(() => runQueuedReplyVoiceSegmentTask({
      configRef,
      playbackToken,
      preparedPlaybackPromise,
      publishStatusMessage,
      queueDepth,
      queuedVoicePlaybackCursorRef,
      queuedVoicePlaybackSessionsRef,
      queuedVoiceSegmentCountRef,
      segmentText,
      targetPetId,
      voicePlaybackTokenRef,
    }));

  queuedVoicePlaybackTaskRef.current = queueTask;
}
