export const PET_LAYER_Z_INDEX = {
  primary: 10,
  companion: 12,
  selected: 14,
  dragging: 32,
} as const;

export function resolvePrimaryPetLayerZIndex({
  isDragging,
  isSelected = false,
}: {
  isDragging: boolean;
  isSelected?: boolean;
}) {

  if (isDragging) {
    return PET_LAYER_Z_INDEX.dragging;
  }

  return isSelected ? PET_LAYER_Z_INDEX.selected : PET_LAYER_Z_INDEX.primary;
}

export function resolveCompanionPetLayerZIndex({
  isDragging,
  isSelected = false,
}: {
  isDragging: boolean;
  isSelected?: boolean;
}) {

  if (isDragging) {
    return PET_LAYER_Z_INDEX.dragging;
  }

  return isSelected ? PET_LAYER_Z_INDEX.selected : PET_LAYER_Z_INDEX.companion;
}
