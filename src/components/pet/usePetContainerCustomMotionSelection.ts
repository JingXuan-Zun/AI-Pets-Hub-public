import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getDesktopPetSlot } from '../../multiPetRoster';
import { type PetConfig, type PetModelMotionBinding } from '../../types';
import { resolvePetModelMotionBindingsForModel } from '../../pet-runtime/content/petModelMotionBindings';
import { canModelTypeUseMotionBindings } from '../../pet-runtime/live2d/live2dModelSupport';

export type SelectedCustomMotionBindingMap = Record<string, PetModelMotionBinding | undefined>;

function refreshSelectedCustomMotionBindings(
  previousSelections: SelectedCustomMotionBindingMap,
  config: PetConfig,
) {
  let hasChanges = false;
  const nextSelections: SelectedCustomMotionBindingMap = {};

  Object.entries(previousSelections).forEach(([petId, selectedBinding]) => {
    if (!selectedBinding) {
      return;
    }

    const targetSlot = getDesktopPetSlot(config, petId);
    if (!targetSlot || !canModelTypeUseMotionBindings(targetSlot.modelType)) {
      hasChanges = true;
      return;
    }

    const availableBindings = resolvePetModelMotionBindingsForModel(
      targetSlot.modelType,
      targetSlot.modelUrl,
      config.customModelPresets,
    );
    const refreshedBinding = availableBindings.find((binding) => binding.id === selectedBinding.id) ?? null;

    if (!refreshedBinding) {
      hasChanges = true;
      return;
    }

    nextSelections[petId] = refreshedBinding;
    if (refreshedBinding !== selectedBinding) {
      hasChanges = true;
    }
  });

  return hasChanges ? nextSelections : previousSelections;
}

interface UsePetContainerCustomMotionSelectionResult {
  selectedCustomMotionByPetId: SelectedCustomMotionBindingMap;
  setSelectedCustomMotionByPetId: Dispatch<SetStateAction<SelectedCustomMotionBindingMap>>;
}

export function usePetContainerCustomMotionSelection(
  config: PetConfig,
): UsePetContainerCustomMotionSelectionResult {
  const [selectedCustomMotionByPetId, setSelectedCustomMotionByPetId] = useState<SelectedCustomMotionBindingMap>({});

  useEffect(() => {
    setSelectedCustomMotionByPetId((previousSelections) => (
      refreshSelectedCustomMotionBindings(previousSelections, config)
    ));
  }, [config]);

  return {
    selectedCustomMotionByPetId,
    setSelectedCustomMotionByPetId,
  };
}
