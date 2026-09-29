import { getDesktopPetSlot, PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { type PetConfig, type PetModelMotionBinding } from '../../types';

export interface SettingsSkillTimelineBindingOption {
  label: string;
  value: string;
}

export function resolveSettingsSkillTimelineMotionBindings(
  config: PetConfig,
  targetPetId: string,
) {
  const slot = getDesktopPetSlot(config, targetPetId)
    ?? getDesktopPetSlot(config, PRIMARY_DESKTOP_PET_SLOT_ID);
  const preset = slot
    ? config.customModelPresets.find((item) => item.type === slot.modelType && item.url === slot.modelUrl)
      ?? config.customModelPresets.find((item) => item.url === slot.modelUrl)
    : null;

  return preset?.motionBindings ?? [];
}

export function resolveSettingsSkillTimelineCandidate(
  binding: PetModelMotionBinding | undefined,
) {
  if (!binding) {
    return '';
  }

  return binding.semanticAliases?.[0] ?? binding.name ?? binding.id;
}

function createBindingOption(binding: PetModelMotionBinding): SettingsSkillTimelineBindingOption {
  return {
    label: binding.name,
    value: resolveSettingsSkillTimelineCandidate(binding),
  };
}

export function createSettingsSkillTimelineBindingOptions(options: {
  config: PetConfig;
  kind: 'expression' | 'motion';
  targetPetId: string;
}): SettingsSkillTimelineBindingOption[] {
  return resolveSettingsSkillTimelineMotionBindings(options.config, options.targetPetId)
    .filter((binding) => (
      options.kind === 'expression'
        ? isPetModelExpressionBinding(binding)
        : !isPetModelExpressionBinding(binding)
    ))
    .map(createBindingOption);
}
