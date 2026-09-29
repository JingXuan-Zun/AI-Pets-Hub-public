import { useEffect, useMemo, useState } from 'react';
import {
  resolveAvatar3DExpressionControllerState,
  type Avatar3DExpressionControllerState,
} from './avatar3dExpressionController';
import {
  resolveAvatar3DLipSyncControllerState,
  type Avatar3DLipSyncControllerState,
} from './avatar3dLipSyncController';
import {
  resolveAvatar3DInteractionControllerState,
  type Avatar3DInteractionControllerState,
} from './avatar3dInteractionController';
import { type PetMessageExpressionAction } from '../interactions/petMessageExpressionSignals';
import { type PetHoverInteractionState } from '../interactions/petHoverInteractionController';
import {
  resolveAvatar3DMotionOverrideState,
  type Avatar3DMotionOverrideState,
} from './avatar3dMotionOverrideController';
import { type PetAction } from '../../types';
import { type PetContentManifest } from '../content/petContentManifest';
import { type AvatarRuntimeManualExpressionSelection } from '../avatar-runtime/avatarRuntimeTypes';

const LIP_SYNC_REFRESH_INTERVAL_MS = 90;

export type Avatar3DReactionState = {
  expressionState: Avatar3DExpressionControllerState;
  interactionState: Avatar3DInteractionControllerState;
  lipSyncState: Avatar3DLipSyncControllerState;
  motionOverrideState: Avatar3DMotionOverrideState;
};

type UseAvatar3DReactionStateOptions = {
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  expressionAction?: PetMessageExpressionAction | null;
  hoverInteractionState?: PetHoverInteractionState;
  isMoving?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  latestMessage?: string;
  manualExpressionSelection?: AvatarRuntimeManualExpressionSelection | null;
};

export function useAvatar3DReactionState({
  action = 'IDLE',
  contentManifest = null,
  expressionAction = null,
  hoverInteractionState,
  isMoving = false,
  isSpeaking = false,
  isTyping = false,
  latestMessage = '',
  manualExpressionSelection = null,
}: UseAvatar3DReactionStateOptions): Avatar3DReactionState {
  const [timestampMs, setTimestampMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isSpeaking) {
      setTimestampMs(Date.now());
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimestampMs(Date.now());
    }, LIP_SYNC_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSpeaking]);

  return useMemo(() => {
    const expressionState = resolveAvatar3DExpressionControllerState({
      fallbackExpressionAction: null,
      hoverInteractionEvent: hoverInteractionState?.activeEvent,
      isTyping,
      latestMessage,
      manualExpressionSelection,
      messageExpressionAction: expressionAction,
    });
    const interactionState = resolveAvatar3DInteractionControllerState(hoverInteractionState);
    const lipSyncState = resolveAvatar3DLipSyncControllerState({
      isSpeaking,
      timestampMs,
    });

    return {
      expressionState,
      interactionState,
      lipSyncState,
      motionOverrideState: resolveAvatar3DMotionOverrideState({
        action,
        contentManifest,
        expressionState,
        isMoving,
        lipSyncState,
      }),
    };
  }, [action, contentManifest, expressionAction, hoverInteractionState, isMoving, isSpeaking, isTyping, latestMessage, manualExpressionSelection, timestampMs]);
}
