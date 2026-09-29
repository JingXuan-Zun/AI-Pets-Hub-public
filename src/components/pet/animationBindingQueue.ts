import { type PetModelMotionBinding } from '../../types';

export interface MergeIncomingAnimationBindingsOptions {
  preserveRepeats?: boolean;
}

function motionBindingIdsStartWith(leftIds: string[], rightIds: string[]) {
  return rightIds.length > 0
    && leftIds.length >= rightIds.length
    && rightIds.every((rightId, index) => leftIds[index] === rightId);
}

function normalizeIncomingAnimationBindings(bindings: PetModelMotionBinding[]) {
  return bindings.filter((binding, index) => index === 0 || bindings[index - 1]?.id !== binding.id);
}

export function mergeIncomingAnimationBindingsIntoQueue(
  activeBinding: PetModelMotionBinding | null,
  queuedBindings: PetModelMotionBinding[],
  incomingBindings: PetModelMotionBinding[],
  options: MergeIncomingAnimationBindingsOptions = {},
) {
  const normalizedIncomingBindings = options.preserveRepeats
    ? incomingBindings
    : normalizeIncomingAnimationBindings(incomingBindings);
  if (normalizedIncomingBindings.length === 0) {
    return queuedBindings;
  }

  const currentRemainingBindings = [
    ...(activeBinding ? [activeBinding] : []),
    ...queuedBindings,
  ];
  const currentRemainingIds = currentRemainingBindings.map((binding) => binding.id);
  const incomingIds = normalizedIncomingBindings.map((binding) => binding.id);

  if (!options.preserveRepeats && motionBindingIdsStartWith(currentRemainingIds, incomingIds)) {
    return queuedBindings;
  }

  const incomingSuffixBindings = !options.preserveRepeats && motionBindingIdsStartWith(incomingIds, currentRemainingIds)
    ? normalizedIncomingBindings.slice(currentRemainingIds.length)
    : normalizedIncomingBindings;
  if (incomingSuffixBindings.length === 0) {
    return queuedBindings;
  }

  const nextQueuedBindings = [...queuedBindings];
  let lastScheduledBinding = currentRemainingBindings[currentRemainingBindings.length - 1] ?? null;

  incomingSuffixBindings.forEach((binding) => {
    if (!options.preserveRepeats && lastScheduledBinding?.id === binding.id) {
      return;
    }

    nextQueuedBindings.push(binding);
    lastScheduledBinding = binding;
  });

  return nextQueuedBindings;
}
