import {
  type ModelType,
  type PetModelMotionAssetFormat,
  type PetModelMotionBinding,
} from '../../types';

const LIVE2D_MOTION_FORMATS = new Set<PetModelMotionAssetFormat>(['motion3', 'exp3']);
const THREE_D_MOTION_FORMATS = new Set<PetModelMotionAssetFormat>(['vrma', 'fbx', 'glb', 'gltf']);

export function isPetModelMotionBindingCompatibleWithModelType(
  modelType: ModelType,
  binding: PetModelMotionBinding,
) {
  if (modelType === 'live2d') {
    return LIVE2D_MOTION_FORMATS.has(binding.format);
  }

  if (modelType === '3d') {
    return THREE_D_MOTION_FORMATS.has(binding.format);
  }

  return false;
}

export function filterPetModelMotionBindingsForModelType(
  modelType: ModelType,
  bindings: readonly PetModelMotionBinding[],
) {
  return bindings.filter((binding) => (
    isPetModelMotionBindingCompatibleWithModelType(modelType, binding)
  ));
}
