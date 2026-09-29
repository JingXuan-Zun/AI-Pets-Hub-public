import { useEffect, useMemo, useRef } from 'react';
import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import { type PetAction, type PetModelMotionKey } from '../../../types';
import { resolvePetMotionKeyForAction } from '../../content/petModelMotionBindings';
import { useAvatar3DReactionState } from '../../avatar3d/useAvatar3DReactionState';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimeFocusTarget,
  type AvatarRuntimeHoverState,
  type AvatarRuntimeManualExpressionSelection,
  type AvatarRuntimePresentationMode,
  type AvatarRuntimeViewport,
} from '../avatarRuntimeTypes';
import {
  createUnityHideAvatarCommand,
  createUnityLayoutCommand,
  createUnityLoadAvatarCommand,
  createUnitySemanticStateCommand,
  createUnityVisibilityCommand,
  resolveUnityAvatarRuntimeCommandSurface,
} from './unityBridgeCommandSurface';

const DEFAULT_PET_ID = 'main';

const UNITY_EXPRESSION_KEY_BY_ACTION: Partial<Record<PetAction, string>> = {
  EATING: 'happy',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'relaxed',
};

type UseUnityAvatarRuntimeMirrorOptions = {
  action: PetAction;
  dragState?: AvatarRuntimeDragState | null;
  expressionAction?: PetAction | null;
  focusTarget?: AvatarRuntimeFocusTarget | null;
  hoverState?: AvatarRuntimeHoverState | null;
  isMoving?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  latestMessage?: string;
  manualExpressionSelection?: AvatarRuntimeManualExpressionSelection | null;
  manualMotionKey?: PetModelMotionKey | null;
  modelUrl: string;
  petId?: string;
  presentationMode?: AvatarRuntimePresentationMode;
  scale?: number;
  viewport?: AvatarRuntimeViewport | null;
  visible?: boolean;
};

function resolveUnityExpressionKey(action: PetAction | null | undefined) {
  return action ? UNITY_EXPRESSION_KEY_BY_ACTION[action] ?? '' : '';
}

function resolveUnityManualExpressionKey(
  selection?: AvatarRuntimeManualExpressionSelection | null,
) {
  return selection?.candidateExpressionNames.find((candidate) => candidate.trim())?.trim()
    ?? selection?.expressionKey
    ?? '';
}

