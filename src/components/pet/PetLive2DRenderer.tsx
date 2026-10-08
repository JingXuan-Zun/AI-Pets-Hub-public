import { memo, useMemo, useRef, useState, type CSSProperties } from 'react';
import { resolveLive2DModelRuntimeUrl } from '../../pet-runtime/live2d/live2dModelSupport';
import { resolvePointerLookVisualStyle } from './petPointerLookVisual';
import { type Live2DModelPresentationOptions } from './live2dModelRuntime';
import { useLive2DMotionExpressionSync } from './useLive2DMotionExpressionSync';
import { useLive2DRuntimeHeartbeatProbe } from './useLive2DRuntimeHeartbeatProbe';
import { resolveLive2DRendererStageSize } from './live2dRenderer/live2dRendererVisualBounds';
import { type Live2DRendererRefs, useLive2DRendererCoreRefs } from './live2dRenderer/live2dRendererRefs';
import { type PetLive2DRendererProps } from './live2dRenderer/petLive2DRendererProps';
import { useLive2DRendererModelLoader } from './live2dRenderer/useLive2DRendererModelLoader';
import {
  useLive2DDragProbeDiagnosticFrame,
  useLive2DRenderedVisualBoundsEmitter,
} from './live2dRenderer/useLive2DRendererDiagnostics';
import { useLive2DFallbackBoundsEmission } from './live2dRenderer/useLive2DFallbackBoundsEmission';
import { useLive2DRuntimeProfileHotUpdate } from './live2dRenderer/useLive2DRuntimeProfileHotUpdate';
import { useLive2DPointerLookApplication } from './live2dRenderer/useLive2DPointerLookApplication';
import { useLive2DRendererRuntimeState } from './live2dRenderer/useLive2DRendererRuntimeState';
import {
  useLive2DRendererPresentationSync,
  useLive2DRendererStageSync,
  useLive2DRuntimeControllerStateSync,
} from './live2dRenderer/useLive2DRendererSync';


export { shouldUseLive2DDragSettleCenter } from './live2dRenderer/useLive2DRendererRuntimeState';

