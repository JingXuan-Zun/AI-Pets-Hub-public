import { getDesktopPetSlot } from '../multiPetRoster';
import { type PetConfig } from '../types';

// Voice settings for one character: its own voice pack when it has one and the character voice
// provider is in use, otherwise the global settings unchanged.
export function resolvePetVoiceSettings(config: PetConfig, petId: string | null | undefined): PetConfig['settings'] {
  const settings = config.settings;
  if (settings.ttsProvider !== 'gpt-sovits' || !petId) return settings;
  const voicePackId = getDesktopPetSlot(config, petId)?.personality.voicePackId?.trim();
  return voicePackId ? { ...settings, gptSovitsModelId: voicePackId } : settings;
}
