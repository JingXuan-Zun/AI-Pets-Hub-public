import { useCallback, useEffect, useRef, useState } from 'react';
import { type Avatar3DRuntimeBackend, type ModelType } from '../../types';
import {
  arePetVisualBoundsEqual,
  resolve3DStableLayoutVisualBounds,
  type PetVisualBounds,
} from './petVisualBounds';

export type MeasuredPetVisualBoundsState = {
  interactiveVisualBounds: PetVisualBounds | null;
  latestVisualBounds: PetVisualBounds | null;
  windowShapeVisualBounds: PetVisualBounds | null;
};

type ResolveMeasuredPetVisualBoundsOptions = {
  avatar3dRuntimeBackend: Avatar3DRuntimeBackend;
  bounds: PetVisualBounds;
  isDragging: boolean;
  modelType: ModelType;
  scale: number;
  visualRendererIsMoving: boolean;
};

interface UsePetVisualBoundsMeasurementOptions {
  avatar3dRuntimeBackend: Avatar3DRuntimeBackend;
  isDragging: boolean;
  modelType: ModelType;
  modelUrl: string;
  onVisualBoundsChange?: ((bounds: PetVisualBounds) => void) | null;
  scale: number;
  visualRendererIsMoving: boolean;
}

const EMPTY_MEASURED_VISUAL_BOUNDS_STATE: MeasuredPetVisualBoundsState = {
  interactiveVisualBounds: null,
  latestVisualBounds: null,
  windowShapeVisualBounds: null,
};

type MeasuredPetVisualBoundsStateForModel = MeasuredPetVisualBoundsState & {
  measurementKey: string;
  /** Pet scale the bounds were measured at (0 = none yet). */
  measuredScale: number;
};

/**
 * 3D bounds are only re-measured once the model settles, so while the user scales a
 * 3D pet the measured box lagged behind and everything anchored to it (name tag,
 * bubble, hit area, mic pill) jumped into place only when scaling stopped. Until the
 * next measurement arrives, scale the last one by how much the pet scale changed.
 */
function scaleBoundsForCurrentScale(bounds: PetVisualBounds | null, ratio: number) {
  if (!bounds || ratio === 1) return bounds;
  return {
    left: Math.max(1, Math.round(bounds.left * ratio)),
    right: Math.max(1, Math.round(bounds.right * ratio)),
    top: Math.max(1, Math.round(bounds.top * ratio)),
    bottom: Math.max(1, Math.round(bounds.bottom * ratio)),
  } satisfies PetVisualBounds;
}

function createMeasuredVisualBoundsKey(modelType: ModelType, modelUrl: string) {
  return `${modelType}:${modelUrl}`;
}

function createEmptyMeasuredVisualBoundsStateForModel(
  measurementKey: string,
): MeasuredPetVisualBoundsStateForModel {
  return {
    ...EMPTY_MEASURED_VISUAL_BOUNDS_STATE,
    measurementKey,
    measuredScale: 0,
  };
}

function preserveEqualBounds(
  currentBounds: PetVisualBounds | null,
  nextBounds: PetVisualBounds | null,
) {
  return arePetVisualBoundsEqual(currentBounds, nextBounds) ? currentBounds : nextBounds;
}

export function areMeasuredPetVisualBoundsEqual(
  left: MeasuredPetVisualBoundsState | null | undefined,
  right: MeasuredPetVisualBoundsState | null | undefined,
) {
  return arePetVisualBoundsEqual(left?.interactiveVisualBounds, right?.interactiveVisualBounds)
    && arePetVisualBoundsEqual(left?.latestVisualBounds, right?.latestVisualBounds)
    && arePetVisualBoundsEqual(left?.windowShapeVisualBounds, right?.windowShapeVisualBounds);
}

export function resolveMeasuredPetVisualBounds({
  avatar3dRuntimeBackend,
  bounds,
  isDragging,
  modelType,
  scale,
  visualRendererIsMoving,
}: ResolveMeasuredPetVisualBoundsOptions): MeasuredPetVisualBoundsState | null {
  const shouldHoldDragMeasuredBounds = isDragging
    && (
      modelType === 'live2d'
      || (modelType === '3d' && avatar3dRuntimeBackend === 'unity')
    );
  if (shouldHoldDragMeasuredBounds) {
    return null;
  }

  const layoutBounds = modelType === '3d' && avatar3dRuntimeBackend === 'three'
    ? resolve3DStableLayoutVisualBounds(bounds, scale, visualRendererIsMoving)
    : bounds;

  return {
    interactiveVisualBounds: layoutBounds,
    latestVisualBounds: layoutBounds,
    windowShapeVisualBounds: bounds,
  };
}

