import { type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { type QueuedReplyVoicePlaybackRefs } from './queuedReplyVoicePlaybackTypes';

export function stopQueuedReplyVoicePlayback({
  queuedVoicePlaybackCursorRef,
  queuedVoicePlaybackSessionsRef,
  queuedVoicePreparationActiveCountRef,
  queuedVoicePreparationEpochRef,
  queuedVoicePreparationWaitersRef,
  queuedVoicePlaybackTaskRef,
  queuedVoiceSegmentCountRef,
}: Pick<
  QueuedReplyVoicePlaybackRefs,
  'queuedVoicePlaybackCursorRef'
  | 'queuedVoicePlaybackSessionsRef'
  | 'queuedVoicePreparationActiveCountRef'
  | 'queuedVoicePreparationEpochRef'
  | 'queuedVoicePreparationWaitersRef'
  | 'queuedVoicePlaybackTaskRef'
  | 'queuedVoiceSegmentCountRef'
>) {
  queuedVoicePlaybackSessionsRef.current.forEach((session) => {
    session.stop();
  });
  queuedVoicePlaybackSessionsRef.current.clear();
  queuedVoicePlaybackCursorRef.current = null;
  queuedVoicePreparationEpochRef.current += 1;
  queuedVoicePreparationActiveCountRef.current = 0;
  queuedVoicePreparationWaitersRef.current.forEach((waiter) => waiter.resolve(false));
  queuedVoicePreparationWaitersRef.current = [];
  queuedVoicePlaybackTaskRef.current = Promise.resolve();
  queuedVoiceSegmentCountRef.current = 0;
  desktopPetChatStore.setSpeechExpressionAction(
    desktopPetChatStore.getState().speakingPetId,
    null,
  );
}

export function finalizeQueuedReplySegmentCount(queuedVoiceSegmentCountRef: MutableRefObject<number>) {
  queuedVoiceSegmentCountRef.current = Math.max(0, queuedVoiceSegmentCountRef.current - 1);
}
