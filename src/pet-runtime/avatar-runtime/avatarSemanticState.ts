import { type PetAction } from '../../types';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimeFocusTarget,
  type AvatarRuntimeHoverState,
  type AvatarRuntimeManualExpressionSelection,
  type AvatarRuntimeManualMotionSelection,
} from './avatarRuntimeTypes';

export type AvatarRuntimeSemanticSummary = {
  activeHoverRegion: string | null;
  hasFocusTarget: boolean;
  hasPointerLookTarget: boolean;
  interactionMode: 'dragging' | 'idle' | 'moving';
  lookAtTarget: AvatarRuntimeFocusTarget | null;
  pointerLookTarget: AvatarRuntimeFocusTarget | null;
  speechActive: boolean;
};

export type AvatarRuntimeSemanticState = {
  action: PetAction;
  dragState: AvatarRuntimeDragState | null;
  expressionAction: PetAction | null;
  focusTarget: AvatarRuntimeFocusTarget | null;
  hoverState: AvatarRuntimeHoverState | null;
  isMoving: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  latestMessage: string;
  manualExpressionSelection: AvatarRuntimeManualExpressionSelection | null;
  manualMotionSelection: AvatarRuntimeManualMotionSelection | null;
  pointerLookTarget: AvatarRuntimeFocusTarget | null;
  summary: AvatarRuntimeSemanticSummary;
};

type CreateAvatarRuntimeSemanticStateOptions = {
  action?: PetAction;
  dragState?: AvatarRuntimeDragState | null;
  expressionAction?: PetAction | null;
  focusTarget?: AvatarRuntimeFocusTarget | null;
  hoverState?: AvatarRuntimeHoverState | null;
  isMoving?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  latestMessage?: string;
  manualExpressionSelection?: AvatarRuntimeManualExpressionSelection | null;
  manualMotionSelection?: AvatarRuntimeManualMotionSelection | null;
  pointerLookTarget?: AvatarRuntimeFocusTarget | null;
};

function resolveInteractionMode(
  dragState: AvatarRuntimeDragState | null | undefined,
  isMoving: boolean,
): AvatarRuntimeSemanticSummary['interactionMode'] {
  if (dragState?.active) {
    return 'dragging';
  }

  return isMoving ? 'moving' : 'idle';
}

export function createAvatarRuntimeSemanticState({
  action = 'IDLE',
  dragState = null,
  expressionAction = null,
  focusTarget = null,
  hoverState = null,
  isMoving = false,
  isSpeaking = false,
  isTyping = false,
  latestMessage = '',
  manualExpressionSelection = null,
  manualMotionSelection = null,
  pointerLookTarget = null,
}: CreateAvatarRuntimeSemanticStateOptions = {}): AvatarRuntimeSemanticState {
  return {
    action,
    dragState,
    expressionAction,
    focusTarget,
    hoverState,
    isMoving,
    isSpeaking,
    isTyping,
    latestMessage,
    manualExpressionSelection,
    manualMotionSelection,
    pointerLookTarget,
    summary: {
      activeHoverRegion: hoverState?.activeRegion ?? null,
      hasFocusTarget: focusTarget !== null,
      hasPointerLookTarget: pointerLookTarget !== null,
      interactionMode: resolveInteractionMode(dragState, isMoving),
      lookAtTarget: focusTarget,
      pointerLookTarget,
      speechActive: isSpeaking || isTyping,
    },
  };
}
