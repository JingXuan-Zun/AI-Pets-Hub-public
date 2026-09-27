import { type BrowserTtsHealth, type LocalVoiceAssets, type LocalVoiceHealth } from '../types';
import { type VoicePlaybackSession } from './types';

export const EMPTY_LOCAL_VOICE_ASSETS: LocalVoiceAssets = {
  rootPath: null,
  ttsModels: [],
  sttModels: [],
  references: [],
};

export const EMPTY_LOCAL_VOICE_HEALTH: LocalVoiceHealth = {
  available: false,
  status: 'idle',
  runtimeLabel: null,
  executable: null,
  pythonVersion: null,
  device: 'unknown',
  ttsReady: false,
  sttReady: false,
  referenceReady: false,
  missingPackages: [],
  detectedPackages: [],
  messages: [],
};

export const EMPTY_BROWSER_TTS_HEALTH: BrowserTtsHealth = {
  available: false,
  status: 'idle',
  running: false,
  url: null,
  executable: null,
  error: null,
  missingPackages: [],
};

export function createSilentPlaybackSession(): VoicePlaybackSession {
  return {
    stop: () => undefined,
    done: Promise.resolve(),
  };
}

export function resolveLocalTtsModelLabel(localVoiceAssets: LocalVoiceAssets, modelId: string) {
  return localVoiceAssets.ttsModels.find((model) => model.id === modelId)?.label ?? modelId;
}

export function resolveLocalSttModelLabel(localVoiceAssets: LocalVoiceAssets, modelId: string) {
  return localVoiceAssets.sttModels.find((model) => model.id === modelId)?.label ?? modelId;
}

export function resolveLocalReferenceLabel(localVoiceAssets: LocalVoiceAssets, referenceId: string) {
  return localVoiceAssets.references.find((reference) => reference.id === referenceId)?.label ?? referenceId;
}
