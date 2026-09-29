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
};

function createMeasuredVisualBoundsKey(modelType: ModelType, modelUrl: string) {
  return `${modelType}:${modelUrl}`;
}

function createEmptyMeasuredVisualBoundsStateForModel(
  measurementKey: string,
): MeasuredPetVisualBoundsStateForModel {
  return {
    ...EMPTY_MEASURED_VISUAL_BOUNDS_STATE,
    measurementKey,
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

    const nextState = {
      measurementKey,
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

  return {
    handleVisualBoundsChange,
    latestVisualBounds: currentMeasuredVisualBounds.latestVisualBounds,
    measuredInteractiveVisualBounds: currentMeasuredVisualBounds.interactiveVisualBounds,
    measuredWindowShapeVisualBounds: currentMeasuredVisualBounds.windowShapeVisualBounds,
  };
}
