import { type PetConfig } from '../../types';
import { getVoiceErrorMessage } from '../../voice/errorMessages';

const LOCAL_VOICE_CONFIGURATION_HINT =
  '\u8bf7\u68c0\u67e5\u672c\u5730\u8bed\u97f3\u6a21\u578b\u3001\u53c2\u8003\u97f3\u9891\u548c\u4f9d\u8d56\u914d\u7f6e\u3002';

export function buildVoicePlaybackFailedMessage(error: unknown) {
  const detail = getVoiceErrorMessage(error, LOCAL_VOICE_CONFIGURATION_HINT);
  return `\u8bed\u97f3\u64ad\u62a5\u5931\u8d25\uff1a${detail}\uff0c\u5df2\u56de\u9000\u5230\u6587\u5b57\u56de\u590d\u3002`;
}

export function buildManualVoicePlaybackFailedMessage(error: unknown) {
  const detail = getVoiceErrorMessage(error, LOCAL_VOICE_CONFIGURATION_HINT);
  return `\u8fd9\u6761\u56de\u590d\u7684\u8bed\u97f3\u64ad\u653e\u5931\u8d25\uff1a${detail}`;
}

export function buildNextVoiceConfig(currentConfig: PetConfig) {
  return {
    ...currentConfig,
    settings: {
      ...currentConfig.settings,
      voiceEnabled: !currentConfig.settings.voiceEnabled,
    },
  };
}
