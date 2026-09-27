import {
  type PetModelMotionAssetFormat,
  type PetModelMotionBinding,
} from '../../types';

export function isPetModelExpressionBinding(binding: PetModelMotionBinding | null | undefined) {
  return Boolean(binding && (binding.kind === 'expression' || binding.format === 'exp3'));
}

export type PetModelPlayableMotionBinding = PetModelMotionBinding & {
  format: Exclude<PetModelMotionAssetFormat, 'exp3'>;
  kind?: 'motion';
};

export function isPetModelMotionBinding(
  binding: PetModelMotionBinding | null | undefined,
): binding is PetModelPlayableMotionBinding {
  return Boolean(binding && !isPetModelExpressionBinding(binding));
}
