import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { type Avatar3DRuntimeBackend, type ModelType, type PetAction, type PetModelMotionBinding } from '../../types';
import { DEFAULT_BUILTIN_STATIC_PET_MODEL_URL } from '../../constants';
import Pet2DRenderer from './Pet2DRenderer';
import Pet3DRenderer from './Pet3DRenderer';
import PetLive2DRenderer from './PetLive2DRenderer';
import PetUnity3DRenderer from './PetUnity3DRenderer';
import PetVideo2DRenderer from './PetVideo2DRenderer';
import { type PetVisualBounds } from './petVisualBounds';
import { type PetHoverState } from '../../pet-runtime/interactions/petHoverController';
import { type Pet2DRenderAdapterState } from './pet2dRenderAdapterState';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { type Avatar3DRuntimeUpdatePriority } from '../../pet-runtime/avatar3d/useAvatar3DRuntimeSleepState';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimePresentationMode,
  type AvatarRuntimeViewport,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  summarizePointerLookTarget,
} from './petPointerLookDiagnostics';
import { type Live2DRuntimeProfileConfigV1 } from '../../pet-runtime/live2d/live2dRuntimeProfile';

type Position = {
  x: number;
  y: number;
};

export interface PetVisualRendererProps {
  action: PetAction;
  active3DSceneCount?: number;
  avatar3dRuntimeBackend?: Avatar3DRuntimeBackend;
  debugPetId?: string;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  fitToPreview?: boolean;
  dragMotionState?: AvatarRuntimeDragState;
  hoverState?: PetHoverState;
  isDragging?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  isMoving: boolean;
  latestMessage?: string;
  live2dRuntimeProfile?: Live2DRuntimeProfileConfigV1 | null;
  modelType: ModelType;
  modelUrl: string;
  sequenceFrames?: string[];
  renderKind?: 'video' | 'gif';
  contentManifestOverride?: PetContentManifest | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  motionBindings?: PetModelMotionBinding[];
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pet2dRenderAdapterState?: Pet2DRenderAdapterState;
  pointerLookTarget?: Position | null;
  presentationMode?: AvatarRuntimePresentationMode;
  scale: number;
  sequenceFrameDurationMultiplier?: number;
  staticPreview?: boolean;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
  viewport?: AvatarRuntimeViewport | null;
  visible?: boolean;
}

