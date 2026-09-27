import { type ModelType, type PetModelMotionBinding, type PetModelPreset } from '../../types';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import {
  buildPetModelPresetContentManifest,
  mergePetContentManifests,
  resolvePetModelPresetForModel,
} from '../../pet-runtime/content/petModelMotionBindings';

type ResolvePetRuntimeContentSurfaceOptions = {
  contentManifest: PetContentManifest | null;
  customModelPresets?: PetModelPreset[];
  manualMotionBinding?: PetModelMotionBinding | null;
  modelType: ModelType;
  modelUrl: string;
};

type PetRuntimeContentSurface = {
  matchedModelPreset: PetModelPreset | null;
  mergedContentManifest: PetContentManifest | null;
  motionLibraryBindings: PetModelMotionBinding[];
  motionLibraryContentManifest: PetContentManifest | null;
};

export function resolvePetRuntimeContentSurface({
  contentManifest,
  customModelPresets = [],
  modelType,
  modelUrl,
}: ResolvePetRuntimeContentSurfaceOptions): PetRuntimeContentSurface {
  // 2D models do not need motion-library manifests, but they still need the
  // matched preset so custom sequenceFrames can reach the 2D renderer.
  const matchedModelPreset = resolvePetModelPresetForModel(
    modelType,
    modelUrl,
    customModelPresets,
  );

  if (modelType !== '3d' && modelType !== 'live2d') {
    return {
      matchedModelPreset,
      mergedContentManifest: contentManifest,
      motionLibraryBindings: [],
      motionLibraryContentManifest: null,
    };
  }

  const motionLibraryContentManifest = buildPetModelPresetContentManifest(matchedModelPreset);

  return {
    matchedModelPreset,
    mergedContentManifest: mergePetContentManifests(
      contentManifest,
      motionLibraryContentManifest,
    ),
    motionLibraryBindings: matchedModelPreset?.motionBindings ?? [],
    motionLibraryContentManifest,
  };
}
