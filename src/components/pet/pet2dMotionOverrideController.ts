import {
  resolvePetActionMotionMode,
  type PetActionMotionOverrideMode,
} from '../../pet-runtime/core/petActionStateMachine';
import {
  resolvePetContentMotionOverrideBehavior,
  type PetContentManifest,
} from '../../pet-runtime/content/petContentManifest';
import { type PetAction } from '../../types';
import { type PetMessageExpressionAction } from './usePetMessageExpressionAction';

export type Pet2DMotionOverrideSource =
  | 'message'
  | 'typing'
  | 'state-machine'
  | 'none';

export type Pet2DMotionOverrideState = {
  mode: PetActionMotionOverrideMode;
  pauseMovement: boolean;
  source: Pet2DMotionOverrideSource;
};

type ResolvePet2DMotionOverrideStateOptions = {
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  expressionAction?: PetMessageExpressionAction | null;
  isMoving?: boolean;
  isTyping?: boolean;
};

function resolvePet2DMotionReactionActionKey(
  action: PetMessageExpressionAction | null | undefined,
) {
  if (action === 'EATING') {
    return 'eating';
  }

  if (action === 'HAPPY') {
    return 'happy';
  }

  if (action === 'SAD') {
    return 'sad';
  }

  if (action === 'SLEEPING') {
    return 'sleeping';
  }

  return null;
}

function resolvePauseMovementFromOverrideMode(
  mode: PetActionMotionOverrideMode,
) {
  return mode !== 'preserve';
}

function resolveHasBaseLocomotion(action: PetAction, isMoving: boolean) {
  const motionMode = resolvePetActionMotionMode(action);
  return isMoving || motionMode === 'walking' || motionMode === 'running' || motionMode === 'swimming';
}

export function resolvePet2DMotionOverrideState({
  action = 'IDLE',
  contentManifest = null,
  expressionAction = null,
  isMoving = false,
  isTyping = false,
}: ResolvePet2DMotionOverrideStateOptions): Pet2DMotionOverrideState {
  const fallbackState: Pet2DMotionOverrideState = !expressionAction
    ? {
        mode: 'preserve',
        pauseMovement: false,
        source: isTyping ? 'typing' : 'none',
      }
    : expressionAction === 'EATING' || expressionAction === 'SLEEPING'
      ? {
        mode: 'replace',
        pauseMovement: true,
        source: 'message',
      }
      : expressionAction === 'HAPPY' || expressionAction === 'SAD'
        ? resolveHasBaseLocomotion(action, isMoving)
          ? {
          mode: 'preserve',
          pauseMovement: false,
          source: 'message',
            }
          : {
          mode: 'soft-stop',
          pauseMovement: true,
          source: 'message',
            }
        : {
          mode: 'preserve',
          pauseMovement: false,
          source: 'state-machine',
        };

  if (fallbackState.source !== 'message') {
    return fallbackState;
  }

  const configuredBehavior = resolvePetContentMotionOverrideBehavior(
    contentManifest,
    'message',
    resolvePet2DMotionReactionActionKey(expressionAction),
    isMoving,
  );

  if (!configuredBehavior?.mode) {
    return fallbackState;
  }

  return {
    mode: configuredBehavior.mode,
    pauseMovement: resolvePauseMovementFromOverrideMode(configuredBehavior.mode),
    source: fallbackState.source,
  };
}
