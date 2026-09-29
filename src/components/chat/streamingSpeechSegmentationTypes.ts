export interface ReadySpeechSegmentOptions {
  flushAll?: boolean;
  softLimit?: number;
  hardLimit?: number;
  strongBreakMinLength?: number;
  softBreakMinLength?: number;
  allowSoftBreaks?: boolean;
}

export interface StreamingSpeechSegmentationProfile {
  voiceToneStability?: number;
}