export function usePetVisualBoundsMeasurement({
  avatar3dRuntimeBackend,
  isDragging,
  modelType,
  modelUrl,
  onVisualBoundsChange,
  scale,
  visualRendererIsMoving,
}: UsePetVisualBoundsMeasurementOptions) {
  const measurementKey = createMeasuredVisualBoundsKey(modelType, modelUrl);
  const [measuredVisualBounds, setMeasuredVisualBounds] = useState<MeasuredPetVisualBoundsStateForModel>(
    () => createEmptyMeasuredVisualBoundsStateForModel(measurementKey),
  );
  const measuredVisualBoundsRef = useRef(measuredVisualBounds);
  // The renderer re-reports its last measurement when props (like scale) change; only a
  // genuinely new raw measurement may move the scale it was taken at.
  const lastRawBoundsRef = useRef<PetVisualBounds | null>(null);
  const currentMeasuredVisualBounds = measuredVisualBounds.measurementKey === measurementKey
    ? measuredVisualBounds
    : EMPTY_MEASURED_VISUAL_BOUNDS_STATE;

  useEffect(() => {
    setMeasuredVisualBounds((currentBounds) => (
      currentBounds.measurementKey === measurementKey
        ? currentBounds
        : (() => {
            const nextBounds = createEmptyMeasuredVisualBoundsStateForModel(measurementKey);
            measuredVisualBoundsRef.current = nextBounds;
            return nextBounds;
          })()
    ));
  }, [measurementKey]);

  useEffect(() => {
    measuredVisualBoundsRef.current = measuredVisualBounds;
  }, [measuredVisualBounds]);

  const handleVisualBoundsChange = useCallback((bounds: PetVisualBounds) => {
    const nextMeasuredVisualBounds = resolveMeasuredPetVisualBounds({
      avatar3dRuntimeBackend,
      bounds,
      isDragging,
      modelType,
      scale,
      visualRendererIsMoving,
    });
    if (!nextMeasuredVisualBounds) {
      return;
    }

    const currentBoundsForModel = measuredVisualBoundsRef.current.measurementKey === measurementKey
      ? measuredVisualBoundsRef.current
      : createEmptyMeasuredVisualBoundsStateForModel(measurementKey);
    if (areMeasuredPetVisualBoundsEqual(currentBoundsForModel, nextMeasuredVisualBounds)) {
      return;
    }

    const isNewRawMeasurement = !arePetVisualBoundsEqual(lastRawBoundsRef.current, bounds)
      || currentBoundsForModel.measuredScale === 0;
    lastRawBoundsRef.current = bounds;
    const nextState = {
      measurementKey,
      measuredScale: isNewRawMeasurement ? scale : currentBoundsForModel.measuredScale,
      interactiveVisualBounds: preserveEqualBounds(
        currentBoundsForModel.interactiveVisualBounds,
        nextMeasuredVisualBounds.interactiveVisualBounds,
      ),
      latestVisualBounds: preserveEqualBounds(
        currentBoundsForModel.latestVisualBounds,
        nextMeasuredVisualBounds.latestVisualBounds,
      ),
      windowShapeVisualBounds: preserveEqualBounds(
        currentBoundsForModel.windowShapeVisualBounds,
        nextMeasuredVisualBounds.windowShapeVisualBounds,
      ),
    };

    measuredVisualBoundsRef.current = nextState;
    setMeasuredVisualBounds(nextState);
    onVisualBoundsChange?.(nextMeasuredVisualBounds.latestVisualBounds);
  }, [
    avatar3dRuntimeBackend,
    isDragging,
    measurementKey,
    modelType,
    onVisualBoundsChange,
    scale,
    visualRendererIsMoving,
  ]);

  const measuredScale = measuredVisualBounds.measurementKey === measurementKey ? measuredVisualBounds.measuredScale : 0;
  const liveScaleRatio = modelType === '3d' && measuredScale > 0 && scale > 0 ? scale / measuredScale : 1;

  return {
    handleVisualBoundsChange,
    latestVisualBounds: scaleBoundsForCurrentScale(currentMeasuredVisualBounds.latestVisualBounds, liveScaleRatio),
    measuredInteractiveVisualBounds: scaleBoundsForCurrentScale(currentMeasuredVisualBounds.interactiveVisualBounds, liveScaleRatio),
    measuredWindowShapeVisualBounds: scaleBoundsForCurrentScale(currentMeasuredVisualBounds.windowShapeVisualBounds, liveScaleRatio),
  };
}
