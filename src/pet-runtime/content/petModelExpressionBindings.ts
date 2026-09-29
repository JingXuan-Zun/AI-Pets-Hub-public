import {
  type PetModelMotionBinding,
  type PetModelMotionKey,
} from '../../types';
import { type AvatarRuntimeManualExpressionSelection } from '../avatar-runtime/avatarRuntimeTypes';
import { type PetContentExpressionKey } from './petContentManifest';
import { isPetModelExpressionBinding } from './petModelMotionBindingKinds';

export const PET_MODEL_EXPRESSION_KEY_BY_MOTION_KEY: Partial<Record<PetModelMotionKey, PetContentExpressionKey>> = {
  eating: 'eating',
  happy: 'happy',
  idle: 'idle',
  sad: 'sad',
  sleeping: 'sleeping',
  'hover-body': 'hover-body',
  'hover-hand-left': 'hover-hand-left',
  'hover-hand-right': 'hover-hand-right',
  'hover-head': 'hover-head',
};

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(
    values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

function resolvePathBasename(value: string | undefined | null) {
  const sourceWithoutQuery = value?.trim().replace(/[?#].*$/u, '') ?? '';
  if (!sourceWithoutQuery || sourceWithoutQuery.startsWith('data:')) {
    return '';
  }

  return sourceWithoutQuery
    .replace(/\\/gu, '/')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/\.(exp3\.json|json|vrm|glb|gltf|fbx|vrma)$/iu, '')
    .trim() ?? '';
}

export function resolvePetContentExpressionKeyForMotionKey(
  motionKey: PetModelMotionKey,
  fallback: PetContentExpressionKey = 'idle',
): PetContentExpressionKey {
  return PET_MODEL_EXPRESSION_KEY_BY_MOTION_KEY[motionKey] ?? fallback;
}

export function resolvePetModelExpressionBindingCandidateNames(
  binding: PetModelMotionBinding,
) {
  return uniqueNonEmpty([
    binding.name,
    binding.id,
    ...(binding.clipNames ?? []),
    ...(binding.semanticAliases ?? []),
    resolvePathBasename(binding.sourceUrl),
    ...(binding.semanticTags ?? []),
    binding.motionKey,
  ]);
}

export function resolveAvatarRuntimeManualExpressionSelection(
  binding: PetModelMotionBinding | null | undefined,
): AvatarRuntimeManualExpressionSelection | null {
  if (!isPetModelExpressionBinding(binding)) {
    return null;
  }

  return {
    candidateExpressionNames: resolvePetModelExpressionBindingCandidateNames(binding),
    expressionKey: resolvePetContentExpressionKeyForMotionKey(binding.motionKey),
    weightMultiplier: 1,
  };
}
