import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';

type Position = {
  x: number;
  y: number;
};

interface UsePetScaleControllerOptions {
  clampPetPosition: (position: Position) => Position;
  configRef: MutableRefObject<PetConfig>;
  maxPetScale: number;
  minPetScale: number;
  onUpdateConfig: PetConfigUpdateHandler;
  petScaleStep: number;
  petPosRef: MutableRefObject<Position>;
  resolveScaledPetPosition?: (
    currentPosition: Position,
    currentScale: number,
    nextScale: number,
  ) => Position;
  setPetPos: Dispatch<SetStateAction<Position>>;
}

export function usePetScaleController({
  clampPetPosition,
  configRef,
  maxPetScale,
  minPetScale,
  onUpdateConfig,
  petScaleStep,
  petPosRef,
  resolveScaledPetPosition,
  setPetPos,
}: UsePetScaleControllerOptions) {
  const updatePetScale = useCallback((scale: number) => {
    const currentConfig = configRef.current;
    const nextScale = Math.max(minPetScale, Math.min(maxPetScale, Number(scale.toFixed(2))));

    if (Math.abs(nextScale - currentConfig.scale) < 0.001) {
      return;
    }

    const currentPosition = clampPetPosition(petPosRef.current);
    const nextPosition = resolveScaledPetPosition
      ? resolveScaledPetPosition(currentPosition, currentConfig.scale, nextScale)
      : currentPosition;
    if (currentConfig.modelType === '3d') {
      pushFrontendRuntimeLog('scale-diagnose', 'TEMP 3d wheel scale position probe', {
        clampedPosition: currentPosition,
        committedPosition: nextPosition,
        currentPosition: petPosRef.current,
        currentScale: currentConfig.scale,
        nextScale,
      });
    }
    const nextConfig = {
      ...currentConfig,
      position: nextPosition,
      scale: nextScale,
    };
    petPosRef.current = nextPosition;
    setPetPos((renderedPosition) => (
      renderedPosition.x === nextPosition.x
      && renderedPosition.y === nextPosition.y
        ? renderedPosition
        : nextPosition
    ));
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [
    clampPetPosition,
    configRef,
    maxPetScale,
    minPetScale,
    onUpdateConfig,
    petPosRef,
    resolveScaledPetPosition,
    setPetPos,
  ]);

  const handlePetWheelScale = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const direction = event.deltaY < 0 ? 1 : -1;
    updatePetScale(configRef.current.scale + direction * petScaleStep);
  }, [configRef, petScaleStep, updatePetScale]);

  return {
    handlePetWheelScale,
    updatePetScale,
  };
}
