import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  resolvePetModel3DMinimumCameraDistance,
  resolvePetModel3DProjectedVisualBounds,
} from '../../components/pet/pet3DPresentationMath';
import { normalize3DVisualBounds, type PetVisualBounds } from '../../components/pet/petVisualBounds';
import { type Avatar3DActionState } from './avatar3dActionState';
import {
  resolveAvatar3DMotionState,
  shouldPrioritizeAvatar3DMotionPlayback,
  type Avatar3DManualMotionSelection,
} from './avatar3dMotionStateController';
import { resolveAvatar3DModelLayout } from './avatar3dModelLayout';
import { type Avatar3DReactionState } from './useAvatar3DReactionState';
import { type Avatar3DManualOrbitState } from './useAvatar3DManualOrbitController';
import { type Avatar3DRuntimeInstance } from './avatar3dRuntimeInstance';
import { type PetHoverState } from '../interactions/petHoverController';
import { type PetContentManifest } from '../content/petContentManifest';
import { type Avatar3DDragMotionState } from './avatar3dDragMotionState';
import { createGenericAvatar3DLookAtDebugSummary } from './avatar3dGenericLookAtController';
import { resolvePetPointerLookStrength } from '../interactions/petPointerLookPriority';
import {
  createAvatar3DCanvasVisualBoundsSampler,
  measureAvatar3DCanvasVisualBounds,
  mergeAvatar3DVisualBounds,
} from './avatar3dCanvasVisualBounds';
import { type Avatar3DRuntimeUpdatePriority } from './useAvatar3DRuntimeSleepState';
import { type AvatarRuntimePerfStats } from '../avatar-runtime/avatarRuntimeEvents';

const REALTIME_VISUAL_BOUNDS_SAMPLE_INTERVAL_MS = 320;
const REALTIME_VISUAL_BOUNDS_EXTENDED_SAMPLE_INTERVAL_MS = 240;
const REALTIME_VISUAL_BOUNDS_EMIT_THRESHOLD_PX = 12;

type FocusTarget = {
  x: number;
  y: number;
};

function summarizeDebugList(items: string[] | undefined, maxItems = 6) {
  if (!items?.length) {
    return 'none';
  }

  const trimmedItems = items
    .map((item) => item.trim())
    .filter(Boolean);
  if (!trimmedItems.length) {
    return 'none';
  }

  if (trimmedItems.length <= maxItems) {
    return trimmedItems.join('|');
  }

  return `${trimmedItems.slice(0, maxItems).join('|')}|+${trimmedItems.length - maxItems}`;
}

function hasMeaningfulVisualBoundsChange(
  previousBounds: PetVisualBounds | null,
  nextBounds: PetVisualBounds,
) {
  if (!previousBounds) {
    return true;
  }

  return Math.abs(previousBounds.left - nextBounds.left) >= REALTIME_VISUAL_BOUNDS_EMIT_THRESHOLD_PX
    || Math.abs(previousBounds.right - nextBounds.right) >= REALTIME_VISUAL_BOUNDS_EMIT_THRESHOLD_PX
    || Math.abs(previousBounds.top - nextBounds.top) >= REALTIME_VISUAL_BOUNDS_EMIT_THRESHOLD_PX
    || Math.abs(previousBounds.bottom - nextBounds.bottom) >= REALTIME_VISUAL_BOUNDS_EMIT_THRESHOLD_PX;
}

function isPointerDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('pointerDiagnostics') === '1';
}

export interface Avatar3DRuntimeMountProps {
  actionState: Avatar3DActionState;
  autoRotateSpeed: number;
  baseCameraDistance: number;
  cameraFocusYRatio: number;
  cameraTargetY: number;
  sceneComplexityScore?: number;
  contentManifest?: PetContentManifest | null;
  dragMotionState?: Avatar3DDragMotionState;
  focusTarget?: FocusTarget | null;
  fitToPreview?: boolean;
  hoverState?: PetHoverState;
  pointerLookTarget?: FocusTarget | null;
  lookAtYOffset: number;
  manualMotionSelection?: Avatar3DManualMotionSelection | null;
  manualOrbitRef: MutableRefObject<Avatar3DManualOrbitState>;
  onExpressionStateChange?: (expressionKey: string | null) => void;
  onMotionStateChange?: (motionKey: string | null) => void;
  onPerfStatsChange?: (stats: AvatarRuntimePerfStats) => void;
  onRuntimeReady?: () => void;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  reactionState?: Avatar3DReactionState;
  renderFrameIntervalMs?: number;
  runtimeSleeping?: boolean;
  runtimeInstance: Avatar3DRuntimeInstance;
  runtimeDebugLabel?: string;
  scale?: number;
  sceneQualityLabel?: string;
  shouldPreferLowPowerRendering?: boolean;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
  useDemandFrameLoop?: boolean;
}