const PetVisualRenderer = memo(function PetVisualRenderer({
  action,
  active3DSceneCount = 1,
  avatar3dRuntimeBackend = 'three',
  debugPetId,
  expressionAction = null,
  focusTarget = null,
  fitToPreview = false,
  dragMotionState,
  hoverState,
  isDragging = false,
  isSpeaking = false,
  isTyping = false,
  isMoving,
  latestMessage = '',
  live2dRuntimeProfile = null,
  modelType,
  modelUrl,
  sequenceFrames = [],
  renderKind,
  contentManifestOverride = null,
  manualExpressionBinding = null,
  manualMotionBinding = null,
  motionBindings = [],
  onRuntimeEvent,
  onVisualBoundsChange,
  pet2dRenderAdapterState,
  pointerLookTarget = null,
  presentationMode = 'default',
  scale,
  sequenceFrameDurationMultiplier = 1,
  staticPreview = false,
  updatePriority = 'companion',
  viewport = null,
  visible = true,
}: PetVisualRendererProps) {
  const resolvedRenderKind = renderKind ?? (
    modelType === '2d' && /\.(?:webm|mp4|m4v|mov)(?:[?#].*)?$/iu.test(modelUrl)
      ? 'video'
      : /\.gif(?:[?#].*)?$/iu.test(modelUrl) ? 'gif' : undefined
  );
  const pointerLookDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const modelRuntimeKey = [modelType, avatar3dRuntimeBackend, modelUrl].join(':');
  const [failedModelRuntimeKey, setFailedModelRuntimeKey] = useState<string | null>(null);
  const [readyModelRuntimeKey, setReadyModelRuntimeKey] = useState<string | null>(null);
  const handleRuntimeEvent = useCallback<AvatarRuntimeEventListener>((event) => {
    if (event.type === 'error' && (event.runtimeKind !== 'three')) {
      setFailedModelRuntimeKey(modelRuntimeKey);
    } else if (event.type === 'ready') {
      setReadyModelRuntimeKey(modelRuntimeKey);
      setFailedModelRuntimeKey((currentKey) => currentKey === modelRuntimeKey ? null : currentKey);
    }
    onRuntimeEvent?.(event);
  }, [modelRuntimeKey, onRuntimeEvent]);

  useEffect(() => {
    pushPointerLookDiagnosticLog(
      pointerLookDiagnosticsRef.current,
      'visual renderer received pointer look target',
      [
        modelType,
        avatar3dRuntimeBackend,
        debugPetId ?? modelUrl,
        createPointerLookTargetSignature(pointerLookTarget),
      ],
      {
        backend: modelType === '3d' ? avatar3dRuntimeBackend : modelType,
        debugPetId: debugPetId ?? null,
        focusTarget: summarizePointerLookTarget(focusTarget),
        isDragging,
        modelType,
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(pointerLookTarget),
        visible,
      },
    );
  }, [
    avatar3dRuntimeBackend,
    debugPetId,
    focusTarget,
    isDragging,
    modelType,
    modelUrl,
    pointerLookTarget,
    visible,
  ]);

  const showStartupPlaceholder = (
    (modelType === '3d' || modelType === 'live2d')
    && readyModelRuntimeKey !== modelRuntimeKey
  );
  const renderWithStartupPlaceholder = (runtime: ReactNode) => (
    <div className="relative h-full w-full">
      <div className={showStartupPlaceholder ? 'invisible h-full w-full' : 'h-full w-full'}>
        {runtime}
      </div>
      {showStartupPlaceholder ? (
        <img
          src={DEFAULT_BUILTIN_STATIC_PET_MODEL_URL}
          alt="Loading pet model"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
    </div>
  );

  if (failedModelRuntimeKey === modelRuntimeKey) {
    return (
      <img
        src={DEFAULT_BUILTIN_STATIC_PET_MODEL_URL}
        alt="Pet model failed to load; showing the built-in pet"
        className="pointer-events-none h-full w-full object-contain"
      />
    );
  }

  if (modelType === 'live2d') {
    return renderWithStartupPlaceholder(
      <PetLive2DRenderer
        action={action}
        debugPetId={debugPetId}
        expressionAction={expressionAction}
        focusTarget={focusTarget}
        hoverState={hoverState}
        isDragging={isDragging}
        isSpeaking={isSpeaking}
        isTyping={isTyping}
        isMoving={isMoving}
        latestMessage={latestMessage}
        live2dRuntimeProfile={live2dRuntimeProfile}
        contentManifestOverride={contentManifestOverride}
        manualExpressionBinding={manualExpressionBinding}
        manualMotionBinding={manualMotionBinding}
        motionBindings={motionBindings}
        modelUrl={modelUrl}
        onRuntimeEvent={handleRuntimeEvent}
        onVisualBoundsChange={onVisualBoundsChange}
        pointerLookTarget={pointerLookTarget}
        scale={scale}
        viewport={viewport}
        visible={visible}
      />
    );
  }

  if (modelType === '3d') {
    if (avatar3dRuntimeBackend === 'unity') {
      return renderWithStartupPlaceholder(
        <PetUnity3DRenderer
          action={action}
          debugPetId={debugPetId}
          dragMotionState={dragMotionState}
          expressionAction={expressionAction}
          focusTarget={focusTarget}
          hoverState={hoverState}
          isSpeaking={isSpeaking}
          isTyping={isTyping}
          isMoving={isMoving}
          latestMessage={latestMessage}
          contentManifestOverride={contentManifestOverride}
          manualExpressionBinding={manualExpressionBinding}
          manualMotionBinding={manualMotionBinding}
          modelUrl={modelUrl}
          onRuntimeEvent={handleRuntimeEvent}
          onVisualBoundsChange={onVisualBoundsChange}
          pointerLookTarget={pointerLookTarget}
          presentationMode={presentationMode}
          scale={scale}
          viewport={viewport}
          visible={visible}
        />
      );
    }

    return renderWithStartupPlaceholder(
      <Pet3DRenderer
        action={action}
        active3DSceneCount={active3DSceneCount}
        debugPetId={debugPetId}
        dragMotionState={dragMotionState}
        expressionAction={expressionAction}
        focusTarget={focusTarget}
        fitToPreview={fitToPreview}
        hoverState={hoverState}
        isSpeaking={isSpeaking}
        isTyping={isTyping}
        isMoving={isMoving}
        latestMessage={latestMessage}
        contentManifestOverride={contentManifestOverride}
        manualExpressionBinding={manualExpressionBinding}
        manualMotionBinding={manualMotionBinding}
        modelUrl={modelUrl}
        onRuntimeFailure={() => setFailedModelRuntimeKey(modelRuntimeKey)}
        onRuntimeEvent={handleRuntimeEvent}
        onVisualBoundsChange={onVisualBoundsChange}
        pointerLookTarget={pointerLookTarget}
        presentationMode={presentationMode}
        scale={scale}
        staticPreview={staticPreview}
        updatePriority={updatePriority}
        visible={visible}
      />
    );
  }

  if (resolvedRenderKind === 'gif') {
    return <img src={modelUrl} className="pointer-events-none h-full w-full object-contain" alt="2D GIF 桌宠" />;
  }

  if (resolvedRenderKind === 'video') {
    return (
      <PetVideo2DRenderer
        isDragging={isDragging}
        enableItemInteractions={updatePriority === 'primary'}
        modelUrl={modelUrl}
        onVisualBoundsChange={onVisualBoundsChange}
        pointerLookTarget={pointerLookTarget}
        scale={scale}
      />
    );
  }

  return (
    <Pet2DRenderer
      action={action}
      expressionAction={expressionAction}
      focusTarget={focusTarget}
      isDragging={isDragging}
      isMoving={isMoving}
      modelUrl={modelUrl}
      sequenceFrames={sequenceFrames}
      onVisualBoundsChange={onVisualBoundsChange}
      pointerLookTarget={pointerLookTarget}
      renderAdapterState={pet2dRenderAdapterState}
      scale={scale}
      sequenceFrameDurationMultiplier={sequenceFrameDurationMultiplier}
    />
  );
});

PetVisualRenderer.displayName = 'PetVisualRenderer';

export default PetVisualRenderer;
