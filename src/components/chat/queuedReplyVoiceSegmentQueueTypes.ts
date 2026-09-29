import { type MutableRefObject } from 'react';
import { type PetConfig } from '../../types';
import { type QueuedReplyVoicePlaybackRefs } from './queuedReplyVoicePlaybackTypes';

export interface EnqueueQueuedReplyVoiceSegmentOptions extends QueuedReplyVoicePlaybackRefs {
  configRef: MutableRefObject<PetConfig>;
  publishStatusMessage: (message: string) => void;
  text: string;
  playbackToken: number;
  targetPetId: string | null;
}
