import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Application, Container, Point } from 'pixi.js';
import { type PetAction, type PetModelMotionBinding } from '../../types';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type AvatarRuntimeViewport } from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { type PetHoverState } from '../../pet-runtime/interactions/petHoverController';
import { resolveLive2DModelRuntimeUrl } from '../../pet-runtime/live2d/live2dModelSupport';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { normalize2DVisualBounds, type PetVisualBounds } from './petVisualBounds';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  pushPointerLookTraceLog,
  summarizePointerLookTarget,
} from './petPointerLookDiagnostics';
import { resolvePointerLookVisualStyle } from './petPointerLookVisual';
import {
  didLive2DPointerLookScaleChange,
  resolveLive2DDragSettledPointerLookTarget,
  resolveLive2DLookPosition,
  resolveLive2DScaleStablePointerLookTarget,
  type Live2DResolvedPointerLookPosition,
} from './live2dPointerLookTarget';
import {
  createLive2DPointerLookRuntimeController,
  type Live2DPointerLookFrameDiagnostic,
  type Live2DPointerLookRuntimeController,
} from './live2dPointerLookRuntimeController';
import {
  createLive2DPerformanceRuntimeController,
  type Live2DPerformanceRuntimeController,
  type Live2DPerformanceRuntimeState,
} from './live2dPerformanceRuntimeController';
import {
  createLive2DMouthRuntimeController,
  type Live2DMouthRuntimeController,
  type Live2DMouthRuntimeState,
} from './live2dMouthRuntimeController';
import {
  loadLive2DCubism4Runtime,
  resolveLive2DVisibleDrawableBounds,
  resolveLive2DRuntimeProfileForModel,
  syncLive2DModelPresentation,
  type Live2DExpressionManagerConstructor,
  type Live2DModelLike,
  type Live2DModelPresentationOptions,
} from './live2dModelRuntime';
import { useLive2DMotionExpressionSync } from './useLive2DMotionExpressionSync';
import { resolvePetPointerLookStrength } from '../../pet-runtime/interactions/petPointerLookPriority';
import { isLive2DDragReleaseProbeEnabled } from './live2dDragProbeFlag';
import {
  type Live2DRuntimeProfileConfigV1,
  type ResolvedLive2DRuntimeProfile,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';
import { loadLive2DDeclaredParameterIds } from '../../pet-runtime/live2d/live2dDisplayInfoParameters';
import { warmLive2DComplexPhysicsRig } from './live2dComplexPhysicsWarmup';
import {
  acquireLive2DSharedRenderer,
  attachLive2DModelToApplicationTicker,
  type Live2DModelTickerHandle,
  type Live2DSharedRendererHandle,
} from './live2dSharedRenderer';
import { useLive2DRuntimeHeartbeatProbe } from './useLive2DRuntimeHeartbeatProbe';
import { useLive2DDragLookSettle } from './useLive2DDragLookSettle';

type Position = {
  x: number;
  y: number;
};

function resolveLive2DDrawableVisualBounds(
  model: Live2DModelLike,
  modelLayer: Container,
  stageSize: number,
) {
  const drawableBounds = resolveLive2DVisibleDrawableBounds(model);
  if (!drawableBounds) {
    return null;
  }

  const corners = [
    new Point(drawableBounds.x, drawableBounds.y),
    new Point(drawableBounds.x + drawableBounds.width, drawableBounds.y),
    new Point(drawableBounds.x, drawableBounds.y + drawableBounds.height),
    new Point(drawableBounds.x + drawableBounds.width, drawableBounds.y + drawableBounds.height),
  ].map((point) => model.worldTransform.apply(point));
  const layerOffsetX = modelLayer.worldTransform.tx;
  const layerOffsetY = modelLayer.worldTransform.ty;
  const left = Math.min(...corners.map((point) => point.x)) - layerOffsetX;
  const right = Math.max(...corners.map((point) => point.x)) - layerOffsetX;
  const top = Math.min(...corners.map((point) => point.y)) - layerOffsetY;
  const bottom = Math.max(...corners.map((point) => point.y)) - layerOffsetY;
  const center = stageSize / 2;

  return normalize2DVisualBounds({
    bottom: Math.max(1, bottom - center),
    left: Math.max(1, center - left),
    right: Math.max(1, right - center),
    top: Math.max(1, center - top),
  });
}

interface PetLive2DRendererProps {
  action: PetAction;
  debugPetId?: string;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  hoverState?: PetHoverState | null;
  isDragging?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  isMoving: boolean;
  latestMessage?: string;
  live2dRuntimeProfile?: Live2DRuntimeProfileConfigV1 | null;
  contentManifestOverride?: PetContentManifest | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  motionBindings?: PetModelMotionBinding[];
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: Position | null;
  scale: number;
  viewport?: AvatarRuntimeViewport | null;
  visible?: boolean;
}

type Live2DRuntimeControllerSet = {
  mouth: Live2DMouthRuntimeController | null;
  performance: Live2DPerformanceRuntimeController | null;
  pointerLook: Live2DPointerLookRuntimeController | null;
};

const LIVE2D_RUNTIME_CENTER_LOOK_POSITION = {
  source: 'center',
  x: 0,
  y: 0,
} satisfies Live2DResolvedPointerLookPosition;

function replaceLive2DRuntimeControllers(options: {
  bootstrapMode: 'model-load' | 'preserve-input';
  currentControllers: Live2DRuntimeControllerSet;
  lookPosition: Live2DResolvedPointerLookPosition;
  model: Live2DModelLike;
  modelRuntimeUrl: string;
  modelUrl: string;
  onDiagnosticFrame?: (frame: Live2DPointerLookFrameDiagnostic) => void;
  mouthState: Live2DMouthRuntimeState;
  performanceState: Live2DPerformanceRuntimeState;
  petId: string;
  pointerLookStrength: number;
  runtimeProfile: ResolvedLive2DRuntimeProfile;
}): Live2DRuntimeControllerSet {
  options.currentControllers.pointerLook?.destroy();
  options.currentControllers.performance?.destroy();
  options.currentControllers.mouth?.destroy();

  let pointerLook: Live2DPointerLookRuntimeController | null = null;
  let performance: Live2DPerformanceRuntimeController | null = null;
  let mouth: Live2DMouthRuntimeController | null = null;
  const shouldStartCentered = options.bootstrapMode === 'model-load';
  try {
    pointerLook = createLive2DPointerLookRuntimeController(options.model, {
      modelUrl: options.modelUrl,
      onDiagnosticFrame: options.onDiagnosticFrame,
      petId: options.petId,
      runtimeProfile: options.runtimeProfile,
      startCenteredBeforeIdle: shouldStartCentered,
    });
    pointerLook?.setStrength(options.pointerLookStrength);
    pointerLook?.updateInputTarget(
      shouldStartCentered ? LIVE2D_RUNTIME_CENTER_LOOK_POSITION : options.lookPosition,
    );
    pointerLook?.applyImmediate();
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d pointer look setup skipped pet=${options.petId}`, error, {
      modelUrl: options.modelUrl,
      runtimeUrl: options.modelRuntimeUrl,
    });
  }

  try {
    performance = createLive2DPerformanceRuntimeController(options.model, {
      modelUrl: options.modelUrl,
      petId: options.petId,
      runtimeProfile: options.runtimeProfile,
    });
    performance?.setState(options.performanceState);
    performance?.applyImmediate();
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d performance setup skipped pet=${options.petId}`, error, {
      modelUrl: options.modelUrl,
      runtimeUrl: options.modelRuntimeUrl,
    });
  }

  try {
    mouth = createLive2DMouthRuntimeController(options.model, {
      modelUrl: options.modelUrl,
      petId: options.petId,
      runtimeProfile: options.runtimeProfile,
    });
    mouth?.setState(options.mouthState);
    mouth?.applyImmediate();
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d mouth setup skipped pet=${options.petId}`, error, {
      modelUrl: options.modelUrl,
      runtimeUrl: options.modelRuntimeUrl,
    });
  }

  return {
    mouth,
    performance,
    pointerLook,
  };
}

const LIVE2D_BASE_STAGE_SIZE = 256;
const LIVE2D_MAX_STAGE_SIZE = 960;
const LIVE2D_SCALE_LOOK_SETTLE_MS = 320;
const LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT = 160;
const LIVE2D_DRAG_SETTLE_LOOK_POSITION = {
  source: 'center',
  x: 0,
  y: 0,
} satisfies Live2DResolvedPointerLookPosition;

export function shouldUseLive2DDragSettleCenter(
  shouldSettleLive2DLook: boolean,
  focusTarget: Position | null | undefined,
) {
  return shouldSettleLive2DLook && !focusTarget;
}

function useLive2DScaleStablePointerLookTarget(
  scale: number,
  pointerLookTarget: Position | null,
) {
  const previousScaleRef = useRef(scale);
  const frozenTargetRef = useRef<Position | null>(pointerLookTarget);
  const lastResolvedTargetRef = useRef<Position | null>(pointerLookTarget);
  const settleUntilRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const [, setSettleTick] = useState(0);
  const now = typeof window === 'undefined'
    ? 0
    : window.performance?.now?.() ?? Date.now();

  if (didLive2DPointerLookScaleChange(previousScaleRef.current, scale)) {
    previousScaleRef.current = scale;
    frozenTargetRef.current = lastResolvedTargetRef.current
      ? { ...lastResolvedTargetRef.current }
      : null;
    settleUntilRef.current = now + LIVE2D_SCALE_LOOK_SETTLE_MS;
  }

  const shouldStabilize = typeof window !== 'undefined'
    && now < settleUntilRef.current;
  const stabilizedTarget = resolveLive2DScaleStablePointerLookTarget({
    currentTarget: pointerLookTarget,
    frozenTarget: frozenTargetRef.current,
    shouldStabilize,
  });

  if (!shouldStabilize) {
    lastResolvedTargetRef.current = stabilizedTarget;
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (!shouldStabilize) {
      return undefined;
    }

    const delayMs = Math.max(
      0,
      Math.ceil(settleUntilRef.current - (window.performance?.now?.() ?? Date.now())),
    );
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      setSettleTick((currentTick) => currentTick + 1);
    }, delayMs);

    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [scale, shouldStabilize]);

  return {
    shouldStabilize,
    stabilizedTarget,
  };
}

function emitLive2DFallbackBounds(options: {
  bounds?: PetVisualBounds;
  isMoving: boolean;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  petId: string;
  stageSize: number;
}) {
  const fallbackBounds = options.bounds ?? resolveLive2DFallbackBounds(options);

  options.onRuntimeEvent?.({
    bounds: fallbackBounds,
    petId: options.petId,
    runtimeKind: 'live2d',
    source: 'fallback',
    type: 'visual-bounds',
  });
  options.onVisualBoundsChange?.(fallbackBounds);
}

function resolveLive2DFallbackBounds(options: {
  isMoving: boolean;
  stageSize: number;
}) {
  void options.isMoving;
  const stageScale = Math.max(
    0.5,
    Math.min(
      LIVE2D_MAX_STAGE_SIZE / LIVE2D_BASE_STAGE_SIZE,
      (Number(options.stageSize) || LIVE2D_BASE_STAGE_SIZE) / LIVE2D_BASE_STAGE_SIZE,
    ),
  );
  return normalize2DVisualBounds({
    bottom: Math.round(116 * stageScale),
    left: Math.round(90 * stageScale),
    right: Math.round(90 * stageScale),
    top: Math.round(126 * stageScale),
  });
}

function createLive2DFallbackBoundsSignature(options: {
  bounds: PetVisualBounds;
  isMoving: boolean;
  modelUrl: string;
  petId: string;
  stageSize: number;
}) {
  const { bounds } = options;
  return [
    options.petId,
    options.modelUrl,
    options.stageSize,
    bounds.left,
    bounds.right,
    bounds.top,
    bounds.bottom,
  ].join('|');
}

function summarizeLive2DViewport(viewport: AvatarRuntimeViewport | null | undefined) {
  if (!viewport) {
    return null;
  }

  return {
    height: Math.round(Number(viewport.height) || 0),
    width: Math.round(Number(viewport.width) || 0),
    x: Math.round(Number(viewport.x) || 0),
    y: Math.round(Number(viewport.y) || 0),
  };
}

function resolveLive2DRendererStageSize(viewport: AvatarRuntimeViewport | null | undefined) {
  const viewportSize = Math.max(
    Number(viewport?.width) || 0,
    Number(viewport?.height) || 0,
  );

  return Math.max(
    LIVE2D_BASE_STAGE_SIZE,
    Math.min(LIVE2D_MAX_STAGE_SIZE, Math.round(viewportSize || LIVE2D_BASE_STAGE_SIZE)),
  );
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sharedRendererHandleRef = useRef<Live2DSharedRendererHandle | null>(null);
  const modelLayerRef = useRef<Container | null>(null);
  const modelTickerHandleRef = useRef<Live2DModelTickerHandle | null>(null);
  const createExpressionManagerRef = useRef<Live2DExpressionManagerConstructor | null>(null);
  const modelRef = useRef<Live2DModelLike | null>(null);
  const declaredParameterIdsRef = useRef<ReadonlySet<string> | null>(null);
  const live2dRuntimeProfileRef = useRef(live2dRuntimeProfile);
  live2dRuntimeProfileRef.current = live2dRuntimeProfile;
  const appliedRuntimeProfileSignatureRef = useRef('');
  const pointerLookRuntimeControllerRef = useRef<Live2DPointerLookRuntimeController | null>(null);
  const performanceRuntimeControllerRef = useRef<Live2DPerformanceRuntimeController | null>(null);
  const mouthRuntimeControllerRef = useRef<Live2DMouthRuntimeController | null>(null);
  const pointerLookStrengthRef = useRef(1);
  const lastFallbackBoundsEmissionSignatureRef = useRef('');
  const renderedVisualBoundsSignatureRef = useRef('');
  const fallbackBoundsProbeCountRef = useRef(0);
  const lastFallbackBoundsProbeSignatureRef = useRef('');
  const lookPositionRef = useRef<Live2DResolvedPointerLookPosition>({
    source: 'center',
    x: 0,
    y: 0,
  });
  const pointerLookDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const pointerLookAppliedDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const pointerLookUpperRightDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
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
  const onPointerLookDiagnosticFrame = useMemo(() => (
    isLive2DDragReleaseProbeEnabled()
      ? (frame: Live2DPointerLookFrameDiagnostic) => {
          const diagnosticContainer = containerRef.current;
          if (!diagnosticContainer) {
            return;
          }

          const writeNumber = (key: string, value: number | null) => {
            diagnosticContainer.dataset[key] = value === null ? '' : value.toFixed(4);
          };
          diagnosticContainer.dataset.live2dAppliedSource = frame.appliedSource;
          diagnosticContainer.dataset.live2dTimedSource = frame.timedSource;
          writeNumber('live2dCurrentX', frame.currentX);
          writeNumber('live2dCurrentY', frame.currentY);
          writeNumber('live2dParameterInfluence', frame.parameterInfluence);
          writeNumber('live2dTargetX', frame.targetX);
          writeNumber('live2dTargetY', frame.targetY);
          writeNumber('live2dPreAngleX', frame.preAngleX);
          writeNumber('live2dPreAngleY', frame.preAngleY);
          writeNumber('live2dPreAngleZ', frame.preAngleZ);
          writeNumber('live2dPostAngleX', frame.postAngleX);
          writeNumber('live2dPostAngleY', frame.postAngleY);
          writeNumber('live2dPostAngleZ', frame.postAngleZ);
          writeNumber('live2dSecondaryAngleX', frame.secondaryAngleX);
          writeNumber('live2dSecondaryAngleY', frame.secondaryAngleY);
          writeNumber('live2dSecondaryAngleZ', frame.secondaryAngleZ);
          writeNumber('live2dSecondaryPhysicsSuppression', frame.secondaryPhysicsSuppression);
        }
      : undefined
  ), []);
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

  const emitRenderedVisualBounds = useCallback((app: Application, measuredStageSize: number) => {
    try {
      const modelLayer = modelLayerRef.current;
      if (!modelLayer) {
        return false;
      }
      sharedRendererHandleRef.current?.syncLayout();
      const model = modelRef.current;
      if (!model) {
        return false;
      }
      // The root stage has no parent transform; calling stage.updateTransform()
      // directly throws after a model replacement. Let Pixi's renderer perform
      // the root transform pass before sampling the current model bounds.
      app.render();
      const bounds = resolveLive2DDrawableVisualBounds(model, modelLayer, measuredStageSize);
      if (!bounds) {
        return false;
      }

      const runtimeContext = runtimeContextRef.current;
      renderedVisualBoundsSignatureRef.current = `${runtimeContext.modelUrl}|${measuredStageSize}`;
      runtimeContext.onRuntimeEvent?.({
        bounds,
        petId: runtimeContext.runtimePetId,
        runtimeKind: 'live2d',
        source: 'measured',
        type: 'visual-bounds',
      });
      onVisualBoundsChangeRef.current?.(bounds);
      return true;
    } catch (error) {
      pushFrontendRuntimeError('model', 'live2d rendered bounds measurement failed', error, {
        modelUrl: runtimeContextRef.current.modelUrl,
        petId: runtimeContextRef.current.runtimePetId,
        stageSize: measuredStageSize,
      });
      return false;
    }
  }, []);
  const motionBindings = useMemo(() => {
    const manualBindings = [manualMotionBinding, manualExpressionBinding]
      .filter((binding): binding is PetModelMotionBinding => Boolean(binding));
    return manualBindings.reduce((nextBindings, binding) => (
      nextBindings.some((nextBinding) => nextBinding.id === binding.id)
        ? nextBindings
        : [...nextBindings, binding]
    ), modelMotionBindings);
  }, [manualExpressionBinding, manualMotionBinding, modelMotionBindings]);
  const effectiveManualExpressionBinding = manualExpressionBinding
    ?? (manualMotionBinding && isPetModelExpressionBinding(manualMotionBinding)
      ? manualMotionBinding
      : null);
  const manualMotionBindingForMotion = manualMotionBinding && !isPetModelExpressionBinding(manualMotionBinding)
    ? manualMotionBinding
    : null;
  const {
    shouldStabilize: shouldStabilizeScaleLook,
    stabilizedTarget: scaleStablePointerLookTarget,
  } = useLive2DScaleStablePointerLookTarget(scale, pointerLookTarget);
  const {
    settledFocusTarget: dragSettledFocusTarget,
    shouldSettle: shouldSettleLive2DLook,
  } = useLive2DDragLookSettle(isDragging, focusTarget);
  const dragSettledPointerLookTarget = resolveLive2DDragSettledPointerLookTarget({
    pointerLookTarget: scaleStablePointerLookTarget,
    shouldSettle: shouldSettleLive2DLook,
  });
  const shouldUseDragSettleCenter = shouldUseLive2DDragSettleCenter(
    shouldSettleLive2DLook,
    dragSettledFocusTarget,
  );
  const pointerLookStrength = useMemo(() => resolvePetPointerLookStrength({
    action,
    expressionAction,
    isDragging,
    isDragLookSettling: shouldSettleLive2DLook && Boolean(dragSettledFocusTarget),
    isMoving,
    manualMotionActive: Boolean(manualMotionBindingForMotion),
    manualMotionKey: manualMotionBindingForMotion?.motionKey ?? null,
  }), [
    action,
    dragSettledFocusTarget,
    expressionAction,
    isDragging,
    isMoving,
    manualMotionBindingForMotion,
    shouldSettleLive2DLook,
  ]);
  const effectivePointerLookStrength = shouldUseDragSettleCenter ? 0 : pointerLookStrength;
  const performanceRuntimeState = useMemo<Live2DPerformanceRuntimeState>(() => ({
    action,
    expressionAction,
    hoverRegion: hoverState?.activeRegion ?? null,
    isDragging,
    isMoving,
    lookSource: lookPositionRef.current.source,
    manualExpressionActive: Boolean(effectiveManualExpressionBinding),
    manualMotionActive: Boolean(manualMotionBindingForMotion),
    pointerLookStrength: effectivePointerLookStrength,
    visible,
  }), [
    action,
    effectiveManualExpressionBinding,
    effectivePointerLookStrength,
    expressionAction,
    hoverState?.activeRegion,
    isDragging,
    isMoving,
    manualMotionBindingForMotion,
    visible,
  ]);
  const performanceRuntimeStateRef = useRef(performanceRuntimeState);
  const mouthRuntimeState = useMemo<Live2DMouthRuntimeState>(() => ({
    isSpeaking,
    isTyping,
    latestMessage,
    visible,
  }), [isSpeaking, isTyping, latestMessage, visible]);
  const mouthRuntimeStateRef = useRef(mouthRuntimeState);
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

  useEffect(() => {
    presentationOptionsRef.current = {
      contentManifest: contentManifestOverride,
      live2dRuntimeProfile,
      motionBindings,
      stageSize,
      visible,
    };
  }, [contentManifestOverride, live2dRuntimeProfile, motionBindings, stageSize, visible]);

  useEffect(() => {
    pointerLookStrengthRef.current = effectivePointerLookStrength;
  }, [effectivePointerLookStrength]);

  useEffect(() => {
    performanceRuntimeStateRef.current = performanceRuntimeState;
  }, [performanceRuntimeState]);

  useEffect(() => {
    mouthRuntimeStateRef.current = mouthRuntimeState;
  }, [mouthRuntimeState]);

  useEffect(() => {
    runtimeContextRef.current = {
      modelRuntimeUrl,
      modelUrl,
      onRuntimeEvent,
      runtimePetId,
    };
  }, [modelRuntimeUrl, modelUrl, onRuntimeEvent, runtimePetId]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    sharedRendererHandleRef.current?.setStageSize(stageSize);
    const model = modelRef.current;
    if (model) {
      syncLive2DModelPresentation(
        model,
        presentationOptionsRef.current,
        createExpressionManagerRef.current,
      );
      emitRenderedVisualBounds(app, stageSize);
    }
    sharedRendererHandleRef.current?.syncLayout();
  }, [emitRenderedVisualBounds, stageSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const sharedRendererHandle = acquireLive2DSharedRenderer(container, stageSize, runtimePetId);
    sharedRendererHandleRef.current = sharedRendererHandle;
    appRef.current = sharedRendererHandle.app;
    modelLayerRef.current = sharedRendererHandle.layer;

    return () => {
      if (appRef.current === sharedRendererHandle.app) {
        appRef.current = null;
      }
      if (sharedRendererHandleRef.current === sharedRendererHandle) {
        sharedRendererHandleRef.current = null;
      }
      if (modelLayerRef.current === sharedRendererHandle.layer) {
        modelLayerRef.current = null;
      }
      sharedRendererHandle.release();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const app = appRef.current;
    if (!app || !modelRuntimeUrl.trim()) {
      return undefined;
    }
    let loadedModel: Live2DModelLike | null = null;
    let presentationProbeTimeoutId: number | null = null;
    let delayedPresentationProbeTimeoutId: number | null = null;

    void (async () => {
      try {
        const {
          Cubism4ExpressionManager,
          Live2DModel,
          MotionPreloadStrategy,
        } = await loadLive2DCubism4Runtime();
        createExpressionManagerRef.current = Cubism4ExpressionManager as Live2DExpressionManagerConstructor;
        if (cancelled) {
          return;
        }

        const model = await Live2DModel.from(modelRuntimeUrl, {
          autoInteract: false,
          autoUpdate: false,
          motionPreload: MotionPreloadStrategy.IDLE,
        }) as Live2DModelLike;
        if (cancelled || appRef.current !== app) {
          model.destroy();
          return;
        }

        loadedModel = model;
        const declaredParameterIds = await loadLive2DDeclaredParameterIds(model);
        if (cancelled || appRef.current !== app) {
          if (loadedModel === model) {
            loadedModel = null;
            model.destroy();
          }
          return;
        }
        declaredParameterIdsRef.current = declaredParameterIds;
        const currentRuntimeProfileConfig = live2dRuntimeProfileRef.current;
        const runtimeProfile = resolveLive2DRuntimeProfileForModel(
          model,
          currentRuntimeProfileConfig,
          declaredParameterIds,
        );
        const physicsWarmup = warmLive2DComplexPhysicsRig({
          complexPhysicsRig: runtimeProfile.capabilities.complexPhysicsRig,
          model,
          startNowMs: model.elapsedTime,
        });
        if (runtimeProfile.capabilities.complexPhysicsRig) {
          pushFrontendRuntimeLog('model', 'live2d complex physics warmup', {
            completed: physicsWarmup.completed,
            errorMessage: physicsWarmup.errorMessage,
            frameCount: physicsWarmup.frameCount,
            modelUrl: runtimeContextRef.current.modelUrl,
            petId: runtimeContextRef.current.runtimePetId,
          });
        }
        appliedRuntimeProfileSignatureRef.current = JSON.stringify(currentRuntimeProfileConfig ?? null);
        syncLive2DModelPresentation(
          model,
          {
            ...presentationOptionsRef.current,
            live2dRuntimeProfile: currentRuntimeProfileConfig,
          },
          createExpressionManagerRef.current,
        );
        const modelLayer = modelLayerRef.current;
        if (!modelLayer) {
          model.destroy({ baseTexture: false, children: true, texture: false });
          throw new Error('Live2D shared renderer layer is unavailable.');
        }
        modelLayer.addChild(model);
        modelRef.current = model;
        const runtimeContext = runtimeContextRef.current;
        const runtimeControllers = replaceLive2DRuntimeControllers({
          bootstrapMode: 'model-load',
          currentControllers: {
            mouth: mouthRuntimeControllerRef.current,
            performance: performanceRuntimeControllerRef.current,
            pointerLook: pointerLookRuntimeControllerRef.current,
          },
          lookPosition: lookPositionRef.current,
          model,
          modelRuntimeUrl: runtimeContext.modelRuntimeUrl,
          modelUrl: runtimeContext.modelUrl,
          onDiagnosticFrame: onPointerLookDiagnosticFrame,
          mouthState: mouthRuntimeStateRef.current,
          performanceState: performanceRuntimeStateRef.current,
          petId: runtimeContext.runtimePetId,
          pointerLookStrength: pointerLookStrengthRef.current,
          runtimeProfile,
        });
        pointerLookRuntimeControllerRef.current = runtimeControllers.pointerLook;
        performanceRuntimeControllerRef.current = runtimeControllers.performance;
        mouthRuntimeControllerRef.current = runtimeControllers.mouth;
        model.autoUpdate = false;
        modelTickerHandleRef.current?.release();
        modelTickerHandleRef.current = attachLive2DModelToApplicationTicker(app, model, {
          onError: (error, consecutiveErrorCount) => {
            pushFrontendRuntimeError(
              'model',
              `live2d model ticker boundary failed pet=${runtimeContext.runtimePetId}`,
              error,
              {
                consecutiveErrorCount,
                modelUrl: runtimeContext.modelUrl,
              },
            );
          },
          petId: runtimeContext.runtimePetId,
        });
        app.start();
        app.render();
        emitRenderedVisualBounds(app, presentationOptionsRef.current.stageSize);
        const runPresentationProbe = (sampleDelayMs: number) => {
          if (cancelled || modelRef.current !== model || appRef.current !== app) {
            return;
          }

          try {
            app.render();
            const canvasRect = app.view.getBoundingClientRect();
            const container = containerRef.current;
            const containerRect = container?.getBoundingClientRect() ?? null;
            const parentRect = container?.parentElement?.getBoundingClientRect() ?? null;
            const localBounds = model.getLocalBounds();
            const drawableBounds = modelLayerRef.current
              ? resolveLive2DDrawableVisualBounds(model, modelLayerRef.current, stageSize)
              : null;
            const rendererWithContext = app.renderer as unknown as {
              gl?: { isContextLost?: () => boolean };
            };
            const contextLost = typeof rendererWithContext.gl?.isContextLost === 'function'
              ? rendererWithContext.gl.isContextLost()
              : null;
            const summarizeRect = (rect: DOMRect | null) => rect
              ? {
                  height: Number(rect.height.toFixed(2)),
                  left: Number(rect.left.toFixed(2)),
                  top: Number(rect.top.toFixed(2)),
                  width: Number(rect.width.toFixed(2)),
                }
              : null;
            const computedStyle = container ? window.getComputedStyle(container) : null;
            pushFrontendRuntimeLog('model', 'TEMP live2d presentation probe', {
              sampleDelayMs,
              canvas: {
                clientHeight: app.view.clientHeight,
                clientWidth: app.view.clientWidth,
                connected: app.view.isConnected,
                height: app.view.height,
                rect: summarizeRect(canvasRect),
                width: app.view.width,
              },
              container: {
                connected: Boolean(container?.isConnected),
                opacity: computedStyle?.opacity ?? null,
                rect: summarizeRect(containerRect),
                visibility: computedStyle?.visibility ?? null,
                zIndex: computedStyle?.zIndex ?? null,
              },
              contextLost,
              model: {
                anchor: { x: model.anchor.x, y: model.anchor.y },
                height: model.height,
                localBounds: {
                  height: localBounds.height,
                  width: localBounds.width,
                  x: localBounds.x,
                  y: localBounds.y,
                },
                pivot: { x: model.pivot.x, y: model.pivot.y },
                position: { x: model.x, y: model.y },
                renderable: model.renderable,
                scale: { x: model.scale.x, y: model.scale.y },
                visible: model.visible,
                width: model.width,
              },
              modelUrl: runtimeContext.modelUrl,
              petId: runtimeContext.runtimePetId,
              parentRect: summarizeRect(parentRect),
              renderedDrawableBounds: drawableBounds,
              renderer: {
                height: app.renderer.height,
                resolution: app.renderer.resolution,
                screenHeight: app.renderer.screen.height,
                screenWidth: app.renderer.screen.width,
                width: app.renderer.width,
              },
              runtimeUrl: runtimeContext.modelRuntimeUrl,
              stageSize,
            });
          } catch (error) {
            pushFrontendRuntimeError('model', 'TEMP live2d presentation probe failed', error, {
              modelUrl: runtimeContext.modelUrl,
              petId: runtimeContext.runtimePetId,
              runtimeUrl: runtimeContext.modelRuntimeUrl,
            });
          }
        };
        presentationProbeTimeoutId = window.setTimeout(() => {
          presentationProbeTimeoutId = null;
          runPresentationProbe(120);
        }, 120);
        delayedPresentationProbeTimeoutId = window.setTimeout(() => {
          delayedPresentationProbeTimeoutId = null;
          runPresentationProbe(600);
        }, 600);
        setRuntimeReadyVersion((currentVersion) => currentVersion + 1);
        runtimeContext.onRuntimeEvent?.({
          petId: runtimeContext.runtimePetId,
          runtimeKind: 'live2d',
          type: 'ready',
        });
        pushFrontendRuntimeLog('model', `live2d runtime ready pet=${runtimeContext.runtimePetId}`, {
          performanceParameters: performanceRuntimeControllerRef.current?.summary ?? null,
          pointerLookParameters: pointerLookRuntimeControllerRef.current?.summary ?? null,
          modelUrl: runtimeContext.modelUrl,
          runtimeProfile: {
            capabilities: runtimeProfile.capabilities,
            layout: runtimeProfile.layout,
            profileVersion: runtimeProfile.profileVersion,
          },
          runtimeUrl: runtimeContext.modelRuntimeUrl,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        const runtimeContext = runtimeContextRef.current;
        runtimeContext.onRuntimeEvent?.({
          errorMessage,
          petId: runtimeContext.runtimePetId,
          runtimeKind: 'live2d',
          type: 'error',
        });
        pushFrontendRuntimeError('model', `live2d runtime failed pet=${runtimeContext.runtimePetId}`, error, {
          modelUrl: runtimeContext.modelUrl,
          runtimeUrl: runtimeContext.modelRuntimeUrl,
        });
      }
    })();

    return () => {
      cancelled = true;
      if (presentationProbeTimeoutId !== null) {
        window.clearTimeout(presentationProbeTimeoutId);
        presentationProbeTimeoutId = null;
      }
      if (delayedPresentationProbeTimeoutId !== null) {
        window.clearTimeout(delayedPresentationProbeTimeoutId);
        delayedPresentationProbeTimeoutId = null;
      }
      resetMotionExpressionSignaturesRef.current();
      modelTickerHandleRef.current?.release();
      modelTickerHandleRef.current = null;
      createExpressionManagerRef.current = null;
      mouthRuntimeControllerRef.current?.destroy();
      mouthRuntimeControllerRef.current = null;
      performanceRuntimeControllerRef.current?.destroy();
      performanceRuntimeControllerRef.current = null;
      pointerLookRuntimeControllerRef.current?.destroy();
      pointerLookRuntimeControllerRef.current = null;
      const model = loadedModel;
      loadedModel = null;
      if (model) {
        if (model.parent) {
          model.parent.removeChild(model);
        }
        model.destroy({ baseTexture: false, children: true, texture: false });
      }
      if (modelRef.current === model) {
        modelRef.current = null;
        declaredParameterIdsRef.current = null;
      }
    };
  }, [modelRuntimeUrl]);

  useEffect(() => {
    if (isDragging) {
      lastFallbackBoundsEmissionSignatureRef.current = '';
      if (
        isLive2DDragReleaseProbeEnabled()
        && fallbackBoundsProbeCountRef.current < LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT
      ) {
        fallbackBoundsProbeCountRef.current += 1;
        pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d fallback bounds probe', {
          emitted: false,
          fallbackBounds: null,
          isDragging,
          isMoving,
          petId: runtimePetId,
          reason: 'dragging-reset',
          stageSize,
          viewport: summarizeLive2DViewport(viewport),
        });
      }
      return;
    }

    const fallbackBounds = resolveLive2DFallbackBounds({
      isMoving,
      stageSize,
    });
    if (renderedVisualBoundsSignatureRef.current === `${modelUrl}|${stageSize}`) {
      return;
    }
    const fallbackBoundsSignature = createLive2DFallbackBoundsSignature({
      bounds: fallbackBounds,
      isMoving,
      modelUrl,
      petId: runtimePetId,
      stageSize,
    });
    if (lastFallbackBoundsEmissionSignatureRef.current === fallbackBoundsSignature) {
      const skipProbeSignature = `skip|${fallbackBoundsSignature}`;
      if (
        isLive2DDragReleaseProbeEnabled()
        && fallbackBoundsProbeCountRef.current < LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT
        && lastFallbackBoundsProbeSignatureRef.current !== skipProbeSignature
      ) {
        fallbackBoundsProbeCountRef.current += 1;
        lastFallbackBoundsProbeSignatureRef.current = skipProbeSignature;
        pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d fallback bounds probe', {
          emitted: false,
          fallbackBounds,
          fallbackBoundsSignature,
          isDragging,
          isMoving,
          petId: runtimePetId,
          reason: 'same-signature',
          stageSize,
          viewport: summarizeLive2DViewport(viewport),
        });
      }
      return;
    }
    lastFallbackBoundsEmissionSignatureRef.current = fallbackBoundsSignature;

    if (
      isLive2DDragReleaseProbeEnabled()
      && fallbackBoundsProbeCountRef.current < LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT
    ) {
      fallbackBoundsProbeCountRef.current += 1;
      lastFallbackBoundsProbeSignatureRef.current = `emit|${fallbackBoundsSignature}`;
      pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d fallback bounds probe', {
        emitted: true,
        fallbackBounds,
        fallbackBoundsSignature,
        isDragging,
        isMoving,
        petId: runtimePetId,
        reason: 'signature-changed',
        stageSize,
        viewport: summarizeLive2DViewport(viewport),
      });
    }

    emitLive2DFallbackBounds({
      bounds: fallbackBounds,
      isMoving,
      onRuntimeEvent,
      onVisualBoundsChange,
      petId: runtimePetId,
      stageSize,
    });
  }, [isDragging, isMoving, modelUrl, onRuntimeEvent, onVisualBoundsChange, runtimePetId, stageSize, viewport]);

  useEffect(() => {
    pushPointerLookDiagnosticLog(
      pointerLookDiagnosticsRef.current,
      'live2d renderer received pointer look target',
      [
        runtimePetId,
        createPointerLookTargetSignature(pointerLookTarget),
      ],
      {
        focusTarget: summarizePointerLookTarget(focusTarget),
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(pointerLookTarget),
        runtimePetId,
        visible,
      },
    );
  }, [focusTarget, modelUrl, pointerLookTarget, runtimePetId, visible]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) {
      return;
    }

    syncLive2DModelPresentation(
      model,
      {
        contentManifest: contentManifestOverride,
        live2dRuntimeProfile,
        motionBindings,
        stageSize,
        visible,
      },
      createExpressionManagerRef.current,
    );
  }, [contentManifestOverride, live2dRuntimeProfile, motionBindings, runtimeReadyVersion, stageSize, visible]);

  useEffect(() => {
    if (appliedRuntimeProfileSignatureRef.current === runtimeProfileSignature) {
      return;
    }

    const model = modelRef.current;
    if (!model) {
      return;
    }

    const runtimeContext = runtimeContextRef.current;
    const currentRuntimeProfileConfig = live2dRuntimeProfileRef.current;
    const runtimeProfile = resolveLive2DRuntimeProfileForModel(
      model,
      currentRuntimeProfileConfig,
      declaredParameterIdsRef.current,
    );
    syncLive2DModelPresentation(
      model,
      {
        ...presentationOptionsRef.current,
        live2dRuntimeProfile: currentRuntimeProfileConfig,
      },
      createExpressionManagerRef.current,
    );
    const runtimeControllers = replaceLive2DRuntimeControllers({
      bootstrapMode: 'preserve-input',
      currentControllers: {
        mouth: mouthRuntimeControllerRef.current,
        performance: performanceRuntimeControllerRef.current,
        pointerLook: pointerLookRuntimeControllerRef.current,
      },
      lookPosition: lookPositionRef.current,
      model,
      modelRuntimeUrl: runtimeContext.modelRuntimeUrl,
      modelUrl: runtimeContext.modelUrl,
      onDiagnosticFrame: onPointerLookDiagnosticFrame,
      mouthState: mouthRuntimeStateRef.current,
      performanceState: performanceRuntimeStateRef.current,
      petId: runtimeContext.runtimePetId,
      pointerLookStrength: pointerLookStrengthRef.current,
      runtimeProfile,
    });
    pointerLookRuntimeControllerRef.current = runtimeControllers.pointerLook;
    performanceRuntimeControllerRef.current = runtimeControllers.performance;
    mouthRuntimeControllerRef.current = runtimeControllers.mouth;
    appliedRuntimeProfileSignatureRef.current = runtimeProfileSignature;
    appRef.current?.render();
    if (appRef.current) {
      emitRenderedVisualBounds(appRef.current, stageSize);
    }
    pushFrontendRuntimeLog('model', `live2d runtime profile hot updated pet=${runtimeContext.runtimePetId}`, {
      capabilities: runtimeProfile.capabilities,
      layout: runtimeProfile.layout,
      modelUrl: runtimeContext.modelUrl,
      profileVersion: runtimeProfile.profileVersion,
    });
  }, [emitRenderedVisualBounds, onPointerLookDiagnosticFrame, runtimeProfileSignature, runtimeReadyVersion, stageSize]);

  useEffect(() => {
    const model = modelRef.current;
    const lookPosition = shouldUseDragSettleCenter
      ? LIVE2D_DRAG_SETTLE_LOOK_POSITION
      : resolveLive2DLookPosition({
          focusTarget: dragSettledFocusTarget,
          pointerLookTarget: dragSettledPointerLookTarget,
        });
    const pointerLookRuntimeController = pointerLookRuntimeControllerRef.current;
    lookPositionRef.current = lookPosition;
    performanceRuntimeControllerRef.current?.setState({
      lookSource: lookPosition.source,
    });
    pointerLookRuntimeController?.setStrength(effectivePointerLookStrength);
    pointerLookRuntimeController?.updateInputTarget(lookPosition);

    if (model && !pointerLookRuntimeController) {
      try {
        model.focus(lookPosition.x, lookPosition.y);
      } catch (error) {
        pushFrontendRuntimeError('model', `live2d focus pointer look failed pet=${runtimePetId}`, error, {
          focusPosition: {
            x: Number(lookPosition.x.toFixed(3)),
            y: Number(lookPosition.y.toFixed(3)),
          },
          focusTarget: summarizePointerLookTarget(dragSettledFocusTarget),
          modelUrl,
          pointerLookTarget: summarizePointerLookTarget(dragSettledPointerLookTarget),
          runtimePetId,
          source: lookPosition.source,
        });
      }
    }

    if (lookPosition.source !== 'center') {
      if (lookPosition.x > 0.12 && lookPosition.y > 0.03) {
        pushPointerLookTraceLog(
          pointerLookUpperRightDiagnosticsRef.current,
          'live2d upper-right trace renderer input',
          [
            runtimePetId,
            lookPosition.source,
            lookPosition.x.toFixed(3),
            lookPosition.y.toFixed(3),
            createPointerLookTargetSignature(dragSettledPointerLookTarget),
            createPointerLookTargetSignature(dragSettledFocusTarget),
          ],
          {
            action,
            expressionAction,
            focusPosition: {
              x: Number(lookPosition.x.toFixed(3)),
              y: Number(lookPosition.y.toFixed(3)),
            },
            focusTarget: summarizePointerLookTarget(dragSettledFocusTarget),
            hoverRegion: hoverState?.activeRegion ?? null,
            isMoving,
            manualExpressionActive: Boolean(effectiveManualExpressionBinding),
            manualMotionActive: Boolean(manualMotionBindingForMotion),
            modelUrl,
            pointerLookStrength: effectivePointerLookStrength,
            pointerLookTarget: summarizePointerLookTarget(dragSettledPointerLookTarget),
            runtimePetId,
            source: lookPosition.source,
            visible,
          },
          1200,
        );
      }
      pushPointerLookDiagnosticLog(
        pointerLookAppliedDiagnosticsRef.current,
        'live2d pointer look applied',
        [
          runtimePetId,
          createPointerLookTargetSignature(dragSettledPointerLookTarget),
          lookPosition.source,
          lookPosition.x.toFixed(3),
          lookPosition.y.toFixed(3),
        ],
        {
          focusPosition: {
            x: Number(lookPosition.x.toFixed(3)),
            y: Number(lookPosition.y.toFixed(3)),
          },
          focusTarget: summarizePointerLookTarget(dragSettledFocusTarget),
          hoverRegion: hoverState?.activeRegion ?? null,
          isMoving,
          manualExpressionActive: Boolean(effectiveManualExpressionBinding),
          manualMotionActive: Boolean(manualMotionBindingForMotion),
          parameterController: pointerLookRuntimeControllerRef.current?.summary ?? null,
          modelUrl,
          pointerLookStrength: effectivePointerLookStrength,
          pointerLookTarget: summarizePointerLookTarget(dragSettledPointerLookTarget),
          runtimePetId,
          source: lookPosition.source,
        },
      );
      return;
    }

    pushPointerLookDiagnosticLog(
      pointerLookAppliedDiagnosticsRef.current,
      'live2d pointer look applied',
      [runtimePetId, 'center'],
      {
        focusTarget: summarizePointerLookTarget(dragSettledFocusTarget),
        focusPosition: { x: 0, y: 0 },
        parameterController: pointerLookRuntimeControllerRef.current?.summary ?? null,
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(dragSettledPointerLookTarget),
        runtimePetId,
        source: lookPosition.source,
      },
    );
  }, [
    action,
    effectiveManualExpressionBinding,
    effectivePointerLookStrength,
    expressionAction,
    dragSettledFocusTarget,
    hoverState?.activeRegion,
    isMoving,
    manualMotionBindingForMotion,
    modelUrl,
    dragSettledPointerLookTarget,
    runtimePetId,
    shouldUseDragSettleCenter,
    visible,
  ]);

  useEffect(() => {
    pointerLookRuntimeControllerRef.current?.setStrength(effectivePointerLookStrength);
  }, [effectivePointerLookStrength, runtimeReadyVersion]);

  useEffect(() => {
    performanceRuntimeControllerRef.current?.setState({
      ...performanceRuntimeState,
      lookSource: lookPositionRef.current.source,
    });
  }, [performanceRuntimeState, runtimeReadyVersion]);

  useEffect(() => {
    mouthRuntimeControllerRef.current?.setState(mouthRuntimeState);
  }, [mouthRuntimeState, runtimeReadyVersion]);

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
