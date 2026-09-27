import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  createEmptyPetHoverState,
  resolvePetHoverState,
  type PetHoverState,
} from './petHoverController';
import { subscribeSharedAnimationTick } from '../../components/pet/sharedAnimationTicker';

type UsePetHoverControllerOptions = {
  enabled?: boolean;
  supportedRegions?: readonly string[] | null;
};

const HOVER_REFRESH_INTERVAL_MS = 48;

function areHoverStatesEqual(left: PetHoverState, right: PetHoverState) {
  return left.activeRegion === right.activeRegion
    && left.focusTarget?.x === right.focusTarget?.x
    && left.focusTarget?.y === right.focusTarget?.y
    && left.supportedRegions.length === right.supportedRegions.length
    && left.supportedRegions.every((region, index) => region === right.supportedRegions[index]);
}

export function usePetHoverController({
  enabled = true,
  supportedRegions = null,
}: UsePetHoverControllerOptions) {
  const hoverTargetRef = useRef<HTMLDivElement | null>(null);
  const lastPointerPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastAnimationRefreshAtRef = useRef(0);
  const [hoverState, setHoverState] = useState<PetHoverState>(() => (
    createEmptyPetHoverState(supportedRegions)
  ));

  const commitHoverState = useCallback((nextState: PetHoverState) => {
    setHoverState((currentState) => (
      areHoverStatesEqual(currentState, nextState)
        ? currentState
        : nextState
    ));
  }, []);

  const clearHoverState = useCallback(() => {
    commitHoverState(createEmptyPetHoverState(supportedRegions));
  }, [commitHoverState, supportedRegions]);

  const updateHoverFromClientPoint = useCallback((clientPoint: { x: number; y: number } | null) => {
    if (!enabled) {
      clearHoverState();
      return;
    }

    const hoverTarget = hoverTargetRef.current;
    if (!hoverTarget || !clientPoint) {
      clearHoverState();
      return;
    }

    const topmostPointerElement = hoverTarget.ownerDocument.elementFromPoint(
      clientPoint.x,
      clientPoint.y,
    );
    if (topmostPointerElement && !hoverTarget.contains(topmostPointerElement)) {
      clearHoverState();
      return;
    }

    const rect = hoverTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      clearHoverState();
      return;
    }

    const isInsideRect = clientPoint.x >= rect.left
      && clientPoint.x <= rect.right
      && clientPoint.y >= rect.top
      && clientPoint.y <= rect.bottom;

    if (!isInsideRect) {
      clearHoverState();
      return;
    }

    const normalizedPoint = {
      x: Math.min(1, Math.max(0, (clientPoint.x - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientPoint.y - rect.top) / rect.height)),
    };

    commitHoverState(resolvePetHoverState(normalizedPoint, supportedRegions));
  }, [clearHoverState, commitHoverState, enabled, supportedRegions]);

  useEffect(() => {
    if (!enabled) {
      clearHoverState();
      return;
    }

    setHoverState((currentState) => {
      const nextState = {
        ...currentState,
        supportedRegions: createEmptyPetHoverState(supportedRegions).supportedRegions,
      };

      return areHoverStatesEqual(currentState, nextState)
        ? currentState
        : nextState;
    });
    updateHoverFromClientPoint(lastPointerPointRef.current);
  }, [clearHoverState, enabled, supportedRegions, updateHoverFromClientPoint]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      const nextPoint = {
        x: event.clientX,
        y: event.clientY,
      };
      lastPointerPointRef.current = nextPoint;
      updateHoverFromClientPoint(nextPoint);
    };

    const handleWindowPointerReset = () => {
      lastPointerPointRef.current = null;
      clearHoverState();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('blur', handleWindowPointerReset);
    document.addEventListener('mouseleave', handleWindowPointerReset);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('blur', handleWindowPointerReset);
      document.removeEventListener('mouseleave', handleWindowPointerReset);
    };
  }, [clearHoverState, enabled, updateHoverFromClientPoint]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return subscribeSharedAnimationTick((timestamp) => {
      if ((timestamp - lastAnimationRefreshAtRef.current) < HOVER_REFRESH_INTERVAL_MS) {
        return;
      }

      lastAnimationRefreshAtRef.current = timestamp;
      updateHoverFromClientPoint(lastPointerPointRef.current);
    });
  }, [enabled, updateHoverFromClientPoint]);

  const handlePointerLeave = useCallback(() => {
    clearHoverState();
  }, [clearHoverState]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    hoverTargetRef.current = event.currentTarget;
    const nextPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    lastPointerPointRef.current = nextPoint;
    updateHoverFromClientPoint(nextPoint);
  }, [updateHoverFromClientPoint]);

  return {
    handlePointerLeave,
    handlePointerMove,
    hoverTargetRef,
    hoverState,
  };
}
