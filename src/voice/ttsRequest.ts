import { prepareSpeechText } from './speechText';
import { type VoicePlaybackOptions, type VoiceSettings } from './types';

export type TtsProvider = VoiceSettings['ttsProvider'];

export type ResolvedTtsRequest = {
  preparedText: string;
  provider: TtsProvider;
};

export function resolveTtsProvider(settings: VoiceSettings): TtsProvider {
  switch (settings.ttsProvider) {
    case 'api':
    case 'local':
      return settings.ttsProvider;
    case 'browser':
    default:
      return 'browser';
  }
}

export function resolveTtsRequest(
  text: string,
  settings: VoiceSettings,
  options: VoicePlaybackOptions = {},
): ResolvedTtsRequest | null {
  const preparedText = prepareSpeechText(text, settings);

  if (
    !preparedText.trim()
    || (
      !options.force
      && (!settings.voiceEnabled || !settings.autoSpeakResponses)
    )
  ) {
    return null;
  }

  return {
    preparedText,
    provider: resolveTtsProvider(settings),
  };
}