export function useUnityAvatarRuntimeMirror({
  action,
  dragState = null,
  expressionAction = null,
  focusTarget = null,
  hoverState = null,
  isMoving = false,
  isSpeaking = false,
  isTyping = false,
  latestMessage = '',
  manualExpressionSelection = null,
  manualMotionKey = null,
  modelUrl,
  petId = DEFAULT_PET_ID,
  presentationMode = 'default',
  scale = 1,
  viewport = null,
  visible = true,
}: UseUnityAvatarRuntimeMirrorOptions) {
  const desktopMode = desktopPetShellRuntime.isDesktopMode();
  const hasActivatedUnityAvatarRef = useRef(false);
  const reactionState = useAvatar3DReactionState({
    action,
    expressionAction: expressionAction as Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'> | null,
    isMoving,
    isSpeaking,
    isTyping,
    latestMessage,
    manualExpressionSelection,
  });
  const motionKey = useMemo<PetModelMotionKey>(() => (
    manualMotionKey?.trim()
      ? manualMotionKey
      : resolvePetMotionKeyForAction(action)
  ), [action, manualMotionKey]);
  const expressionKey = useMemo(() => (
    isTyping
      ? ''
      : resolveUnityManualExpressionKey(manualExpressionSelection)
        || resolveUnityExpressionKey(reactionState.expressionState.activeAction)
  ), [isTyping, manualExpressionSelection, reactionState.expressionState.activeAction]);
  const commandSurface = useMemo(() => (
    resolveUnityAvatarRuntimeCommandSurface({
      dragState,
      expressionKey,
      focusTarget,
      hoverState,
      modelUrl,
      motionKey,
      petId,
      presentationMode,
      scale,
      visible,
      viewport,
      viseme: reactionState.lipSyncState.viseme ?? '',
    })
  ), [
    dragState,
    expressionKey,
    focusTarget,
    hoverState,
    modelUrl,
    motionKey,
    petId,
    presentationMode,
    reactionState.lipSyncState.viseme,
    scale,
    visible,
    viewport,
  ]);
  const trimmedModelUrl = commandSurface.modelUrl;
  const normalizedPetId = commandSurface.petId;
  const {
    dragActive,
    dragDeltaX,
    dragDeltaY,
    expressionKey: resolvedExpressionKey,
    hoverRegion,
    lookAtX,
    lookAtY,
    motionKey: resolvedMotionKey,
    presentationMode: resolvedPresentationMode,
    scale: resolvedScale,
    screenHeight,
    screenWidth,
    visible: resolvedVisible,
    viewportHeight,
    viewportWidth,
    viewportX,
    viewportY,
    viseme: resolvedViseme,
  } = commandSurface;

  useEffect(() => {
    if (!desktopMode) {
      return;
    }

    return () => {
      if (!hasActivatedUnityAvatarRef.current) {
        return;
      }

      void desktopPetShellRuntime.sendUnityBridgeCommand(
        createUnityHideAvatarCommand(normalizedPetId),
      );
    };
  }, [desktopMode, normalizedPetId]);

  useEffect(() => {
    if (!desktopMode || !trimmedModelUrl) {
      return;
    }

    hasActivatedUnityAvatarRef.current = true;
    void desktopPetShellRuntime.sendUnityBridgeCommand(
      createUnityLoadAvatarCommand({
        modelUrl: trimmedModelUrl,
        petId: normalizedPetId,
      }),
    );
  }, [desktopMode, normalizedPetId, trimmedModelUrl]);

  useEffect(() => {
    if (!desktopMode || !trimmedModelUrl) {
      return;
    }

    void desktopPetShellRuntime.sendUnityBridgeCommand(
      createUnityLayoutCommand({
        petId: normalizedPetId,
        presentationMode: resolvedPresentationMode,
        scale: resolvedScale,
        screenHeight,
        screenWidth,
        viewportHeight,
        viewportWidth,
        viewportX,
        viewportY,
      }),
    );
  }, [
    desktopMode,
    normalizedPetId,
    resolvedPresentationMode,
    resolvedScale,
    screenHeight,
    screenWidth,
    trimmedModelUrl,
    viewportHeight,
    viewportWidth,
    viewportX,
    viewportY,
  ]);

  useEffect(() => {
    if (!desktopMode || !trimmedModelUrl) {
      return;
    }

    void desktopPetShellRuntime.sendUnityBridgeCommand(
      createUnityVisibilityCommand({
        petId: normalizedPetId,
        visible: resolvedVisible,
      }),
    );
  }, [desktopMode, normalizedPetId, resolvedVisible, trimmedModelUrl]);

  useEffect(() => {
    if (!desktopMode || !trimmedModelUrl) {
      return;
    }

    void desktopPetShellRuntime.sendUnityBridgeCommand(
      createUnitySemanticStateCommand({
        dragActive,
        dragDeltaX,
        dragDeltaY,
        expressionKey: resolvedExpressionKey,
        hoverRegion,
        lookAtX,
        lookAtY,
        motionKey: resolvedMotionKey,
        petId: normalizedPetId,
        viseme: resolvedViseme,
      }),
    );
  }, [
    desktopMode,
    dragActive,
    dragDeltaX,
    dragDeltaY,
    hoverRegion,
    lookAtX,
    lookAtY,
    normalizedPetId,
    resolvedExpressionKey,
    resolvedMotionKey,
    resolvedViseme,
    trimmedModelUrl,
  ]);
}
