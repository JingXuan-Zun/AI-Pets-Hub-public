import { type PetConfig } from '../types';
import { listLocalVoiceAssets } from './catalog';

type Settings = PetConfig['settings'];

export const CONVERSATION_STT_MODEL_PATTERN = /sensevoice/iu;

// Hands-free conversation and wake listening always prefer SenseVoice when it is installed:
// it runs on CPU in ~0.3 s and leaves GPU memory to the character voice. Larger GPU models
// (e.g. Qwen3-ASR) can crash under memory pressure next to GPT-SoVITS.
export async function resolveConversationSttSettings(settings: Settings): Promise<{ settings: Settings } | { error: string }> {
  const assets = await listLocalVoiceAssets();
  const preferred = assets.sttModels.find((model) => CONVERSATION_STT_MODEL_PATTERN.test(model.id));
  if (preferred) {
    return { settings: { ...settings, sttProvider: 'local', localSttModelId: preferred.id } };
  }
  if (settings.sttProvider === 'local' && settings.localSttModelId.trim()) {
    return { settings };
  }
  return { error: '实时对话需要本地语音识别模型，请在 local-models/voice/stt 中放入 SenseVoice-Small。' };
}
