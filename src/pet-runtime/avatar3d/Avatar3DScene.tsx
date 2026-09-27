import { useMemo, type MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { type PetVisualBounds } from '../../components/pet/petVisualBounds';
import { type Avatar3DActionState } from './avatar3dActionState';
import { type Avatar3DReactionState } from './useAvatar3DReactionState';
import { type Avatar3DManualOrbitState } from './useAvatar3DManualOrbitController';
import { type PetHoverState } from '../interactions/petHoverController';
import { type Avatar3DDragMotionState } from './avatar3dDragMotionState';
import { type Avatar3DManualMotionSelection } from './avatar3dMotionStateController';
import { Avatar3DRuntimeMount } from './Avatar3DRuntimeMount';
import { type Avatar3DRuntimeInstance } from './avatar3dRuntimeInstance';
import { type Avatar3DPresentationMode } from './avatar3dPresentationMode';
import { type Avatar3DRuntimeUpdatePriority } from './useAvatar3DRuntimeSleepState';
import { type AvatarRuntimePerfStats } from '../avatar-runtime/avatarRuntimeEvents';

type FocusTarget = {
  x: number;
  y: number;
};

export interface Avatar3DSceneProps {
  actionState: Avatar3DActionState;
  activeSceneCount?: number;
  autoRotateSpeed: number;
  baseCameraDistance: number;
  cameraFocusYRatio: number;
  cameraTargetY: number;
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
  presentationMode?: Avatar3DPresentationMode;
  reactionState?: Avatar3DReactionState;
  runtimeSleeping?: boolean;
  runtimeInstance: Avatar3DRuntimeInstance;
  runtimeDebugLabel?: string;
  scale?: number;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
}

export function Avatar3DScene({
  actionState,
  activeSceneCount = 1,
  autoRotateSpeed,
  baseCameraDistance,
  cameraFocusYRatio,
  cameraTargetY,
  dragMotionState,
  focusTarget = null,
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
  presentationMode = 'default',
  reactionState,
  runtimeSleeping = false,
  runtimeInstance,
  runtimeDebugLabel,
  scale = 1,
  updatePriority = 'companion',
}: Avatar3DSceneProps) {
  const sceneQuality = useMemo(() => {
    const safeSceneCount = Math.max(1, Math.round(activeSceneCount || 1));
    const debug = runtimeInstance.debugSummary;
    const deviceDpr = typeof window !== 'undefined'
      ? Math.max(1, window.devicePixelRatio || 1)
      : 1;
    const scaleBoost = 1 + Math.max(0, scale - 1) * 0.34;
    const isInteractiveDialoguePresentation = presentationMode === 'interactive-dialogue';
    const isInteractionHot = actionState.visualIsMoving
      || Boolean(dragMotionState?.active)
      || Boolean(pointerLookTarget)
      || Boolean(hoverState?.activeRegion)
      || Boolean(reactionState?.lipSyncState.isActive);
    const complexityScore = (
      (debug.skinnedMeshCount * 1.6)
      + (debug.materialCount * 0.35)
      + (debug.boneCount * 0.08)
      + (debug.morphTargetCount * 0.04)
      + (debug.animationClipCount ?? 0) * 0.2
      + (debug.triangleCount / 16000)
    );
    const isHeavyModel = complexityScore >= 24;
    const isVeryHeavyModel = complexityScore >= 40;
    const shouldBiasTowardBatterySaving = safeSceneCount >= 2 || isHeavyModel;
    const isCompanionPriority = updatePriority === 'companion';

    let maxDpr = 2.7;
    let minDpr = scale >= 1.45 ? 1.68 : scale >= 1.18 ? 1.5 : 1.38;
    let dprMultiplier = 1.18;
    let antialias = true;
    let autoRotateSpeedMultiplier = 1;
    let keyLightIntensity = 1.18;
    let heroLightIntensity = 0.78;
    let ambientIntensity = 0.82;
    let hemisphereIntensity = 0.18;
    let enableFillLight = true;
    let enableBounceLight = true;
    let enableRimLight = true;
    let fillLightIntensity = 0.28;
    let bounceLightIntensity = 0.16;
    let rimLightIntensity = 0.26;
    let targetFrameIntervalMs = 16;

    if (isHeavyModel) {
      maxDpr = Math.min(maxDpr, 2.08);
      minDpr = Math.min(minDpr, scale >= 1.45 ? 1.44 : 1.24);
      dprMultiplier *= 0.9;
      heroLightIntensity = 0.68;
      fillLightIntensity = 0.22;
      bounceLightIntensity = 0.1;
      rimLightIntensity = 0.18;
      targetFrameIntervalMs = Math.max(targetFrameIntervalMs, isInteractionHot ? 18 : 24);
    }

    if (isVeryHeavyModel) {
      maxDpr = Math.min(maxDpr, 1.72);
      minDpr = Math.min(minDpr, 1.14);
      dprMultiplier *= 0.82;
      antialias = false;
      ambientIntensity = 0.7;
      hemisphereIntensity = 0.1;
      heroLightIntensity = 0.54;
      enableBounceLight = false;
      rimLightIntensity = 0.14;
      targetFrameIntervalMs = Math.max(targetFrameIntervalMs, isInteractionHot ? 24 : 32);
    }

    if (isCompanionPriority) {
      maxDpr = Math.min(maxDpr, safeSceneCount >= 2 ? 1.62 : 1.86);
      minDpr = Math.min(minDpr, 1.12);
      dprMultiplier *= safeSceneCount >= 2 ? 0.84 : 0.9;
      heroLightIntensity *= 0.94;
      fillLightIntensity *= 0.86;
      rimLightIntensity *= 0.82;
      targetFrameIntervalMs = Math.max(targetFrameIntervalMs, isInteractionHot ? 18 : 24);
    }

    if (isInteractiveDialoguePresentation) {
      maxDpr = 1.55;
      minDpr = scale >= 1.45 ? 1.18 : scale >= 1.18 ? 1.1 : 1.04;
      dprMultiplier = 0.9;
      autoRotateSpeedMultiplier = 0.92;
      fillLightIntensity = 0.24;
      bounceLightIntensity = 0.12;
      rimLightIntensity = 0.22;
      targetFrameIntervalMs = isInteractionHot ? 16 : 18;
    }

    if (safeSceneCount >= 3) {
      maxDpr = 1.58;
      minDpr = scale >= 1.45 ? 1.34 : 1.2;
      dprMultiplier = scale >= 1.45 ? 1.08 : 0.96;
      antialias = true;
      autoRotateSpeedMultiplier = 0.18;
      ambientIntensity = 0.68;
      hemisphereIntensity = 0.08;
      keyLightIntensity = 0.94;
      heroLightIntensity = 0.58;
      enableFillLight = false;
      enableBounceLight = false;
      enableRimLight = false;
      targetFrameIntervalMs = isInteractionHot ? 28 : 48;
    } else if (safeSceneCount === 2) {
      maxDpr = 1.94;
      minDpr = scale >= 1.45 ? 1.46 : 1.28;
      dprMultiplier = scale >= 1.45 ? 1.16 : 1.06;
      antialias = true;
      autoRotateSpeedMultiplier = 0.42;
      ambientIntensity = 0.74;
      hemisphereIntensity = 0.12;
      keyLightIntensity = 1.02;
      heroLightIntensity = 0.66;
      enableBounceLight = false;
      rimLightIntensity = 0.2;
      fillLightIntensity = 0.18;
      targetFrameIntervalMs = isInteractionHot ? 20 : 34;
    }

    const renderDpr = Number(Math.min(
      maxDpr,
      Math.max(minDpr, deviceDpr * dprMultiplier * scaleBoost),
    ).toFixed(2));

    return {
      ambientIntensity,
      antialias,
      autoRotateSpeedMultiplier,
      bounceLightIntensity,
      enableBounceLight,
      enableFillLight,
      enableRimLight,
      fillLightIntensity,
      hemisphereIntensity,
      heroLightIntensity,
      keyLightIntensity,
      modelComplexityScore: Number(complexityScore.toFixed(2)),
      renderDpr,
      rimLightIntensity,
      safeSceneCount,
      shouldBiasTowardBatterySaving,
      targetFrameIntervalMs: runtimeSleeping
        ? Math.max(targetFrameIntervalMs, isCompanionPriority ? 160 : 96)
        : targetFrameIntervalMs,
      useDemandFrameLoop: runtimeSleeping
        || safeSceneCount !== 1
        || isInteractiveDialoguePresentation
        || isHeavyModel
        || isCompanionPriority,
    };
  }, [
    actionState.visualIsMoving,
    activeSceneCount,
    dragMotionState?.active,
    hoverState?.activeRegion,
    pointerLookTarget,
    presentationMode,
    reactionState?.lipSyncState.isActive,
    runtimeSleeping,
    runtimeInstance.debugSummary,
    scale,
    updatePriority,
  ]);

  return (
    <Canvas
      dpr={sceneQuality.renderDpr}
      frameloop={sceneQuality.useDemandFrameLoop ? 'demand' : 'always'}
      camera={{ fov: 45, near: 0.05, far: 220, position: [0, 0.06, baseCameraDistance] }}
      gl={{
        alpha: true,
        antialias: sceneQuality.antialias,
        powerPreference: 'high-performance',
        precision: 'highp',
        // Keep the WebGL clear pixels genuinely transparent for Electron's
        // Windows compositor; premultiplied alpha can collapse them into a dark rectangle.
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(sceneQuality.renderDpr);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = false;
        gl.toneMapping = THREE.NoToneMapping;
        gl.toneMappingExposure = 1;
        gl.setClearColor(0x000000, 0);
        gl.domElement.dataset.desktopPetThreeCanvas = 'true';
        gl.domElement.style.background = 'transparent';
        gl.domElement.style.imageRendering = 'auto';
        gl.domElement.style.transform = 'translateZ(0)';
      }}
    >
      <ambientLight intensity={sceneQuality.ambientIntensity} />
      <hemisphereLight
        args={['#dfe8f5', '#393d46', sceneQuality.hemisphereIntensity]}
      />
      <directionalLight
        color="#f8f1eb"
        intensity={sceneQuality.keyLightIntensity}
        position={[2.6, 4.8, 6.6]}
      />
      <directionalLight intensity={sceneQuality.heroLightIntensity} position={[0.85, 2.2, 5.6]} color="#f7f5ee" />
      {sceneQuality.enableFillLight ? (
        <directionalLight intensity={sceneQuality.fillLightIntensity} position={[-4.6, 1.8, 3.2]} color="#c7d7ea" />
      ) : null}
      {sceneQuality.enableRimLight ? (
        <directionalLight intensity={sceneQuality.rimLightIntensity} position={[-4.8, 3.1, -4.6]} color="#aab7cc" />
      ) : null}
      {sceneQuality.enableBounceLight ? (
        <pointLight intensity={sceneQuality.bounceLightIntensity} position={[0, -2.4, 2.4]} color="#d9cfc2" />
      ) : null}
      <Avatar3DRuntimeMount
        fitToPreview={fitToPreview}
        actionState={actionState}
        autoRotateSpeed={autoRotateSpeed * sceneQuality.autoRotateSpeedMultiplier}
        baseCameraDistance={baseCameraDistance}
        cameraFocusYRatio={cameraFocusYRatio}
        cameraTargetY={cameraTargetY}
        dragMotionState={dragMotionState}
        renderFrameIntervalMs={sceneQuality.targetFrameIntervalMs}
        sceneQualityLabel={`pets-${sceneQuality.safeSceneCount}`}
        focusTarget={focusTarget}
        hoverState={hoverState}
        pointerLookTarget={pointerLookTarget}
        lookAtYOffset={lookAtYOffset}
        manualMotionSelection={manualMotionSelection}
        manualOrbitRef={manualOrbitRef}
        onExpressionStateChange={onExpressionStateChange}
        onMotionStateChange={onMotionStateChange}
        onPerfStatsChange={onPerfStatsChange}
        onRuntimeReady={onRuntimeReady}
        onVisualBoundsChange={onVisualBoundsChange}
        reactionState={reactionState}
        runtimeDebugLabel={runtimeDebugLabel}
        runtimeInstance={runtimeInstance}
        runtimeSleeping={runtimeSleeping}
        scale={scale}
        sceneComplexityScore={sceneQuality.modelComplexityScore}
        shouldPreferLowPowerRendering={sceneQuality.shouldBiasTowardBatterySaving}
        updatePriority={updatePriority}
        useDemandFrameLoop={sceneQuality.useDemandFrameLoop}
      />
    </Canvas>
  );
}
