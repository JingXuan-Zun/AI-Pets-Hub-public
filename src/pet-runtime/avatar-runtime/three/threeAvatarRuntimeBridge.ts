import { useEffect, useMemo, useState } from 'react';
import { type PetAction } from '../../../types';
import { type PetHoverState } from '../../interactions/petHoverController';
import { usePetHoverInteractionState } from '../../interactions/usePetHoverInteractionState';
import { type PetContentManifest } from '../../content/petContentManifest';
import { type Avatar3DManualMotionSelection as ThreeManualMotionSelection } from '../../avatar3d/avatar3dMotionStateController';
import {
  resolveAvatar3DRenderAdapterState as resolveThreeRenderAdapterState,
  type Avatar3DRenderAdapterState as ThreeRenderAdapterState,
} from '../../avatar3d/avatar3dRenderAdapterState';
import {
  useAvatar3DReactionState as useThreeReactionState,
  type Avatar3DReactionState as ThreeReactionState,
} from '../../avatar3d/useAvatar3DReactionState';
import { type AvatarRuntimeBridge, type AvatarRuntimeBridgeSession } from '../avatarRuntimeBridge';
import { createAvatarRuntimeSessionStore } from '../avatarRuntimeBridge';
import {
  createAvatarRuntimeSemanticState,
  type AvatarRuntimeSemanticState,
} from '../avatarSemanticState';
import {
  type AvatarRuntimeContentState,
  type AvatarRuntimeDragState,
  type AvatarRuntimeFocusTarget,
  type AvatarRuntimeHoverState,
  type AvatarRuntimeManualExpressionSelection,
  type AvatarRuntimeLayoutState,
  type AvatarRuntimeManualMotionSelection,
  type AvatarRuntimePresentationMode,
  type AvatarRuntimeViewport,
} from '../avatarRuntimeTypes';
import { type PetMessageExpressionAction } from '../../interactions/petMessageExpressionSignals';

type UseThreeAvatarRuntimeBridgeStateOptions = {
  action: PetAction;
  activeSceneCount?: number;
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  debugLabel?: string | null;
  displayId?: string | null;
  dragMotionState?: AvatarRuntimeDragState | null;
  expressionAction?: PetAction | null;
  focusTarget?: AvatarRuntimeFocusTarget | null;
  hoverState?: PetHoverState | null;
  isMoving?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  latestMessage?: string;
  manualExpressionSelection?: AvatarRuntimeManualExpressionSelection | null;
  manualMotionSelection?: AvatarRuntimeManualMotionSelection | null;
  modelUrl: string;
  petId: string;
  pointerLookTarget?: AvatarRuntimeFocusTarget | null;
  presentationMode?: AvatarRuntimePresentationMode;
  scale?: number;
  visible?: boolean;
  viewport?: AvatarRuntimeViewport | null;
};

export type ThreeAvatarRuntimeManualMotionSelection = ThreeManualMotionSelection;
export type ThreeAvatarRuntimeReactionState = ThreeReactionState;
export type ThreeAvatarRuntimeRenderAdapterState = ThreeRenderAdapterState;

export type ThreeAvatarRuntimeBridgeState = {
  activeSceneCount: number;
  contentManifest: PetContentManifest | null;
  contentManifestResolved: boolean;
  contentManifestSourceUrl: string | null;
  content: AvatarRuntimeContentState;
  dragMotionState: AvatarRuntimeDragState | null;
  focusTarget: AvatarRuntimeFocusTarget | null;
  hoverState: PetHoverState | null;
  layout: AvatarRuntimeLayoutState;
  manualMotionSelection: ThreeManualMotionSelection | null;
  pointerLookTarget: AvatarRuntimeFocusTarget | null;
  reactionState: ThreeReactionState;
  renderAdapterState: ThreeRenderAdapterState;
  runtimeDebugLabel: string | null;
  semanticState: AvatarRuntimeSemanticState;
  session: AvatarRuntimeBridgeSession<'three'>;
  visible: boolean;
};

export type ThreeAvatarRuntimeBridgeRenderViewState = Pick<
  ThreeAvatarRuntimeBridgeState,
  | 'activeSceneCount'
  | 'content'
  | 'dragMotionState'
  | 'focusTarget'
  | 'hoverState'
  | 'layout'
  | 'manualMotionSelection'
  | 'pointerLookTarget'
  | 'reactionState'
  | 'renderAdapterState'
  | 'runtimeDebugLabel'
  | 'semanticState'
