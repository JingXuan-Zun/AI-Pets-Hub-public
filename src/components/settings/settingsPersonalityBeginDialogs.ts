import type { PetConfig, PetPersonality } from '../../types';

export function removeEmptyBeginDialogDrafts(config: PetConfig): PetConfig {
  const removeEmptyDialogs = (personality: PetPersonality): PetPersonality => ({
    ...personality,
    beginDialogs: personality.beginDialogs.filter((dialog) => (
      dialog.user.trim().length > 0 || dialog.assistant.trim().length > 0
    )),
  });

  return {
    ...config,
    personality: removeEmptyDialogs(config.personality),
    companionPets: config.companionPets.map((pet) => ({
      ...pet,
      personality: removeEmptyDialogs(pet.personality),
    })),
  };
}