const PetLive2DRenderer = memo(function PetLive2DRenderer({
  action,
  debugPetId,
  expressionAction = null,
  focusTarget = null,
  hoverState = null,
  isDragging = false,
  isSpeaking = false,
  isTyping = false,
  isMoving,
  latestMessage = '',
  live2dRuntimeProfile = null,
  contentManifestOverride = null,
  manualExpressionBinding = null,
  manualMotionBinding = null,
  motionBindings: modelMotionBindings = [],
  modelUrl,
  onRuntimeEvent,
  onVisualBoundsChange,
  pointerLookTarget = null,
  scale,
  viewport = null,
  visible = true,
}: PetLive2DRendererProps) {
  const coreRefs = useLive2DRendererCoreRefs();
  const {
    appRef, containerRef, lookPositionRef, modelLayerRef, modelRef, renderedVisualBoundsSignatureRef, sharedRendererHandleRef,
  } = coreRefs;
  const live2dRuntimeProfileRef = useRef(live2dRuntimeProfile);
  live2dRuntimeProfileRef.current = live2dRuntimeProfile;
  const [runtimeReadyVersion, setRuntimeReadyVersion] = useState(0);
  useLive2DRuntimeHeartbeatProbe({
    appRef,
    modelRef,
    petId: debugPetId ?? modelUrl,
    runtimeReadyVersion,
  });
  const runtimeProfileSignature = useMemo(
    () => JSON.stringify(live2dRuntimeProfile ?? null),
    [live2dRuntimeProfile],
  );
  const onPointerLookDiagnosticFrame = useLive2DDragProbeDiagnosticFrame(containerRef);
  const stageSize = useMemo(() => resolveLive2DRendererStageSize(viewport), [viewport]);
  const presentationOptionsRef = useRef<Live2DModelPresentationOptions>({
    contentManifest: contentManifestOverride,
    live2dRuntimeProfile,
    motionBindings: [],
    stageSize,
    visible,
  });
  const runtimePetId = debugPetId ?? modelUrl;
  const modelRuntimeUrl = useMemo(() => resolveLive2DModelRuntimeUrl(modelUrl), [modelUrl]);
  const runtimeContextRef = useRef({
    modelRuntimeUrl,
    modelUrl,
    onRuntimeEvent,
    runtimePetId,
  });
  const onVisualBoundsChangeRef = useRef(onVisualBoundsChange);
  onVisualBoundsChangeRef.current = onVisualBoundsChange;

  const emitRenderedVisualBounds = useLive2DRenderedVisualBoundsEmitter({
    modelLayerRef, modelRef, renderedVisualBoundsSignatureRef, runtimeContextRef, sharedRendererHandleRef,
  }, onVisualBoundsChangeRef);
  const {
    dragSettledFocusTarget,
    dragSettledPointerLookTarget,
    effectiveManualExpressionBinding,
    effectivePointerLookStrength,
    manualMotionBindingForMotion,
    motionBindings,
    mouthRuntimeState,
    mouthRuntimeStateRef,
    performanceRuntimeState,
    performanceRuntimeStateRef,
    shouldSettleLive2DLook,
    shouldStabilizeScaleLook,
    shouldUseDragSettleCenter,
  } = useLive2DRendererRuntimeState({
    action,
    expressionAction,
    focusTarget,
    hoverState,
    isDragging,
    isMoving,
    isSpeaking,
    isTyping,
    latestMessage,
    lookPositionRef,
    manualExpressionBinding,
    manualMotionBinding,
    modelMotionBindings,
    pointerLookTarget,
    scale,
    visible,
  });
  const resetMotionExpressionSignatures = useLive2DMotionExpressionSync({
    action,
    contentManifestOverride,
    effectiveManualExpressionBinding,
    expressionAction,
    isDragging,
    isMoving,
    manualMotionBinding,
    manualMotionBindingForMotion,
    modelRef,
    modelUrl,
    onRuntimeEvent,
    runtimePetId,
    runtimeReadyVersion,
  });
  const resetMotionExpressionSignaturesRef = useRef(resetMotionExpressionSignatures);
  resetMotionExpressionSignaturesRef.current = resetMotionExpressionSignatures;
  const rendererRefs = useMemo<Live2DRendererRefs>(() => ({
    ...coreRefs,
    live2dRuntimeProfileRef,
    mouthRuntimeStateRef,
    performanceRuntimeStateRef,
    presentationOptionsRef,
    resetMotionExpressionSignaturesRef,
    runtimeContextRef,
  }), []);

  useLive2DRendererStageSync({
    contentManifestOverride,
    effectivePointerLookStrength,
    emitRenderedVisualBounds,
    live2dRuntimeProfile,
    modelRuntimeUrl,
    modelUrl,
    motionBindings,
    mouthRuntimeState,
    onRuntimeEvent,
    performanceRuntimeState,
    refs: rendererRefs,
    runtimePetId,
    stageSize,
    visible,
  });

  useLive2DRendererModelLoader({
    emitRenderedVisualBounds,
    modelRuntimeUrl,
    onPointerLookDiagnosticFrame,
    refs: rendererRefs,
    setRuntimeReadyVersion,
    stageSize,
  });

  useLive2DFallbackBoundsEmission({
    isDragging,
    isMoving,
    modelUrl,
    onRuntimeEvent,
    onVisualBoundsChange,
    renderedVisualBoundsSignatureRef,
    runtimePetId,
    stageSize,
    viewport,
  });

  useLive2DRendererPresentationSync({
    contentManifestOverride,
    focusTarget,
    live2dRuntimeProfile,
    modelUrl,
    motionBindings,
    pointerLookTarget,
    refs: rendererRefs,
    runtimePetId,
    runtimeReadyVersion,
    stageSize,
    visible,
  });

  useLive2DRuntimeProfileHotUpdate({
    emitRenderedVisualBounds,
    onPointerLookDiagnosticFrame,
    refs: rendererRefs,
    runtimeProfileSignature,
    runtimeReadyVersion,
    stageSize,
  });

  useLive2DPointerLookApplication({
    action,
    dragSettledFocusTarget,
    dragSettledPointerLookTarget,
    effectiveManualExpressionBinding,
    effectivePointerLookStrength,
    expressionAction,
    hoverRegion: hoverState?.activeRegion,
    isMoving,
    manualMotionBindingForMotion,
    modelUrl,
    refs: rendererRefs,
    runtimePetId,
    shouldUseDragSettleCenter,
    visible,
  });

  useLive2DRuntimeControllerStateSync({
    effectivePointerLookStrength,
    mouthRuntimeState,
    performanceRuntimeState,
    refs: rendererRefs,
    runtimeReadyVersion,
  });

  const pointerLookStyle = {
    ...resolvePointerLookVisualStyle({
      maxRotateDeg: 4.4,
      maxTranslateX: 7.2,
      maxTranslateY: 4.8,
      strength: effectivePointerLookStrength,
      target: dragSettledPointerLookTarget,
      xDivisor: 16,
      yDivisor: 24,
    }),
    opacity: visible ? 1 : 0,
  } satisfies CSSProperties;

  return (
    <div
      ref={containerRef}
      data-desktop-pet-live2d-renderer="true"
      data-live2d-look-settle={shouldSettleLive2DLook ? '1' : '0'}
      data-live2d-scale-look-stabilized={shouldStabilizeScaleLook ? '1' : '0'}
      data-live2d-look-source={lookPositionRef.current.source}
      data-live2d-look-strength={effectivePointerLookStrength.toFixed(3)}
      data-live2d-look-x={lookPositionRef.current.x.toFixed(3)}
      data-live2d-look-y={lookPositionRef.current.y.toFixed(3)}
      className="pointer-events-none h-full w-full"
      style={pointerLookStyle}
    />
  );
});

PetLive2DRenderer.displayName = 'PetLive2DRenderer';

export default PetLive2DRenderer;
