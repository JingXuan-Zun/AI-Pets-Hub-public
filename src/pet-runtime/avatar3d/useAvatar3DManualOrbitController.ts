import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { resolveNextPetModel3DManualOrbit } from '../../components/pet/pet3DPresentationMath';

export type Avatar3DManualOrbitState = {
  active: boolean;
  hasValue: boolean;
  pitch: number;
  previousClientX: number;
  previousClientY: number;
  yaw: number;
};

export function useAvatar3DManualOrbitController() {
  const manualOrbitRef = useRef<Avatar3DManualOrbitState>({
    active: false,
    hasValue: false,
    pitch: 0,
    previousClientX: 0,
    previousClientY: 0,
    yaw: 0,
  });

  const beginManualOrbit = useCallback((clientX: number, clientY: number) => {
    manualOrbitRef.current.active = true;
    manualOrbitRef.current.hasValue = true;
    manualOrbitRef.current.previousClientX = clientX;
    manualOrbitRef.current.previousClientY = clientY;
  }, []);

  const updateManualOrbit = useCallback((clientX: number, clientY: number) => {
    const manualOrbit = manualOrbitRef.current;
    if (!manualOrbit.active) {
      return;
    }

    const deltaX = clientX - manualOrbit.previousClientX;
    const deltaY = clientY - manualOrbit.previousClientY;
    manualOrbit.previousClientX = clientX;
    manualOrbit.previousClientY = clientY;
    const nextOrbit = resolveNextPetModel3DManualOrbit(
      manualOrbit.yaw,
      manualOrbit.pitch,
      deltaX,
      deltaY,
    );
    manualOrbit.yaw = nextOrbit.yaw;
    manualOrbit.pitch = nextOrbit.pitch;
  }, []);

  const finishManualOrbit = useCallback(() => {
    if (!manualOrbitRef.current.active) {
      return;
    }

    manualOrbitRef.current.active = false;
  }, []);

  const handleMiddleMouseDownCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    beginManualOrbit(event.clientX, event.clientY);
  }, [beginManualOrbit]);

  const stopMiddleMouseDefault = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      if ((event.buttons & 4) !== 4) {
        finishManualOrbit();
        return;
      }

      if (!manualOrbitRef.current.active) {
        return;
      }

      updateManualOrbit(event.clientX, event.clientY);
      event.preventDefault();
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      if (event.button !== 1 && (event.buttons & 4) === 4) {
        return;
      }

      finishManualOrbit();
    };

    const handleWindowBlur = () => {
      finishManualOrbit();
    };

    window.addEventListener('mousemove', handleWindowMouseMove, true);
    window.addEventListener('mouseup', handleWindowMouseUp, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove, true);
      window.removeEventListener('mouseup', handleWindowMouseUp, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [finishManualOrbit, updateManualOrbit]);

  return {
    handleMiddleMouseDownCapture,
    manualOrbitRef,
    stopMiddleMouseDefault,
  };
}