>;

function createInitialContentState(modelUrl: string): AvatarRuntimeContentState {
  return {
    contentManifest: null,
    contentManifestResolved: false,
    contentManifestSourceUrl: null,
    modelUrl,
  };
}

function createInitialLayoutState(): AvatarRuntimeLayoutState {
  return {
    activeSceneCount: 1,
    displayId: null,
    presentationMode: 'default',
    scale: 1,
    viewport: null,
  };
}

function createInitialSemanticState(): AvatarRuntimeSemanticState {
  return createAvatarRuntimeSemanticState();
}

export function createThreeAvatarRuntimeBridge(): AvatarRuntimeBridge<'three'> {
  return {
    createSession: (petId, debugLabel = null) => createAvatarRuntimeSessionStore({
      debugLabel,
      initialContent: createInitialContentState(''),
      initialLayout: createInitialLayoutState(),
      initialSemanticState: createInitialSemanticState(),
      petId,
      runtimeKind: 'three',
      visible: true,
    }),
    runtimeKind: 'three',
  };
}

function toAvatarRuntimeHoverState(hoverState?: PetHoverState | null): AvatarRuntimeHoverState | null {
  if (!hoverState) {
    return null;
  }

  return {
    activeRegion: hoverState.activeRegion,
    focusTarget: hoverState.focusTarget,
    supportedRegions: [...hoverState.supportedRegions],
  };
}

function toAvatarRuntimeDragState(
  dragMotionState?: AvatarRuntimeDragState | null,
): AvatarRuntimeDragState | null {
  if (!dragMotionState) {
    return null;
  }

  return {
    active: dragMotionState.active,
    deltaX: dragMotionState.deltaX,
    deltaY: dragMotionState.deltaY,
  };
}

function toThreeManualMotionSelection(
  selection?: AvatarRuntimeManualMotionSelection | null,
): ThreeManualMotionSelection | null {
  if (!selection) {
    return null;
  }

  return {
    candidateClipNames: [...selection.candidateClipNames],
    motionKey: selection.motionKey,
    playbackMode: selection.playbackMode === 'loop' || selection.playbackMode === 'once'
      ? 'native'
      : selection.playbackMode,
  };
}

function toPetHoverState(
  hoverState?: AvatarRuntimeHoverState | null,
): PetHoverState | null {
  if (!hoverState) {
    return null;
  }

  return {
    activeRegion: hoverState.activeRegion as PetHoverState['activeRegion'],
    focusTarget: hoverState.focusTarget,
    supportedRegions: hoverState.supportedRegions as PetHoverState['supportedRegions'],
  };
}

