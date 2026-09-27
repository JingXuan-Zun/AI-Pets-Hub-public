import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type PetAction, type PetModelMotionBinding } from '../../types';
import { type PetVisualBounds } from './petVisualBounds';
import { type PetHoverState } from '../../pet-runtime/interactions/petHoverController';
import { usePetContentManifest } from '../../pet-runtime/content/usePetContentManifest';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  type AvatarRuntimeEventListener,
  type AvatarRuntimePerfStats,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import {
  useThreeAvatarRuntimeBridgeState,
} from '../../pet-runtime/avatar-runtime/three/threeAvatarRuntimeBridge';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimePresentationMode,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import {
  type Avatar3DRuntimeUpdatePriority,
} from '../../pet-runtime/avatar3d/useAvatar3DRuntimeSleepState';
import { resolvePetThreeAvatarRuntimeSurface } from './petAvatarRuntimeSurface';
import { resolvePetThreeAvatarBridgeInputSurface } from './petThreeAvatarBridgeInputSurface';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  summarizePointerLookTarget,
} from './petPointerLookDiagnostics';

const PetModel3D = lazy(() => import('../PetModel3D'));
const MAX_3D_RUNTIME_RETRY_COUNT = 2;

function appendRuntimeRetryToken(url: string, attempt: number) {
  if (!(attempt > 0) || !url.trim()) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set('desktopPetRetry', String(attempt));
    return parsedUrl.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}desktopPetRetry=${attempt}`;
  }
}

type Position = {
  x: number;
  y: number;
};

interface Pet3DRendererProps {
  action: PetAction;
  active3DSceneCount?: number;
  debugPetId?: string;
  dragMotionState?: AvatarRuntimeDragState;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  fitToPreview?: boolean;
  hoverState?: PetHoverState;
  isSpeaking?: boolean;
  isTyping?: boolean;
  isMoving: boolean;
  latestMessage?: string;
  contentManifestOverride?: PetContentManifest | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onRuntimeFailure?: (errorMessage: string) => void;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: Position | null;
  presentationMode?: AvatarRuntimePresentationMode;
  scale: number;
  staticPreview?: boolean;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
  visible?: boolean;
}

const Pet3DRenderer = memo(function Pet3DRenderer({
  action,
  active3DSceneCount = 1,
  debugPetId,
  dragMotionState,
  expressionAction = null,
  focusTarget = null,
  fitToPreview = false,
  hoverState,
  isSpeaking = false,
  isTyping = false,
  isMoving,
  latestMessage = '',
  contentManifestOverride = null,
  manualExpressionBinding = null,
  manualMotionBinding = null,
  modelUrl,
  onRuntimeEvent,
  onRuntimeFailure,
  onVisualBoundsChange,
  pointerLookTarget = null,
  presentationMode = 'default',
  scale,
  staticPreview = false,
  updatePriority = 'companion',
  visible = true,
}: Pet3DRendererProps) {
  const pointerLookDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const {
    isResolved: contentManifestResolved,
    manifest: contentManifest,
    sourceUrl: contentManifestSourceUrl,
  } = usePetContentManifest(modelUrl);
  const bridgeInputSurface = useMemo(() => (
    resolvePetThreeAvatarBridgeInputSurface({
      contentManifest,
      contentManifestOverride,
      contentManifestResolved,
      contentManifestSourceUrl,
      manualExpressionBinding,
      manualMotionBinding,
      modelUrl,
    })
  ), [
    contentManifest,
    contentManifestOverride,
    contentManifestResolved,
    contentManifestSourceUrl,
    manualExpressionBinding,
    manualMotionBinding,
    modelUrl,
  ]);
  const {
    contentManifest: mergedContentManifest,
    contentManifestResolved: mergedContentManifestResolved,
    contentManifestSourceUrl: mergedContentManifestSourceUrl,
    manualMotionSelection,
    manualExpressionSelection,
  } = bridgeInputSurface;
  const bridgeState = useThreeAvatarRuntimeBridgeState({
    action,
    activeSceneCount: active3DSceneCount,
    contentManifest: mergedContentManifest,
    contentManifestResolved: mergedContentManifestResolved,
    contentManifestSourceUrl: mergedContentManifestSourceUrl,
    debugLabel: debugPetId ?? modelUrl,
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
    modelUrl,
    petId: debugPetId ?? modelUrl,
    pointerLookTarget,
    presentationMode,
    scale,
    visible,
  });
  const { content, layout, semanticState } = bridgeState;
  const runtimeSurface = useMemo(() => (
    resolvePetThreeAvatarRuntimeSurface(bridgeState)
  ), [bridgeState]);
  const runtimeSession = bridgeState.session;

  useEffect(() => {
    pushPointerLookDiagnosticLog(
      pointerLookDiagnosticsRef.current,
      '3d renderer received pointer look target',
      [
        debugPetId ?? modelUrl,
        createPointerLookTargetSignature(pointerLookTarget),
        createPointerLookTargetSignature(bridgeState.pointerLookTarget),
      ],
      {
        bridgePointerLookTarget: summarizePointerLookTarget(bridgeState.pointerLookTarget),
        debugPetId: debugPetId ?? null,
        focusTarget: summarizePointerLookTarget(focusTarget),
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(pointerLookTarget),
        runtimeDebugLabel: bridgeState.runtimeDebugLabel,
        visible,
      },
    );
  }, [
    bridgeState.pointerLookTarget,
    bridgeState.runtimeDebugLabel,
    debugPetId,
    focusTarget,
    modelUrl,
    pointerLookTarget,
    visible,
  ]);

  useEffect(() => {
    if (!onRuntimeEvent) {
      return;
    }

    return runtimeSession.subscribeToEvents(onRuntimeEvent);
  }, [onRuntimeEvent, runtimeSession]);

  useEffect(() => {
    if (!manualMotionBinding) {
      return;
    }

    pushFrontendRuntimeLog(
      'model',
      `3d manual motion selected pet=${debugPetId ?? 'unknown'} binding=${manualMotionBinding.name} motionKey=${manualMotionBinding.motionKey} clips=${manualMotionSelection?.candidateClipNames.join('|') || 'none'}`,
      {
        debugPetId: debugPetId ?? null,
        manualMotionBindingId: manualMotionBinding.id,
        manualMotionClipNames: manualMotionSelection?.candidateClipNames ?? [],
        manualMotionKey: manualMotionBinding.motionKey,
        modelUrl,
      },
    );
  }, [debugPetId, manualMotionBinding, manualMotionSelection, modelUrl]);
  const hasResolvedRuntimeBoundsRef = useRef(false);
  const runtimeReadyRef = useRef(false);
  const runtimeRetryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const [runtimeRetryAttempt, setRuntimeRetryAttempt] = useState(0);

  useEffect(() => {
    hasResolvedRuntimeBoundsRef.current = false;
    runtimeReadyRef.current = false;
    runtimeRetryAttemptRef.current = 0;
    setRuntimeRetryAttempt(0);
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [modelUrl]);

  useEffect(() => {
    runtimeRetryAttemptRef.current = runtimeRetryAttempt;
  }, [runtimeRetryAttempt]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const handleRuntimeVisualBoundsChange = useCallback((bounds: PetVisualBounds) => {
    hasResolvedRuntimeBoundsRef.current = true;
    runtimeSession.emitEvent({
      bounds,
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      source: 'measured',
      type: 'visual-bounds',
    });
    onVisualBoundsChange?.(bounds);
  }, [onVisualBoundsChange, runtimeSession]);
  const handleMotionStateChange = useCallback((motionKey: string | null) => {
    runtimeSession.emitEvent({
      motionKey,
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      type: 'motion-state-changed',
    });
  }, [runtimeSession]);
  const handleExpressionStateChange = useCallback((expressionKey: string | null) => {
    runtimeSession.emitEvent({
      expressionKey,
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      type: 'expression-state-changed',
    });
  }, [runtimeSession]);
  const handlePerfStatsChange = useCallback((stats: AvatarRuntimePerfStats) => {
    runtimeSession.emitEvent({
      ...stats,
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      type: 'perf-stats',
    });
  }, [runtimeSession]);

  const scheduleRuntimeRetry = useCallback((reason: string, errorMessage?: string) => {
    if (runtimeReadyRef.current) {
      return;
    }

    const currentAttempt = runtimeRetryAttemptRef.current;
    if (currentAttempt >= MAX_3D_RUNTIME_RETRY_COUNT) {
      onRuntimeFailure?.(errorMessage ?? reason);
      pushFrontendRuntimeLog('model', `3d runtime retry exhausted pet=${debugPetId ?? 'unknown'} attempt=${currentAttempt} reason=${reason}${errorMessage ? ` error=${errorMessage}` : ''}`, {
        debugPetId: debugPetId ?? null,
        errorMessage: errorMessage ?? null,
        modelUrl,
        retryAttempt: currentAttempt,
      });
      return;
    }

    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }

    const nextAttempt = currentAttempt + 1;
    const retryDelayMs = nextAttempt === 1 ? 260 : 720;
    pushFrontendRuntimeLog('model', `3d runtime scheduling retry pet=${debugPetId ?? 'unknown'} attempt=${nextAttempt} delayMs=${retryDelayMs} reason=${reason}${errorMessage ? ` error=${errorMessage}` : ''}`, {
      debugPetId: debugPetId ?? null,
      errorMessage: errorMessage ?? null,
      modelUrl,
      retryAttempt: nextAttempt,
    });
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setRuntimeRetryAttempt(nextAttempt);
    }, retryDelayMs);
  }, [debugPetId, modelUrl, onRuntimeFailure]);

  const handleRuntimeReady = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const recoveredAttempt = runtimeRetryAttemptRef.current;
    runtimeReadyRef.current = true;
    runtimeSession.emitEvent({
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      type: 'ready',
    });
    if (recoveredAttempt > 0) {
      pushFrontendRuntimeLog('model', `3d runtime recovered pet=${debugPetId ?? 'unknown'} retryAttempt=${recoveredAttempt}`, {
        debugPetId: debugPetId ?? null,
        modelUrl,
        retryAttempt: recoveredAttempt,
      });
    }
  }, [debugPetId, modelUrl, runtimeSession]);

  const handleRuntimeError = useCallback((errorMessage: string) => {
    runtimeReadyRef.current = false;
    runtimeSession.emitEvent({
      errorMessage,
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      type: 'error',
    });
    scheduleRuntimeRetry('error-boundary', errorMessage);
  }, [runtimeSession, scheduleRuntimeRetry]);

  const runtimeModelUrl = useMemo(() => (
    appendRuntimeRetryToken(runtimeSurface.modelRuntimeUrl, runtimeRetryAttempt)
  ), [runtimeSurface.modelRuntimeUrl, runtimeRetryAttempt]);

  useEffect(() => {
    if (!onVisualBoundsChange || hasResolvedRuntimeBoundsRef.current) {
      return;
    }

    const fallbackBounds = runtimeSurface.fallbackVisualBounds;
    runtimeSession.emitEvent({
      bounds: fallbackBounds,
      petId: runtimeSession.petId,
      runtimeKind: runtimeSession.runtimeKind,
      source: 'fallback',
      type: 'visual-bounds',
    });
    onVisualBoundsChange(fallbackBounds);
  }, [onVisualBoundsChange, runtimeSession, runtimeSurface.fallbackVisualBounds]);

  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <PetModel3D
        bridgeRenderState={bridgeState}
        modelRuntimeUrl={runtimeModelUrl}
        onExpressionStateChange={handleExpressionStateChange}
        onMotionStateChange={handleMotionStateChange}
        onPerfStatsChange={handlePerfStatsChange}
        onRuntimeError={handleRuntimeError}
        onRuntimeReady={handleRuntimeReady}
        onVisualBoundsChange={handleRuntimeVisualBoundsChange}
        runtimeSleeping={staticPreview}
        updatePriority={updatePriority}
        url={content.modelUrl}
      />
    </Suspense>
  );
});

Pet3DRenderer.displayName = 'Pet3DRenderer';

export default Pet3DRenderer;
