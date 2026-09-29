import { useEffect, useRef } from 'react';
import { type PetRuntimePosition } from './petRuntimeTypes';

type UseMainPetVisionControllerOptions = {
  isAutoMoving: boolean;
  setVisionTarget: (target: PetRuntimePosition | null) => void;
};

const IDLE_VISION_TARGET = { x: 200, y: -150 };
const VISION_CLEAR_DELAY_MS = 3000;
const VISION_POLL_INTERVAL_MS = 10000;

export function useMainPetVisionController({
  isAutoMoving,
  setVisionTarget,
}: UseMainPetVisionControllerOptions) {
  const clearVisionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAutoMoving) {
      if (clearVisionTimeoutRef.current !== null) {
        window.clearTimeout(clearVisionTimeoutRef.current);
        clearVisionTimeoutRef.current = null;
      }
      setVisionTarget(null);
      return undefined;
    }

    const visionInterval = window.setInterval(() => {
      if (Math.random() <= 0.7) {
        return;
      }

      setVisionTarget(IDLE_VISION_TARGET);
      if (clearVisionTimeoutRef.current !== null) {
        window.clearTimeout(clearVisionTimeoutRef.current);
      }
      clearVisionTimeoutRef.current = window.setTimeout(() => {
        clearVisionTimeoutRef.current = null;
        setVisionTarget(null);
      }, VISION_CLEAR_DELAY_MS);
    }, VISION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(visionInterval);
      if (clearVisionTimeoutRef.current !== null) {
        window.clearTimeout(clearVisionTimeoutRef.current);
        clearVisionTimeoutRef.current = null;
      }
    };
  }, [isAutoMoving, setVisionTarget]);
}
