import { useMemo } from 'react';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { type PetAction } from '../../types';
import {
  resolvePet2DMotionOverrideState,
  type Pet2DMotionOverrideState,
} from './pet2dMotionOverrideController';
import {
  usePetMessageExpressionAction,
  type PetMessageExpressionAction,
} from './usePetMessageExpressionAction';

export type Pet2DReactionState = {
  expressionAction: PetMessageExpressionAction | null;
  motionOverrideState: Pet2DMotionOverrideState;
};

type ResolvePet2DReactionStateOptions = {
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  expressionAction?: PetMessageExpressionAction | null;
  isMoving?: boolean;
  isTyping?: boolean;
};

type UsePet2DReactionStateOptions = ResolvePet2DReactionStateOptions & {
  durationMs?: number;
  latestMessage?: string;
};

export function resolvePet2DReactionState({
  action = 'IDLE',
  contentManifest = null,
  expressionAction = null,
  isMoving = false,
  isTyping = false,
}: ResolvePet2DReactionStateOptions): Pet2DReactionState {
  return {
    expressionAction,
    motionOverrideState: resolvePet2DMotionOverrideState({
      action,
      contentManifest,
      expressionAction,
      isMoving,
      isTyping,
    }),
  };
}

export function usePet2DReactionState({
  action = 'IDLE',
  contentManifest = null,
  durationMs,
  isMoving = false,
  isTyping = false,
  latestMessage = '',
}: UsePet2DReactionStateOptions): Pet2DReactionState {
  const expressionAction = usePetMessageExpressionAction(latestMessage, isTyping, durationMs);

  return useMemo(() => (
    resolvePet2DReactionState({
      action,
      contentManifest,
      expressionAction,
      isMoving,
      isTyping,
    })
  ), [action, contentManifest, expressionAction, isMoving, isTyping]);
}