export function Avatar3DRuntimeMount({
  actionState,
  autoRotateSpeed,
  baseCameraDistance,
  cameraFocusYRatio,
  cameraTargetY,
  sceneComplexityScore = 0,
  contentManifest = null,
  dragMotionState,
  focusTarget,
  fitToPreview = false,
  hoverState,
  pointerLookTarget = null,
  lookAtYOffset,
  manualMotionSelection = null,
  manualOrbitRef,
  onExpressionStateChange,
  onMotionStateChange,
  onPerfStatsChange,
  onRuntimeReady,
  onVisualBoundsChange,
  reactionState,
  renderFrameIntervalMs = 16,
  runtimeSleeping = false,
  runtimeInstance,
  runtimeDebugLabel,
  scale = 1,
  sceneQualityLabel = 'pets-1',
  shouldPreferLowPowerRendering = false,
  updatePriority = 'companion',
  useDemandFrameLoop = false,
}: Avatar3DRuntimeMountProps) {
  const rootRef = useRef<THREE.Group>(null);
  const dragTiltRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const pointerLookTiltRef = useRef<THREE.Group>(null);
  const pointerLookDiagnosticRef = useRef({ lastAt: 0, signature: '' });
  const dragVelocityRef = useRef({ x: 0, y: 0 });
  const loggedObjectRef = useRef<THREE.Object3D | null>(null);
  const firstFrameLoggedRef = useRef(false);
  const lastMotionKeyRef = useRef<string | null | undefined>(undefined);
  const lastExpressionKeyRef = useRef<string | null | undefined>(undefined);
  const lastPerfStatsRef = useRef<AvatarRuntimePerfStats | undefined>(undefined);
  const lastRealtimeVisualBoundsSampleAtRef = useRef(0);
  const lastEmittedVisualBoundsRef = useRef<PetVisualBounds | null>(null);
  const visualBoundsSamplerRef = useRef<ReturnType<typeof createAvatar3DCanvasVisualBoundsSampler>>(null);
  const { camera, gl, invalidate, scene, size } = useThree();
  const effectivePresentationScale = useMemo(
    () => scale * Math.max(1, actionState.scalePeak),
    [actionState.scalePeak, scale],
  );
  const modelLayout = useMemo(
    () => resolveAvatar3DModelLayout(runtimeInstance.object),
    [runtimeInstance.object],
  );
  const effectiveScale = effectivePresentationScale;
  const minimumCameraDistance = useMemo(
    () => resolvePetModel3DMinimumCameraDistance(
      modelLayout.boundsSize,
      modelLayout.normalizedScale,
      effectiveScale,
      size.width / Math.max(1, size.height),
      camera instanceof THREE.PerspectiveCamera ? camera.fov : 45,
    ),
    [camera, effectiveScale, modelLayout.boundsSize, modelLayout.normalizedScale, size.height, size.width],
  );
  const previewCameraDistance = useMemo(() => {
    if (!fitToPreview) {
      return null;
    }
    const height = Math.max(0.001, modelLayout.boundsSize[1] * modelLayout.normalizedScale * effectiveScale);
    const depth = Math.max(0.001, modelLayout.boundsSize[2] * modelLayout.normalizedScale * effectiveScale);
    const verticalFovDegrees = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    const verticalFovRadians = (verticalFovDegrees * Math.PI) / 180;
    // Keep body height consistent in the settings card. Width is deliberately
    // not the fit driver: a T-pose must not shrink the entire character.
    return Number((height * 0.5 / Math.tan(verticalFovRadians / 2) * 1.16 + depth * 0.35).toFixed(3));
  }, [camera, effectiveScale, fitToPreview, modelLayout.boundsSize, modelLayout.normalizedScale]);
  const targetCameraDistance = useMemo(
    () => fitToPreview && previewCameraDistance !== null
      ? previewCameraDistance
      : Math.max(baseCameraDistance, minimumCameraDistance),
    [baseCameraDistance, fitToPreview, minimumCameraDistance, previewCameraDistance],
  );
  const focusY = useMemo(() => {
    const appliedScale = modelLayout.normalizedScale * Math.max(0.01, effectiveScale);
    const groundedHeight = Math.max(0.4, modelLayout.boundsSize[1] * appliedScale);
    // Keep the regular desktop view near the body center, but let
    // interactive dialogue re-anchor the camera toward the upper body.
    return fitToPreview
      ? 0
      : Math.min(1.4, Math.max(0.08, groundedHeight * cameraFocusYRatio));
  }, [
    cameraFocusYRatio,
    fitToPreview,
    modelLayout.boundsSize,
    modelLayout.normalizedScale,
    effectiveScale,
  ]);
  const projectedVisualBounds = useMemo(
    () => normalize3DVisualBounds(
      resolvePetModel3DProjectedVisualBounds({
        boundsSize: modelLayout.boundsSize,
        cameraDistance: targetCameraDistance,
        normalizedScale: modelLayout.normalizedScale,
        scale: effectiveScale,
        verticalFovDegrees: camera instanceof THREE.PerspectiveCamera ? camera.fov : 45,
        viewportHeight: size.height,
        viewportWidth: size.width,
      }),
      actionState.visualIsMoving,
    ),
    [actionState.visualIsMoving, camera, effectiveScale, modelLayout.boundsSize, modelLayout.normalizedScale, size.height, size.width, targetCameraDistance],
  );
  const motionState = useMemo(() => resolveAvatar3DMotionState({
    contentManifest,
    manualMotionSelection,
    motionOverrideState: reactionState?.motionOverrideState,
    snapshot: actionState.snapshot,
    visualMode: actionState.visualMode,
  }), [actionState.snapshot, actionState.visualMode, contentManifest, manualMotionSelection, reactionState?.motionOverrideState]);
  const pointerLookStrength = useMemo(() => resolvePetPointerLookStrength({
    action: actionState.snapshot.baseAction,
    expressionAction: actionState.snapshot.expressionAction,
    isMoving: actionState.snapshot.requestedIsMoving,
    manualMotionActive: Boolean(manualMotionSelection?.candidateClipNames.length),
    manualMotionKey: manualMotionSelection?.motionKey ?? null,
    motionKey: motionState.motionKey,
    motionMode: motionState.mode,
    motionSource: motionState.source,
  }), [
    actionState.snapshot.baseAction,
    actionState.snapshot.expressionAction,
    actionState.snapshot.requestedIsMoving,
    manualMotionSelection,
    motionState.motionKey,
    motionState.mode,
    motionState.source,
  ]);
  const reactionSummary = useMemo(() => ({
    activeExpression: reactionState?.expressionState.activeAction ?? null,
    expressionContentKey: reactionState?.expressionState.activeCue?.expressionKey ?? null,
    expressionCueRegion: reactionState?.expressionState.activeCue?.region ?? null,
    expressionCueCount: reactionState?.expressionState.cues.length ?? 0,
    expressionSource: reactionState?.expressionState.source ?? 'none',
    expressionWeight: reactionState?.expressionState.activeCue?.weightMultiplier ?? 1,
    interactionAutoRotateMultiplier: reactionState?.interactionState.autoRotateMultiplier ?? 1,
    interactionFocusLerp: reactionState?.interactionState.focusLerp ?? 0.12,
    interactionIdlePitchOffset: reactionState?.interactionState.idlePitchOffset ?? 0,
    interactionPitchScale: reactionState?.interactionState.pitchScale ?? 0.24,
    interactionRollOffset: reactionState?.interactionState.rollOffset ?? 0,
    interactionSource: reactionState?.interactionState.source ?? 'none',
    interactionWeight: reactionState?.interactionState.presentationWeight ?? 1,
    interactionYawScale: reactionState?.interactionState.yawScale ?? 0.72,
    speechActive: Boolean(reactionState?.lipSyncState.isActive),
    viseme: reactionState?.lipSyncState.viseme ?? null,
  }), [reactionState]);
  const actionSummary = useMemo(() => ({
    animationDurationMs: actionState.animationDurationMs,
    motionBaseKey: motionState.baseMotionKey,
    motionCandidateClipNames: motionState.candidateClipNames,
    motionCompletionCandidates: motionState.completionCandidateClipNames,
    motionCompletionMode: motionState.completionMode,
    motionCompletionKey: motionState.completionMotionKey,
    motionCompletionResolvedKeys: motionState.completionResolvedMotionKeys,
    motionFallbackKeys: motionState.fallbackMotionKeys,
    motionClipPlaybackMode: motionState.clipPlaybackMode,
    motionKey: motionState.motionKey,
    motionLoopMode: motionState.loopMode,
    motionMode: motionState.mode,
    motionOverrideKey: motionState.overrideMotionKey,
    motionPlaybackRate: motionState.playbackRate,
    motionResolvedKeys: motionState.resolvedMotionKeys,
    motionSource: motionState.source,
    scaleBase: actionState.scaleBase,
    scalePeak: actionState.scalePeak,
    sceneQualityLabel,
    wrapperClassName: actionState.wrapperClassName,
    wrapperClassSource: actionState.wrapperClassSource,
    visualMode: actionState.visualMode,
  }), [actionState, motionState, sceneQualityLabel]);
  const resolvedExpressionKey = useMemo(
    () => reactionSummary.expressionContentKey ?? reactionSummary.activeExpression ?? null,
    [reactionSummary.activeExpression, reactionSummary.expressionContentKey],
  );
  const shouldPrioritizeMotionPlayback = shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: Boolean(manualMotionSelection?.candidateClipNames.length),
    motionState,
    runtimeSleeping,
  });
  const effectiveRenderFrameIntervalMs = useMemo(() => {
    const baseIntervalMs = Math.max(16, Math.round(renderFrameIntervalMs));
    if (shouldPrioritizeMotionPlayback) {
      return 16;
    }

    if (sceneQualityLabel === 'pets-1' && sceneComplexityScore < 24 && !shouldPreferLowPowerRendering) {
      return baseIntervalMs;
    }

    const debug = runtimeInstance.debugSummary;
    let intervalPenaltyMs = 0;

    if (debug.skinnedMeshCount >= 18) {
      intervalPenaltyMs += 6;
    } else if (debug.skinnedMeshCount >= 10) {
      intervalPenaltyMs += 3;
    }

    if (debug.materialCount >= 28) {
      intervalPenaltyMs += 4;
    } else if (debug.materialCount >= 14) {
      intervalPenaltyMs += 2;
    }

    if ((debug.animationClipCount ?? 0) >= 8) {
      intervalPenaltyMs += 2;
    }

    if (debug.boneCount >= 120) {
      intervalPenaltyMs += 4;
    } else if (debug.boneCount >= 80) {
      intervalPenaltyMs += 2;
    }

    if (debug.triangleCount >= 90000) {
      intervalPenaltyMs += 6;
    } else if (debug.triangleCount >= 45000) {
      intervalPenaltyMs += 3;
    }

    if (debug.morphTargetCount >= 24) {
      intervalPenaltyMs += 2;
    }

    if (sceneComplexityScore >= 40) {
      intervalPenaltyMs += 6;
    } else if (sceneComplexityScore >= 24) {
      intervalPenaltyMs += 3;
    }

    if (shouldPreferLowPowerRendering) {
      intervalPenaltyMs += 2;
    }

    if (updatePriority === 'companion') {
      intervalPenaltyMs += 2;
    }

    if (runtimeSleeping) {
      intervalPenaltyMs += updatePriority === 'companion' ? 28 : 14;
    }

    return Math.min(56, baseIntervalMs + intervalPenaltyMs);
  }, [
    renderFrameIntervalMs,
    runtimeSleeping,
    runtimeInstance.debugSummary,
    sceneComplexityScore,
    sceneQualityLabel,
    shouldPreferLowPowerRendering,
    shouldPrioritizeMotionPlayback,
    updatePriority,
  ]);
  const perfStats = useMemo<AvatarRuntimePerfStats>(() => {
    const frameIntervalMs = Math.max(16, Math.round(effectiveRenderFrameIntervalMs));
    return {
      fps: Math.max(1, Math.round(1000 / frameIntervalMs)),
      frameIntervalMs,
    };
  }, [effectiveRenderFrameIntervalMs]);
  const motionVisualBoundsSamplingSignature = useMemo(() => ([
    motionState.motionKey,
    motionState.candidateClipNames.join('|'),
    motionState.clipPlaybackMode,
    motionState.loopMode,
    motionState.playbackRate,
  ].join('::')), [
    motionState.candidateClipNames,
    motionState.clipPlaybackMode,
    motionState.loopMode,
    motionState.motionKey,
    motionState.playbackRate,
  ]);
  const shouldUseExtendedVisualBoundsSampling = Boolean(
    manualMotionSelection?.candidateClipNames.length,
  );
  const shouldUseMotionVisualBoundsSampling = Boolean(
    actionState.visualIsMoving
    || motionState.mode === 'replace'
    || motionState.source !== 'state-machine',
  );

  useEffect(() => {
    if (!onMotionStateChange) {
      return;
    }

    if (lastMotionKeyRef.current === motionState.motionKey) {
      return;
    }

    lastMotionKeyRef.current = motionState.motionKey;
    onMotionStateChange(motionState.motionKey);
  }, [motionState.motionKey, onMotionStateChange]);

  useEffect(() => {
    if (!onExpressionStateChange) {
      return;
    }

    if (lastExpressionKeyRef.current === resolvedExpressionKey) {
      return;
    }

    lastExpressionKeyRef.current = resolvedExpressionKey;
    onExpressionStateChange(resolvedExpressionKey);
  }, [onExpressionStateChange, resolvedExpressionKey]);

  useEffect(() => {
    if (!onPerfStatsChange) {
      return;
    }

    const previousStats = lastPerfStatsRef.current;
    if (
      previousStats?.fps === perfStats.fps
      && previousStats?.frameIntervalMs === perfStats.frameIntervalMs
    ) {
      return;
    }

    lastPerfStatsRef.current = perfStats;
    onPerfStatsChange(perfStats);
  }, [onPerfStatsChange, perfStats]);

  useEffect(() => {
    const safeFrameIntervalMs = runtimeSleeping
      ? Math.max(64, Math.round(effectiveRenderFrameIntervalMs))
      : Math.max(16, Math.round(effectiveRenderFrameIntervalMs));
    if (!useDemandFrameLoop && sceneQualityLabel === 'pets-1' && safeFrameIntervalMs <= 16) {
      return undefined;
    }

    // Align demand-mode invalidation to RAF so capped multi-scene playback
    // stays smooth instead of drifting on interval timers.
    let animationFrameId: number | null = null;
    let lastInvalidateAt = 0;
    const minimumFrameGapMs = Math.max(8, safeFrameIntervalMs - 2);

    invalidate();

    const scheduleInvalidate = (timestamp: number) => {
      if (lastInvalidateAt === 0 || (timestamp - lastInvalidateAt) >= minimumFrameGapMs) {
        lastInvalidateAt = timestamp;
        invalidate();
      }

      animationFrameId = window.requestAnimationFrame(scheduleInvalidate);
    };

    animationFrameId = window.requestAnimationFrame(scheduleInvalidate);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [effectiveRenderFrameIntervalMs, invalidate, runtimeSleeping, sceneQualityLabel, useDemandFrameLoop]);

  useEffect(() => {
    if (loggedObjectRef.current === runtimeInstance.object) {
      return;
    }

    loggedObjectRef.current = runtimeInstance.object;
    const debug = runtimeInstance.debugSummary;
    const genericLookAtDebug = createGenericAvatar3DLookAtDebugSummary(runtimeInstance.object);
    const formatNumber = (value: number) => value.toFixed(3);
    const clipNames = summarizeDebugList(debug.animationClipNames);
    const genericLookAtTargets = summarizeDebugList(genericLookAtDebug.targetNames);
    const motionCandidates = summarizeDebugList(actionSummary.motionCandidateClipNames, 4);
    const motionCompletionCandidates = summarizeDebugList(actionSummary.motionCompletionCandidates, 4);
    const motionCompletionResolvedKeys = summarizeDebugList(actionSummary.motionCompletionResolvedKeys, 4);
    const motionResolvedKeys = summarizeDebugList(actionSummary.motionResolvedKeys, 4);
    const motionFallbackKeys = summarizeDebugList(actionSummary.motionFallbackKeys, 4);
    pushFrontendRuntimeLog(
      'model',
      `3d runtime ready pet=${runtimeDebugLabel ?? 'unknown'} source=${runtimeInstance.sourceLabel ?? 'unknown'} action=${actionState.visualAction} moving=${actionState.visualIsMoving ? '1' : '0'} visualMode=${actionSummary.visualMode} motion=${actionSummary.motionKey} motionMode=${actionSummary.motionMode} motionBase=${actionSummary.motionBaseKey} motionOverride=${actionSummary.motionOverrideKey ?? 'none'} motionSource=${actionSummary.motionSource} motionKeys=${motionResolvedKeys} motionFallback=${motionFallbackKeys} motionComplete=${actionSummary.motionCompletionMode} motionCompleteKey=${actionSummary.motionCompletionKey ?? 'none'} motionCompleteKeys=${motionCompletionResolvedKeys} motionCompleteCandidates=${motionCompletionCandidates} motionRate=${formatNumber(actionSummary.motionPlaybackRate)} clipMode=${actionSummary.motionClipPlaybackMode} quality=${actionSummary.sceneQualityLabel} priority=${updatePriority} sleeping=${runtimeSleeping ? '1' : '0'} frameMs=${Math.max(16, Math.round(effectiveRenderFrameIntervalMs))} complexity=${formatNumber(sceneComplexityScore)} lowPower=${shouldPreferLowPowerRendering ? '1' : '0'} viewport=${Math.max(0, Math.round(size.width))}x${Math.max(0, Math.round(size.height))} motionLoop=${actionSummary.motionLoopMode} motionCandidates=${motionCandidates} wrapper=${actionSummary.wrapperClassName} wrapperSource=${actionSummary.wrapperClassSource} animMs=${actionSummary.animationDurationMs} wrapperScale=${formatNumber(actionSummary.scaleBase)}>${formatNumber(actionSummary.scalePeak)} meshes=${debug.meshCount} skinned=${debug.skinnedMeshCount} visible=${debug.visibleMeshCount} materials=${debug.materialCount} bones=${debug.boneCount} morphs=${debug.morphTargetCount} triangles=${debug.triangleCount} clips=${debug.animationClipCount ?? 0} clipNames=${clipNames} genericLookAtTargets=${genericLookAtDebug.targetCount}:${genericLookAtTargets} baseScale=${formatNumber(scale)} normalizedScale=${formatNumber(modelLayout.normalizedScale)} size=${modelLayout.boundsSize.map(formatNumber).join('x')} center=${modelLayout.boundsCenter.map(formatNumber).join(',')} position=${modelLayout.position.map(formatNumber).join(',')} autoRotate=${formatNumber(autoRotateSpeed)} baseCamera=${formatNumber(baseCameraDistance)} minFitCamera=${formatNumber(minimumCameraDistance)} expression=${reactionSummary.activeExpression ?? 'none'} contentKey=${reactionSummary.expressionContentKey ?? 'none'} source=${reactionSummary.expressionSource} region=${reactionSummary.expressionCueRegion ?? 'none'} weight=${formatNumber(reactionSummary.expressionWeight)} interactionSource=${reactionSummary.interactionSource} interactionWeight=${formatNumber(reactionSummary.interactionWeight)} interactionAutoRotate=${formatNumber(reactionSummary.interactionAutoRotateMultiplier)} interactionFocus=${formatNumber(reactionSummary.interactionFocusLerp)} interactionYaw=${formatNumber(reactionSummary.interactionYawScale)} interactionPitch=${formatNumber(reactionSummary.interactionPitchScale)} interactionIdlePitch=${formatNumber(reactionSummary.interactionIdlePitchOffset)} interactionRoll=${formatNumber(reactionSummary.interactionRollOffset)} queue=${reactionSummary.expressionCueCount} speech=${reactionSummary.speechActive ? '1' : '0'} viseme=${reactionSummary.viseme ?? 'none'}`,
    );
    onRuntimeReady?.();
  }, [
    actionState.visualAction,
    actionState.visualIsMoving,
    actionSummary,
    autoRotateSpeed,
    baseCameraDistance,
    minimumCameraDistance,
    modelLayout,
    onRuntimeReady,
    reactionSummary,
    sceneComplexityScore,
    effectiveRenderFrameIntervalMs,
    runtimeSleeping,
    runtimeDebugLabel,
    runtimeInstance,
    scale,
    shouldPreferLowPowerRendering,
    updatePriority,
  ]);

  useEffect(() => {
    if (!onVisualBoundsChange) {
      return;
    }

    let animationFrameId: number | null = null;
    let timerId: number | null = null;
    let maxMeasuredBounds: PetVisualBounds | null = null;
    let sampleAttempts = 0;
    let successfulSamples = 0;
    const targetSuccessfulSamples = shouldUseExtendedVisualBoundsSampling
      ? 24
      : shouldUseMotionVisualBoundsSampling
        ? 6
        : 2;
    const maxSampleAttempts = shouldUseExtendedVisualBoundsSampling
      ? 32
      : shouldUseMotionVisualBoundsSampling
        ? 8
        : 4;
    const resampleDelayMs = shouldUseExtendedVisualBoundsSampling
      ? 120
      : shouldUseMotionVisualBoundsSampling
        ? 80
        : 40;

    const sampleVisualBounds = () => {
      sampleAttempts += 1;
      if (!visualBoundsSamplerRef.current) {
        visualBoundsSamplerRef.current = createAvatar3DCanvasVisualBoundsSampler();
      }
      const measuredBounds = measureAvatar3DCanvasVisualBounds(
        gl.domElement,
        visualBoundsSamplerRef.current,
      );
      if (measuredBounds) {
        maxMeasuredBounds = mergeAvatar3DVisualBounds(maxMeasuredBounds, measuredBounds);
        successfulSamples += 1;
      }

      if (successfulSamples >= targetSuccessfulSamples || sampleAttempts >= maxSampleAttempts) {
        if (maxMeasuredBounds) {
          const normalizedMeasuredBounds = normalize3DVisualBounds(
            maxMeasuredBounds,
            actionState.visualIsMoving,
          );
          pushFrontendRuntimeLog(
            'model',
            `3d runtime sampled visual bounds pet=${runtimeDebugLabel ?? 'unknown'} measured=${normalizedMeasuredBounds.left}/${normalizedMeasuredBounds.right}/${normalizedMeasuredBounds.top}/${normalizedMeasuredBounds.bottom} projected=${projectedVisualBounds.left}/${projectedVisualBounds.right}/${projectedVisualBounds.top}/${projectedVisualBounds.bottom}`,
          );
          lastEmittedVisualBoundsRef.current = normalizedMeasuredBounds;
          onVisualBoundsChange(normalizedMeasuredBounds);
        }
        return;
      }

      timerId = window.setTimeout(() => {
        animationFrameId = window.requestAnimationFrame(sampleVisualBounds);
      }, resampleDelayMs);
    };

    animationFrameId = window.requestAnimationFrame(sampleVisualBounds);

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    actionState.visualAction,
    actionState.visualIsMoving,
    effectivePresentationScale,
    gl,
    motionVisualBoundsSamplingSignature,
    onVisualBoundsChange,
    projectedVisualBounds.bottom,
    projectedVisualBounds.left,
    projectedVisualBounds.right,
    projectedVisualBounds.top,
    runtimeDebugLabel,
    sceneQualityLabel,
    shouldUseExtendedVisualBoundsSampling,
    shouldUseMotionVisualBoundsSampling,
    size.height,
    size.width,
  ]);

  useFrame((_, delta) => {
    if (!rootRef.current || !dragTiltRef.current || !tiltRef.current || !pointerLookTiltRef.current) {
      return;
    }

    if (!firstFrameLoggedRef.current) {
      firstFrameLoggedRef.current = true;
      const sceneChildSummary = scene.children
        .map((child) => child.type)
        .join('|');
      pushFrontendRuntimeLog(
        'model',
        `3d runtime first frame pet=${runtimeDebugLabel ?? 'unknown'} sceneChildren=${scene.children.length} rootChildren=${rootRef.current.children.length} sceneTypes=${sceneChildSummary}`,
      );
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.18);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetY, 0.18);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraDistance, 0.18);
      const targetNear = Math.max(0.05, targetCameraDistance / 60);
      const targetFar = Math.max(180, targetCameraDistance * 14);
      let needsProjectionUpdate = false;

      if (Math.abs(camera.near - targetNear) > 0.0001) {
        camera.near = targetNear;
        needsProjectionUpdate = true;
      }

      if (Math.abs(camera.far - targetFar) > 0.01) {
        camera.far = targetFar;
        needsProjectionUpdate = true;
      }

      if (needsProjectionUpdate) {
        camera.updateProjectionMatrix();
      }

      camera.lookAt(0, focusY + lookAtYOffset, 0);
    }

    const interactionState = reactionState?.interactionState;
    const idlePitchOffset = interactionState?.idlePitchOffset ?? 0;

    const manualOrbit = manualOrbitRef.current;
    if (manualOrbit.hasValue) {
      rootRef.current.rotation.y = THREE.MathUtils.lerp(
        rootRef.current.rotation.y,
        manualOrbit.yaw,
        manualOrbit.active ? 0.32 : 0.16,
      );
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltRef.current.rotation.x,
        manualOrbit.pitch,
        manualOrbit.active ? 0.32 : 0.16,
      );
      tiltRef.current.rotation.z = THREE.MathUtils.lerp(
        tiltRef.current.rotation.z,
        0,
        manualOrbit.active ? 0.32 : 0.16,
      );
    } else {
      rootRef.current.rotation.y = THREE.MathUtils.lerp(
        rootRef.current.rotation.y,
        0,
        0.12,
      );
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltRef.current.rotation.x,
        idlePitchOffset,
        0.12,
      );
      tiltRef.current.rotation.z = THREE.MathUtils.lerp(
        tiltRef.current.rotation.z,
        0,
        0.12,
      );
    }

    const targetDragVelocityX = dragMotionState?.active
      ? THREE.MathUtils.clamp(dragMotionState.deltaX, -22, 22)
      : 0;
    const targetDragVelocityY = dragMotionState?.active
      ? THREE.MathUtils.clamp(dragMotionState.deltaY, -22, 22)
      : 0;
    const dragVelocityLerp = dragMotionState?.active ? 0.42 : 0.14;
    dragVelocityRef.current.x = THREE.MathUtils.lerp(
      dragVelocityRef.current.x,
      targetDragVelocityX,
      dragVelocityLerp,
    );
    dragVelocityRef.current.y = THREE.MathUtils.lerp(
      dragVelocityRef.current.y,
      targetDragVelocityY,
      dragVelocityLerp,
    );

    const normalizedDragX = THREE.MathUtils.clamp(dragVelocityRef.current.x / 18, -1, 1);
    const normalizedDragY = THREE.MathUtils.clamp(dragVelocityRef.current.y / 18, -1, 1);
    const targetDragYaw = THREE.MathUtils.clamp(normalizedDragX * -0.2, -0.2, 0.2);
    const targetDragPitch = THREE.MathUtils.clamp(normalizedDragY * 0.16, -0.16, 0.16);
    const targetDragRoll = THREE.MathUtils.clamp(normalizedDragX * -0.24, -0.24, 0.24);
    const dragRotationLerp = dragMotionState?.active ? 0.34 : 0.1;

    dragTiltRef.current.rotation.y = THREE.MathUtils.lerp(
      dragTiltRef.current.rotation.y,
      targetDragYaw,
      dragRotationLerp,
    );
    dragTiltRef.current.rotation.x = THREE.MathUtils.lerp(
      dragTiltRef.current.rotation.x,
      targetDragPitch,
      dragRotationLerp,
    );
    dragTiltRef.current.rotation.z = THREE.MathUtils.lerp(
      dragTiltRef.current.rotation.z,
      targetDragRoll,
      dragRotationLerp,
    );

    pointerLookTiltRef.current.rotation.set(0, 0, 0);

    if (isPointerDiagnosticsEnabled()) {
      const now = window.performance?.now?.() ?? Date.now();
      const signature = [
        runtimeDebugLabel ?? 'unknown',
        pointerLookTarget ? 'active' : 'return',
        pointerLookTarget ? Math.round(pointerLookTarget.x) : 0,
        pointerLookTarget ? Math.round(pointerLookTarget.y) : 0,
      ].join(':');
      if (
        pointerLookDiagnosticRef.current.signature !== signature
        || now - pointerLookDiagnosticRef.current.lastAt >= 640
      ) {
        pointerLookDiagnosticRef.current = { lastAt: now, signature };
        pushFrontendRuntimeLog('pointer-look', '3d pointer look applied', {
          normalizedX: pointerLookTarget
            ? Number(THREE.MathUtils.clamp(pointerLookTarget.x / 28, -1, 1).toFixed(3))
            : 0,
          normalizedY: pointerLookTarget
            ? Number(THREE.MathUtils.clamp(-pointerLookTarget.y / 42, -1, 1).toFixed(3))
            : 0,
          pointerLookTarget,
          pointerLookStrength: Number(pointerLookStrength.toFixed(3)),
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          runtimeDebugLabel: runtimeDebugLabel ?? null,
          sourceLabel: runtimeInstance.sourceLabel ?? null,
        });
      }
    }

    rootRef.current.updateWorldMatrix(true, true);
    if (!runtimeSleeping) {
      runtimeInstance.update?.(delta, {
        focusTarget,
        hoverState,
        motionState,
        pointerLookTarget,
        pointerLookStrength,
        reactionState,
        visualMode: actionState.visualMode,
        wrapperClassName: actionState.wrapperClassName,
      });
    }

    if (onVisualBoundsChange && !runtimeSleeping && shouldUseMotionVisualBoundsSampling) {
      const now = window.performance?.now?.() ?? Date.now();
      const sampleIntervalMs = shouldUseExtendedVisualBoundsSampling
        ? REALTIME_VISUAL_BOUNDS_EXTENDED_SAMPLE_INTERVAL_MS
        : REALTIME_VISUAL_BOUNDS_SAMPLE_INTERVAL_MS;

      if ((now - lastRealtimeVisualBoundsSampleAtRef.current) >= sampleIntervalMs) {
        lastRealtimeVisualBoundsSampleAtRef.current = now;
        if (!visualBoundsSamplerRef.current) {
          visualBoundsSamplerRef.current = createAvatar3DCanvasVisualBoundsSampler();
        }
        const measuredBounds = measureAvatar3DCanvasVisualBounds(
          gl.domElement,
          visualBoundsSamplerRef.current,
        );
        if (measuredBounds) {
          const normalizedMeasuredBounds = normalize3DVisualBounds(
            measuredBounds,
            actionState.visualIsMoving,
          );
          if (hasMeaningfulVisualBoundsChange(
            lastEmittedVisualBoundsRef.current,
            normalizedMeasuredBounds,
          )) {
            lastEmittedVisualBoundsRef.current = normalizedMeasuredBounds;
            onVisualBoundsChange(normalizedMeasuredBounds);
          }
        }
      }
    }
  });

  return (
    <group ref={rootRef}>
      <group ref={dragTiltRef}>
        <group ref={tiltRef}>
          <group ref={pointerLookTiltRef}>
            <group scale={modelLayout.normalizedScale * effectiveScale}>
              <group position={modelLayout.position}>
                <primitive object={runtimeInstance.object} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
