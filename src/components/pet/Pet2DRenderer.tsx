import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePetContentManifest } from '../../pet-runtime/content/usePetContentManifest';
import { type PetAction } from '../../types';
import PetModel2D from '../PetModel2D';
import { normalize2DVisualBounds, type PetVisualBounds } from './petVisualBounds';
import {
  resolvePet2DRenderAdapterState,
  type Pet2DRenderAdapterState,
} from './pet2dRenderAdapterState';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  summarizePointerLookTarget,
} from './petPointerLookDiagnostics';

type Position = {
  x: number;
  y: number;
};

interface Pet2DRendererProps {
  action: PetAction;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  isDragging?: boolean;
  isMoving: boolean;
  modelUrl: string;
  sequenceFrames?: string[];
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: Position | null;
  renderAdapterState?: Pet2DRenderAdapterState;
  scale: number;
  sequenceFrameDurationMultiplier?: number;
}

const Pet2DRenderer = memo(function Pet2DRenderer({
  action,
  expressionAction = null,
  focusTarget = null,
  isDragging = false,
  isMoving,
  modelUrl,
  sequenceFrames = [],
  onVisualBoundsChange,
  pointerLookTarget = null,
  renderAdapterState,
  scale,
  sequenceFrameDurationMultiplier = 1,
}: Pet2DRendererProps) {
  const pointerLookDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const { manifest: contentManifest } = usePetContentManifest(modelUrl);
  const resolvedRenderAdapterState = useMemo(() => (
    renderAdapterState ?? resolvePet2DRenderAdapterState({
      action,
      expressionAction,
      isMoving,
      scale,
      sequenceFrameDurationMultiplier,
    })
  ), [action, expressionAction, isMoving, renderAdapterState, scale, sequenceFrameDurationMultiplier]);

  const emitNormalizedBounds = useCallback((bounds: PetVisualBounds) => {
    if (!onVisualBoundsChange) {
      return;
    }

    onVisualBoundsChange(normalize2DVisualBounds(bounds));
  }, [onVisualBoundsChange]);

  useEffect(() => {
    pushPointerLookDiagnosticLog(
      pointerLookDiagnosticsRef.current,
      '2d renderer received pointer look target',
      [
        modelUrl,
        createPointerLookTargetSignature(pointerLookTarget),
      ],
      {
        focusTarget: summarizePointerLookTarget(focusTarget),
        isDragging,
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(pointerLookTarget),
      },
    );
  }, [focusTarget, isDragging, modelUrl, pointerLookTarget]);

  return (
    <PetModel2D
      url={modelUrl}
      scale={scale}
      action={action}
      expressionAction={expressionAction}
      isMoving={isMoving}
      isDragging={isDragging}
      sequenceFrameDurationMultiplier={sequenceFrameDurationMultiplier}
      sequenceFrames={sequenceFrames}
      focusTarget={focusTarget}
      pointerLookTarget={pointerLookTarget}
      onVisualBoundsChange={emitNormalizedBounds}
      contentManifest={contentManifest}
      presentationState={resolvedRenderAdapterState.presentationState}
      renderAdapterState={resolvedRenderAdapterState}
    />
  );
});

Pet2DRenderer.displayName = 'Pet2DRenderer';

export default Pet2DRenderer;
