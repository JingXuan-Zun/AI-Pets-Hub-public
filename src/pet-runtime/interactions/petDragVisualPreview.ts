import { type PetRuntimePosition } from '../core/petRuntimeTypes';

export type PetDragVisualPreview = {
  position: PetRuntimePosition;
  previousPosition: PetRuntimePosition;
};

export type PetDragVisualPreviewHandler = (preview: PetDragVisualPreview) => void;

export type PetDragVisualPreviewSurface = {
  previewPosition: (
    position: PetRuntimePosition,
    previousPosition: PetRuntimePosition,
  ) => void;
};

export function resolvePetDragVisualPreviewDelta(
  preview: PetDragVisualPreview,
): PetRuntimePosition {
  return {
    x: preview.position.x - preview.previousPosition.x,
    y: preview.position.y - preview.previousPosition.y,
  };
}
