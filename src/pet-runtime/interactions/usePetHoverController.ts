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
// Region hysteresis. The hit box is re-measured as the model animates (a few px), and
// regions (body / hands / head) touch each other, so a pointer near a border used to
// flip region every few frames — each flip restarted a hover reaction or resumed
// walking, which showed as the model twitching in place. A new region must hold for a
// moment before it wins, and briefly slipping into a gap does not count as leaving.
const REGION_SWITCH_HOLD_MS = 160;
const REGION_EXIT_GRACE_MS = 220;

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
  const committedRegionRef = useRef<string | null>(null);
  const pendingRegionRef = useRef<{ region: string | null; since: number } | null>(null);

  const commitHoverState = useCallback((nextState: PetHoverState) => {
    committedRegionRef.current = nextState.activeRegion;
    setHoverState((currentState) => (
      areHoverStatesEqual(currentState, nextState)
        ? currentState
        : nextState
    ));
  }, []);

  /** Immediate clear: pointer left the window, window blurred, or hover got disabled. */
  const clearHoverState = useCallback(() => {
    pendingRegionRef.current = null;
    commitHoverState(createEmptyPetHoverState(supportedRegions));
  }, [commitHoverState, supportedRegions]);

  /** Region changes from pointer position go through the hysteresis above. */
  const proposeHoverState = useCallback((nextState: PetHoverState) => {
    const committedRegion = committedRegionRef.current;
    if (nextState.activeRegion === committedRegion || committedRegion === null) {
      pendingRegionRef.current = null;
      commitHoverState(nextState);
      return;
    }

    const now = performance.now();
    const pending = pendingRegionRef.current;
    if (!pending || pending.region !== nextState.activeRegion) {
      pendingRegionRef.current = { region: nextState.activeRegion, since: now };
    }
    const holdMs = nextState.activeRegion === null ? REGION_EXIT_GRACE_MS : REGION_SWITCH_HOLD_MS;
    if (now - (pendingRegionRef.current?.since ?? now) >= holdMs) {
      pendingRegionRef.current = null;
      commitHoverState(nextState);
      return;
    }

    // Keep the current region but let the look-at point follow the pointer.
    if (nextState.focusTarget) {
      setHoverState((currentState) => {
        const keptState = { ...currentState, focusTarget: nextState.focusTarget };
        return areHoverStatesEqual(currentState, keptState) ? currentState : keptState;
      });
    }
  }, [commitHoverState]);

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
      proposeHoverState(createEmptyPetHoverState(supportedRegions));
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
      proposeHoverState(createEmptyPetHoverState(supportedRegions));
      return;
    }

    const normalizedPoint = {
      x: Math.min(1, Math.max(0, (clientPoint.x - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientPoint.y - rect.top) / rect.height)),
    };

    proposeHoverState(resolvePetHoverState(normalizedPoint, supportedRegions));
  }, [clearHoverState, enabled, proposeHoverState, supportedRegions]);

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

  // The hit box edge moves a little as the model animates, so leave/enter can blink at the
  // edge; treat a leave like any other region change and let the grace period settle it.
  const handlePointerLeave = useCallback(() => {
    proposeHoverState(createEmptyPetHoverState(supportedRegions));
  }, [proposeHoverState, supportedRegions]);

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
