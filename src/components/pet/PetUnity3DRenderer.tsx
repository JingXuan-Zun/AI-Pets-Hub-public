import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { type PetAction, type PetModelMotionBinding } from '../../types';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import {
  resolveUnity3DActivityClampVisualBounds,
  resolveUnity3DInteractiveVisualBounds,
  type PetVisualBounds,
} from './petVisualBounds';
import { type PetHoverState } from '../../pet-runtime/interactions/petHoverController';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { resolvePetActionForMotionKey } from '../../pet-runtime/content/petModelMotionBindings';
import { resolveAvatarRuntimeManualExpressionSelection } from '../../pet-runtime/content/petModelExpressionBindings';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimePresentationMode,
  type AvatarRuntimeViewport,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { useUnityAvatarRuntimeMirror } from '../../pet-runtime/avatar-runtime/unity/unityAvatarRuntimeBridge';
import { useUnityAvatarRuntimeEvents } from '../../pet-runtime/avatar-runtime/unity/useUnityAvatarRuntimeEvents';
import { routeUnityRendererRuntimeEvent } from './petUnityRuntimeEventRouting';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  summarizePointerLookTarget,
} from './petPointerLookDiagnostics';
import { resolvePetPerformanceLookInput } from '../../pet-runtime/interactions/petPerformanceLookInput';

type Position = {
  x: number;
  y: number;
};

interface PetUnity3DRendererProps {
  action: PetAction;
  debugPetId?: string;
  dragMotionState?: AvatarRuntimeDragState | null;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  hoverState?: PetHoverState | null;
  isSpeaking?: boolean;
  isTyping?: boolean;
  isMoving: boolean;
  latestMessage?: string;
  contentManifestOverride?: PetContentManifest | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: Position | null;
  presentationMode?: AvatarRuntimePresentationMode;
  scale: number;
  viewport?: AvatarRuntimeViewport | null;
  visible?: boolean;
}

function resolveUnityProtocolPetId(debugPetId?: string) {
  return debugPetId === PRIMARY_DESKTOP_PET_SLOT_ID
    ? 'main'
    : debugPetId ?? 'main';
}

const PetUnity3DRenderer = memo(function PetUnity3DRenderer({
  action,
  debugPetId,
  dragMotionState = null,
  expressionAction = null,
  focusTarget = null,
  hoverState = null,
  isSpeaking = false,
  isTyping = false,
  isMoving,
  latestMessage = '',
  manualExpressionBinding = null,
  manualMotionBinding = null,
  modelUrl,
  onRuntimeEvent,
  onVisualBoundsChange,
  pointerLookTarget = null,
  presentationMode = 'default',
  scale,
  viewport = null,
  visible = true,
}: PetUnity3DRendererProps) {
  const pointerLookDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const runtimePetId = debugPetId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
  const unityPetId = resolveUnityProtocolPetId(debugPetId);
  const lookInput = useMemo(() => resolvePetPerformanceLookInput({
    focusTarget,
    pointerLookTarget,
  }), [focusTarget, pointerLookTarget]);
  const bridgeFocusTarget = lookInput.target;
  const visualAction = useMemo(() => (
    manualMotionBinding && !isPetModelExpressionBinding(manualMotionBinding)
      ? resolvePetActionForMotionKey(manualMotionBinding.motionKey)
      : null
  ) ?? action, [action, manualMotionBinding]);
  const manualExpressionSelection = useMemo(() => (
    resolveAvatarRuntimeManualExpressionSelection(
      manualExpressionBinding
      ?? (manualMotionBinding && isPetModelExpressionBinding(manualMotionBinding)
        ? manualMotionBinding
        : null),
    )
  ), [manualExpressionBinding, manualMotionBinding]);

  useUnityAvatarRuntimeMirror({
    action: visualAction,
    dragState: dragMotionState,
    expressionAction,
    focusTarget: bridgeFocusTarget,
    hoverState,
    isMoving,
    isSpeaking,
    isTyping,
    latestMessage,
    manualExpressionSelection,
    manualMotionKey: manualMotionBinding && !isPetModelExpressionBinding(manualMotionBinding)
      ? manualMotionBinding.motionKey
      : null,
    modelUrl,
    petId: unityPetId,
    presentationMode,
    scale,
    viewport,
    visible,
  });

  useEffect(() => {
    pushPointerLookDiagnosticLog(
      pointerLookDiagnosticsRef.current,
      'unity renderer received pointer look target',
      [
        runtimePetId,
        unityPetId,
        createPointerLookTargetSignature(pointerLookTarget),
        createPointerLookTargetSignature(bridgeFocusTarget),
      ],
      {
        bridgeFocusTarget: summarizePointerLookTarget(bridgeFocusTarget),
        focusTarget: summarizePointerLookTarget(focusTarget),
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(pointerLookTarget),
        runtimePetId,
        unityPetId,
        visible,
      },
    );
  }, [
    bridgeFocusTarget,
    focusTarget,
    modelUrl,
    pointerLookTarget,
    runtimePetId,
    unityPetId,
    visible,
  ]);
  const handleUnityRuntimeEvent = useCallback((event: Parameters<AvatarRuntimeEventListener>[0]) => {
    routeUnityRendererRuntimeEvent(event, runtimePetId, onVisualBoundsChange, scale, isMoving);
  }, [isMoving, onVisualBoundsChange, runtimePetId, scale]);

  useUnityAvatarRuntimeEvents(handleUnityRuntimeEvent);

  useEffect(() => {
    const fallbackBounds = resolveUnity3DInteractiveVisualBounds(scale, isMoving);
    const activityClampFallbackBounds = resolveUnity3DActivityClampVisualBounds(scale, isMoving);

    onRuntimeEvent?.({
      bounds: activityClampFallbackBounds,
      petId: runtimePetId,
      runtimeKind: 'unity',
      source: 'fallback',
      type: 'visual-bounds',
    });
    onVisualBoundsChange?.(fallbackBounds);
  }, [isMoving, onRuntimeEvent, onVisualBoundsChange, runtimePetId, scale]);

  return null;
});

PetUnity3DRenderer.displayName = 'PetUnity3DRenderer';

export default PetUnity3DRenderer;
