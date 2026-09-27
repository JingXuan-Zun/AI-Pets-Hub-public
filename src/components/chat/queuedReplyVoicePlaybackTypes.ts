import { type MutableRefObject } from 'react';
import { type VoicePlaybackSession } from '../../voice/types';

export type QueuedVoicePreparationWaiter = {
  epoch: number;
  resolve: (granted: boolean) => void;
};

export interface QueuedReplyVoicePlaybackRefs {
  queuedVoicePlaybackCursorRef: MutableRefObject<number | null>;
  queuedVoicePlaybackSessionsRef: MutableRefObject<Set<VoicePlaybackSession>>;
  queuedVoicePreparationActiveCountRef: MutableRefObject<number>;
  queuedVoicePreparationEpochRef: MutableRefObject<number>;
  queuedVoicePreparationWaitersRef: MutableRefObject<QueuedVoicePreparationWaiter[]>;
  queuedVoicePlaybackTaskRef: MutableRefObject<Promise<void>>;
  queuedVoiceSegmentCountRef: MutableRefObject<number>;
  voicePlaybackTokenRef: MutableRefObject<number>;
}
