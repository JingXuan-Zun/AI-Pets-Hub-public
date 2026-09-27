export const PET_LAYER_Z_INDEX = {
  primary: 10,
  companion: 12,
  selected: 14,
  interactiveDialogue: 28,
  dragging: 32,
} as const;

export function resolvePrimaryPetLayerZIndex({
  isDragging,
  isInteractiveDialogueMode,
  isSelected = false,
}: {
  isDragging: boolean;
  isInteractiveDialogueMode: boolean;
  isSelected?: boolean;
}) {
  if (isInteractiveDialogueMode) {
    return PET_LAYER_Z_INDEX.interactiveDialogue;
  }

  if (isDragging) {
    return PET_LAYER_Z_INDEX.dragging;
  }

  return isSelected ? PET_LAYER_Z_INDEX.selected : PET_LAYER_Z_INDEX.primary;
}

export function resolveCompanionPetLayerZIndex({
  isDragging,
  isInteractiveDialogueMode,
  isSelected = false,
}: {
  isDragging: boolean;
  isInteractiveDialogueMode: boolean;
  isSelected?: boolean;
}) {
  if (isInteractiveDialogueMode) {
    return PET_LAYER_Z_INDEX.interactiveDialogue;
  }

  if (isDragging) {
    return PET_LAYER_Z_INDEX.dragging;
  }

  return isSelected ? PET_LAYER_Z_INDEX.selected : PET_LAYER_Z_INDEX.companion;
}
