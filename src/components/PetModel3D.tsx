import {
  Component,
  memo,
  useMemo,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import {
  type Supported3DModelFormat,
} from '../model3dFormatSupport';
import { type PetVisualBounds } from './pet/petVisualBounds';
import { type PetAction } from '../types';
import { Avatar3DScene } from '../pet-runtime/avatar3d/Avatar3DScene';
import { useAvatar3DExternalMotionClips } from '../pet-runtime/avatar3d/useAvatar3DExternalMotionClips';
import { useLoadedAvatar3DRuntimeInstance } from '../pet-runtime/avatar3d/useLoadedAvatar3DRuntimeInstance';
import { type PetHoverState } from '../pet-runtime/interactions/petHoverController';
import {
  type Avatar3DPresentationState,
} from '../pet-runtime/avatar3d/avatar3dPresentationState';
import { useAvatar3DManualOrbitController } from '../pet-runtime/avatar3d/useAvatar3DManualOrbitController';
import { type PetContentManifest } from '../pet-runtime/content/petContentManifest';
import { type Avatar3DRuntimeUpdatePriority } from '../pet-runtime/avatar3d/useAvatar3DRuntimeSleepState';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimePresentationMode,
} from '../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { type AvatarRuntimePerfStats } from '../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import {
  type ThreeAvatarRuntimeBridgeRenderViewState,
  type ThreeAvatarRuntimeManualMotionSelection,
  type ThreeAvatarRuntimeReactionState,
  type ThreeAvatarRuntimeRenderAdapterState,
} from '../pet-runtime/avatar-runtime/three/threeAvatarRuntimeBridge';
import {
  resolvePetThreeAvatarComponentState,
  resolvePetThreeAvatarFallbackRenderAdapterState,
  resolvePetThreeAvatarRenderSurface,
  resolvePetThreeAvatarSceneSurface,
  resolvePetThreeAvatarShellStyle,
  resolvePetThreeAvatarViewportStyle,
} from './pet/petAvatarRuntimeSurface';
import { resolvePointerLook3DVisualStyle } from './pet/petPointerLookVisual';

interface PetModel3DProps {
  url: string;
  activeSceneCount?: number;
  bridgeRenderState?: ThreeAvatarRuntimeBridgeRenderViewState | null;
  scale?: number;
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  dragMotionState?: AvatarRuntimeDragState;
  expressionAction?: PetAction | null;
  isMoving?: boolean;
  focusTarget?: { x: number, y: number } | null;
  fitToPreview?: boolean;
  hoverState?: PetHoverState;
  pointerLookTarget?: { x: number, y: number } | null;
  manualMotionSelection?: ThreeAvatarRuntimeManualMotionSelection | null;
  onExpressionStateChange?: (expressionKey: string | null) => void;
  onMotionStateChange?: (motionKey: string | null) => void;
  onPerfStatsChange?: (stats: AvatarRuntimePerfStats) => void;
  onRuntimeError?: (errorMessage: string) => void;
  onRuntimeReady?: () => void;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  presentationState?: Avatar3DPresentationState;
  presentationMode?: AvatarRuntimePresentationMode;
  reactionState?: ThreeAvatarRuntimeReactionState;
  renderAdapterState?: ThreeAvatarRuntimeRenderAdapterState;
  runtimeSleeping?: boolean;
  modelFormat?: Supported3DModelFormat | null;
  modelRuntimeUrl?: string;
  runtimeDebugLabel?: string;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
}

type PetModel3DErrorBoundaryProps = {
  children: ReactNode;
  format: string | null;
  onError?: (errorMessage: string) => void;
  runtimeDebugLabel?: string;
  url: string;
};

type PetModel3DErrorBoundaryState = {
  hasError: boolean;
};

function RuntimeLoadErrorThrower({ error }: { error: Error }): null {
  throw error;
}

class PetModel3DErrorBoundary extends Component<
  PetModel3DErrorBoundaryProps,
  PetModel3DErrorBoundaryState
> {
  state: PetModel3DErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorMessage = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    pushFrontendRuntimeLog('model', `3d model render failed: ${errorMessage}`, {
      format: this.props.format,
      url: this.props.url,
    });
    pushFrontendRuntimeError('model', '3d model render failed', error, {
      format: this.props.format,
      runtimeDebugLabel: this.props.runtimeDebugLabel ?? null,
      url: this.props.url,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(errorMessage);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-2xs font-medium text-primary/80">
          {'3D\u52a0\u8f7d\u5931\u8d25'}
        </div>
      );
    }

    return this.props.children;
  }
}