export function useThreeAvatarRuntimeBridgeState({
  action,
  activeSceneCount = 1,
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  debugLabel = null,
  displayId = null,
  dragMotionState = null,
  expressionAction = null,
  focusTarget = null,
  hoverState = null,
  isMoving = false,
  isSpeaking = false,
  isTyping = false,
  latestMessage = '',
  manualExpressionSelection = null,
  manualMotionSelection = null,
  modelUrl,
  petId,
  pointerLookTarget = null,
  presentationMode = 'default',
  scale = 1,
  visible = true,
  viewport = null,
}: UseThreeAvatarRuntimeBridgeStateOptions): ThreeAvatarRuntimeBridgeState {
  const bridge = useMemo(() => createThreeAvatarRuntimeBridge(), []);
  const session = useMemo(() => {
    const nextSession = bridge.createSession(petId, debugLabel);
    nextSession.loadContent({
      contentManifest,
      contentManifestResolved,
      contentManifestSourceUrl,
      modelUrl,
    });
    nextSession.setLayout({
      activeSceneCount,
      displayId,
      presentationMode,
      scale,
      viewport,
    });
    nextSession.setSemanticState(createAvatarRuntimeSemanticState({
      action,
      dragState: toAvatarRuntimeDragState(dragMotionState),
      expressionAction,
      focusTarget,
      hoverState: toAvatarRuntimeHoverState(hoverState),
      isMoving,
      isSpeaking,
      isTyping,
      latestMessage,
      manualExpressionSelection,
      manualMotionSelection,
      pointerLookTarget,
    }));
    nextSession.setVisibility(visible);
    return nextSession;
  }, [bridge, debugLabel, petId]);
  const [snapshot, setSnapshot] = useState(() => session.getSnapshot());

  useEffect(() => {
    setSnapshot(session.getSnapshot());
    const unsubscribe = session.subscribe(() => {
      setSnapshot(session.getSnapshot());
    });

    return unsubscribe;
  }, [session]);

  useEffect(() => () => {
    session.dispose();
  }, [session]);

  useEffect(() => {
    session.loadContent({
      contentManifest,
      contentManifestResolved,
      contentManifestSourceUrl,
      modelUrl,
    });
  }, [
    session,
    contentManifest,
    contentManifestResolved,
    contentManifestSourceUrl,
    modelUrl,
  ]);

  useEffect(() => {
    session.setLayout({
      activeSceneCount,
      displayId,
      presentationMode,
      scale,
      viewport,
    });
  }, [session, activeSceneCount, displayId, presentationMode, scale, viewport]);

  useEffect(() => {
    session.setSemanticState(createAvatarRuntimeSemanticState({
      action,
      dragState: toAvatarRuntimeDragState(dragMotionState),
      expressionAction,
      focusTarget,
      hoverState: toAvatarRuntimeHoverState(hoverState),
      isMoving,
      isSpeaking,
      isTyping,
      latestMessage,
      manualExpressionSelection,
      manualMotionSelection,
      pointerLookTarget,
    }));
  }, [
    session,
    action,
    dragMotionState,
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
  ]);

  useEffect(() => {
    session.setVisibility(visible);
  }, [session, visible]);

  const resolvedHoverState = useMemo(() => (
    toPetHoverState(snapshot.semanticState.hoverState)
  ), [snapshot.semanticState.hoverState]);
  const hoverInteractionState = usePetHoverInteractionState({
    enabled: Boolean(resolvedHoverState),
    hoverState: resolvedHoverState ?? undefined,
  });
  const reactionState = useThreeReactionState({
    action: snapshot.semanticState.action,
    contentManifest: snapshot.content.contentManifest,
    expressionAction: snapshot.semanticState.expressionAction as PetMessageExpressionAction | null,
    hoverInteractionState,
    isMoving: snapshot.semanticState.isMoving,
    isSpeaking: snapshot.semanticState.isSpeaking,
    isTyping: snapshot.semanticState.isTyping,
    latestMessage: snapshot.semanticState.latestMessage,
    manualExpressionSelection: snapshot.semanticState.manualExpressionSelection,
  });
  const renderAdapterState = useMemo(() => resolveThreeRenderAdapterState({
    action: snapshot.semanticState.action,
    expressionAction: reactionState.expressionState.shouldOverridePresentation
      ? (reactionState.expressionState.activeAction ?? snapshot.semanticState.expressionAction)
      : snapshot.semanticState.expressionAction,
    interactionState: reactionState.interactionState,
    isMoving: snapshot.semanticState.isMoving,
    modelUrl: snapshot.content.modelUrl,
    motionOverrideMode: reactionState.motionOverrideState.mode,
    presentationMode: snapshot.layout.presentationMode,
    scale: snapshot.layout.scale,
  }), [
    reactionState.expressionState.activeAction,
    reactionState.expressionState.shouldOverridePresentation,
    reactionState.interactionState,
    reactionState.motionOverrideState.mode,
    snapshot.content.modelUrl,
    snapshot.layout.presentationMode,
    snapshot.layout.scale,
    snapshot.semanticState.action,
    snapshot.semanticState.expressionAction,
    snapshot.semanticState.isMoving,
  ]);

  return {
    activeSceneCount: snapshot.layout.activeSceneCount,
    content: snapshot.content,
    contentManifest: snapshot.content.contentManifest,
    contentManifestResolved: snapshot.content.contentManifestResolved,
    contentManifestSourceUrl: snapshot.content.contentManifestSourceUrl,
    dragMotionState: snapshot.semanticState.dragState,
    focusTarget: snapshot.semanticState.focusTarget,
    hoverState: resolvedHoverState,
    layout: snapshot.layout,
    manualMotionSelection: toThreeManualMotionSelection(snapshot.semanticState.manualMotionSelection),
    pointerLookTarget: snapshot.semanticState.pointerLookTarget,
    reactionState,
    renderAdapterState,
    runtimeDebugLabel: snapshot.debugLabel,
    semanticState: snapshot.semanticState,
    session,
    visible: snapshot.visible,
  };
}
