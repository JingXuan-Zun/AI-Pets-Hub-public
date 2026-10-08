import { type PetConfig } from '../../types';
import { STREAM_TTS_GPT_SOVITS_VOICE_TONE_STABILITY } from './streamingSpeechSegmentationConfig';
import { extractReadySpeechSegments, resolveStreamingSpeechSegmentation } from './streamingSpeechSegmentationUtils';
import { type StreamingSpeechSegmentationProfile } from './streamingSpeechSegmentationTypes';

export function resolveReplySpeechSegmentationProfile(settings: PetConfig['settings']): StreamingSpeechSegmentationProfile {
  switch (settings.ttsProvider) {
    case 'local':
      return { voiceToneStability: settings.localTtsVoiceToneStability };
    case 'gpt-sovits':
      return { voiceToneStability: STREAM_TTS_GPT_SOVITS_VOICE_TONE_STABILITY };
    default:
      return {};
  }
}

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
