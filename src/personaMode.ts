import { applyDesktopPetSlotChanges, getDesktopPetSlot } from './multiPetRoster';
import type { PetConfig, PetPersonality } from './types';

// A character runs one of two modes (2026-11-19, docs/character-growth-design-20261119.md):
//   - 人格提示词 ('prompt'): the persona prompt and classic memory;
//   - 知识记忆人格 ('memory'): the same persona prompt (the user's own) plus the knowledge-memory
//     graph, where she grows from experience.
// One or the other, switched on her slot (settings) or by herself with the user's approval.
// Stored as personality.neuralPersonaChatEnabled.

export type PersonaMode = 'memory' | 'prompt';

export const PERSONA_MODE_LABELS: Record<PersonaMode, string> = {
  memory: '知识记忆人格',
  prompt: '人格提示词',
};

export function readPersonaMode(personality: Pick<PetPersonality, 'neuralPersonaChatEnabled'>): PersonaMode {
  return personality.neuralPersonaChatEnabled === true ? 'memory' : 'prompt';
}

/** The config with this slot switched to the mode (unchanged when it already is). */
export function withPersonaMode(config: PetConfig, slotId: string, mode: PersonaMode): PetConfig {
  const slot = getDesktopPetSlot(config, slotId);
  if (!slot || readPersonaMode(slot.personality) === mode) return config;
  return applyDesktopPetSlotChanges(config, slotId, {
    personality: { ...slot.personality, neuralPersonaChatEnabled: mode === 'memory' },
  });
}
