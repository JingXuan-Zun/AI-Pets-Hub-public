import { type PetModelMotionBinding } from '../../types';
import {
  extractCharacterAnimationToolIds,
  resolveCharacterAnimationBindingQueue,
} from '../chat/characterAnimationToolProtocol';

export function resolveExplicitAnimationToolIds(latestMessage: string) {
  return extractCharacterAnimationToolIds(latestMessage);
}

export function resolveMessageAnimationBindingQueue(
  latestMessage: string,
  motionBindings: PetModelMotionBinding[],
  queuedAnimationIds: string[] = [],
  maxQueueLength?: number,
) {
  return resolveCharacterAnimationBindingQueue(
    latestMessage,
    motionBindings,
    queuedAnimationIds,
    maxQueueLength,
  );
}

export function buildMotionBindingSignature(motionBindings: PetModelMotionBinding[]) {
  return motionBindings
    .map((binding) => `${binding.id}:${binding.kind ?? ''}:${binding.format}:${binding.motionKey}:${binding.name}:${binding.sourceUrl}:${binding.durationMs ?? ''}`)
    .join('|');
}
