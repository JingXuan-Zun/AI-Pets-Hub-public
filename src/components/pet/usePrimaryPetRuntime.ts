import { usePetContentManifest } from '../../pet-runtime/content/usePetContentManifest';
import { type PetAction } from '../../types';
import { usePet2DReactionState } from './usePet2DReactionState';
import { usePetBehavior, type UsePetBehaviorOptions } from './usePetBehavior';

interface UsePrimaryPetRuntimeOptions extends Omit<UsePetBehaviorOptions, 'isReactionMovementPaused'> {
  actionOverride?: PetAction | null;
  isTyping?: boolean;
  latestMessage?: string;
}

export function usePrimaryPetRuntime({
  actionOverride = null,
  config,
  isTyping = false,
  latestMessage = '',
  ...behaviorOptions
}: UsePrimaryPetRuntimeOptions) {
  const { manifest: contentManifest } = usePetContentManifest(
    config.modelType === '2d' ? config.modelUrl : '',
  );
  const reactionState = usePet2DReactionState({
    action: actionOverride ?? config.currentAction,
    contentManifest,
    isTyping,
    latestMessage,
  });
  const behaviorState = usePetBehavior({
    ...behaviorOptions,
    config,
    isReactionMovementPaused: reactionState.motionOverrideState.pauseMovement,
  });

  return {
    ...behaviorState,
    reactionState,
  };
}