function PetModel3D({
  url,
  activeSceneCount = 1,
  bridgeRenderState = null,
  scale = 1,
  action = 'IDLE',
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  dragMotionState,
  expressionAction = null,
  isMoving = false,
  focusTarget = null,
  fitToPreview = false,
  hoverState,
  pointerLookTarget = null,
  manualMotionSelection = null,
  onExpressionStateChange,
  onMotionStateChange,
  onPerfStatsChange,
  onRuntimeError,
  onRuntimeReady,
  reactionState,
  renderAdapterState: preparedRenderAdapterState,
  modelFormat: preparedModelFormat,
  modelRuntimeUrl: preparedModelRuntimeUrl,
  onVisualBoundsChange,
  presentationState: preparedPresentationState,
  presentationMode = 'default',
  runtimeDebugLabel,
  runtimeSleeping = false,
  updatePriority = 'companion',
}: PetModel3DProps) {
  const { handleMiddleMouseDownCapture, manualOrbitRef, stopMiddleMouseDefault } = useAvatar3DManualOrbitController();
  const resolvedState = useMemo(() => (
    resolvePetThreeAvatarComponentState({
      action,
      activeSceneCount,
      bridgeRenderState,
      contentManifest,
      contentManifestResolved,
      contentManifestSourceUrl,
      dragMotionState,
      expressionAction,
      focusTarget,
      hoverState,
      isMoving,
      manualMotionSelection,
      pointerLookTarget,
      presentationMode,
      reactionState,
      runtimeDebugLabel,
      scale,
      url,
    })
  ), [
    action,
    activeSceneCount,
    bridgeRenderState,
    contentManifest,
    contentManifestResolved,
    contentManifestSourceUrl,
    dragMotionState,
    expressionAction,
    focusTarget,
    hoverState,
    isMoving,
    manualMotionSelection,
    pointerLookTarget,
    presentationMode,
    reactionState,
    runtimeDebugLabel,
    scale,
    url,
  ]);
  const fallbackRenderState = useMemo(() => (
    resolvePetThreeAvatarFallbackRenderAdapterState(resolvedState)
  ), [resolvedState]);
  const renderAdapterState = bridgeRenderState?.renderAdapterState ?? preparedRenderAdapterState ?? fallbackRenderState;
  const renderSurface = useMemo(() => (
    resolvePetThreeAvatarRenderSurface({
      preparedModelFormat,
      preparedModelRuntimeUrl,
      preparedPresentationState,
      renderAdapterState,
    })
  ), [
    preparedModelFormat,
    preparedModelRuntimeUrl,
    preparedPresentationState,
    renderAdapterState,
  ]);
  const { modelFormat, modelRuntimeUrl, presentationState } = renderSurface;
  const sceneSurface = useMemo(() => (
    resolvePetThreeAvatarSceneSurface({
      focusTarget: resolvedState.focusTarget,
      manualMotionSelection: resolvedState.manualMotionSelection,
      pointerLookTarget: resolvedState.pointerLookTarget,
      presentationState,
      reactionState: resolvedState.reactionState,
    })
  ), [
    presentationState,
    resolvedState.focusTarget,
    resolvedState.manualMotionSelection,
    resolvedState.pointerLookTarget,
    resolvedState.reactionState,
  ]);
  const externalMotionClipsResult = useAvatar3DExternalMotionClips({
    contentManifest: resolvedState.contentManifest,
    contentManifestSourceUrl: resolvedState.contentManifestSourceUrl,
    enabled: modelFormat !== 'obj' && modelFormat !== 'stl' && Boolean(modelRuntimeUrl.trim()),
    modelUrl: modelRuntimeUrl,
  });
  const canLoadRuntimeInstance = Boolean(modelFormat && modelRuntimeUrl.trim());
  const { loadedInstance, loadError } = useLoadedAvatar3DRuntimeInstance({
    contentManifest: resolvedState.contentManifest,
    contentManifestResolved: resolvedState.contentManifestResolved,
    contentManifestSourceUrl: resolvedState.contentManifestSourceUrl,
    debugLabel: resolvedState.runtimeDebugLabel,
    enabled: canLoadRuntimeInstance,
    externalMotionClipsResult,
    format: modelFormat,
    url: modelRuntimeUrl,
  });
  const canvasViewportStyle = useMemo(() => (
    resolvePetThreeAvatarViewportStyle(presentationState)
  ), [presentationState]);
  const pointerLookCanvasStyle = useMemo<CSSProperties>(() => ({
    ...canvasViewportStyle,
    ...resolvePointerLook3DVisualStyle(resolvedState.pointerLookTarget),
  }), [canvasViewportStyle, resolvedState.pointerLookTarget]);
  const modelShellStyle = useMemo(() => (
    resolvePetThreeAvatarShellStyle(presentationState)
  ), [presentationState]);

  return (
    <div
      className="relative flex h-full w-full min-h-full min-w-full flex-1 basis-full self-stretch overflow-visible"
      style={modelShellStyle}
      onAuxClick={stopMiddleMouseDefault}
      onMouseDownCapture={handleMiddleMouseDownCapture}
    >
      <PetModel3DErrorBoundary
        key={`${modelFormat ?? 'unknown'}:${modelRuntimeUrl}`}
        format={modelFormat}
        onError={onRuntimeError}
        runtimeDebugLabel={resolvedState.runtimeDebugLabel}
        url={modelRuntimeUrl}
      >
        {loadError && !loadedInstance ? <RuntimeLoadErrorThrower error={loadError} /> : null}
        {loadedInstance ? (
          <div className="pointer-events-auto" style={pointerLookCanvasStyle}>
              <Avatar3DScene
              activeSceneCount={resolvedState.activeSceneCount}
              {...sceneSurface}
              dragMotionState={resolvedState.dragMotionState}
              focusTarget={resolvedState.focusTarget}
              hoverState={resolvedState.hoverState}
              pointerLookTarget={resolvedState.pointerLookTarget}
              manualOrbitRef={manualOrbitRef}
              onExpressionStateChange={onExpressionStateChange}
              onMotionStateChange={onMotionStateChange}
              onPerfStatsChange={onPerfStatsChange}
              onRuntimeReady={onRuntimeReady}
              onVisualBoundsChange={onVisualBoundsChange}
              presentationMode={resolvedState.presentationMode}
              runtimeDebugLabel={resolvedState.runtimeDebugLabel}
                runtimeInstance={loadedInstance}
              runtimeSleeping={runtimeSleeping}
              scale={resolvedState.scale}
              updatePriority={updatePriority}
            />
          </div>
        ) : (
          <div className="pointer-events-none h-full w-full" />
        )}
      </PetModel3DErrorBoundary>
    </div>
  );
}

const MemoizedPetModel3D = memo(PetModel3D);
MemoizedPetModel3D.displayName = 'PetModel3D';

export default MemoizedPetModel3D;
