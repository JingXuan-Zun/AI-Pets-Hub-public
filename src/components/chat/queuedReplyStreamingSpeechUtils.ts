import { extractReadySpeechSegments, resolveStreamingSpeechSegmentation } from './streamingSpeechSegmentationUtils';
import { type StreamingSpeechSegmentationProfile } from './streamingSpeechSegmentationTypes';

export function extractQueuedReplyStreamingSpeech(
  buffer: string,
  hasQueuedSpeechSegment: boolean,
  queuedSegmentCount: number,
  profile: StreamingSpeechSegmentationProfile = {},
) {
  return extractReadySpeechSegments(
    buffer,
    resolveStreamingSpeechSegmentation(hasQueuedSpeechSegment, queuedSegmentCount, profile),
  );
}
