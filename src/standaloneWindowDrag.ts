import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { desktopPetShellRuntime } from './desktopShellRuntime';

type StandaloneWindowDragState = {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
} | null;

interface UseStandaloneWindowDragOptions {
  enabled?: boolean;
}

export function useStandaloneWindowDrag({
  enabled = true,
}: UseStandaloneWindowDragOptions = {}) {
  const [dragState, setDragState] = useState<StandaloneWindowDragState>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!dragState || !enabled) {
      return;
    }

    const flushPendingPosition = () => {
      frameRef.current = null;
      const nextPosition = pendingPositionRef.current;
      pendingPositionRef.current = null;

      if (!nextPosition) {
        return;
      }

      desktopPetShellRuntime.setCurrentWindowBounds({
        x: nextPosition.x,
        y: nextPosition.y,
        width: dragState.width,
        height: dragState.height,
      });
    };

    const schedulePositionUpdate = (x: number, y: number) => {
      pendingPositionRef.current = { x, y };
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(flushPendingPosition);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      schedulePositionUpdate(
        Math.round(dragState.originX + event.screenX - dragState.startScreenX),
        Math.round(dragState.originY + event.screenY - dragState.startScreenY),
      );
    };

    const stopDrag = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      flushPendingPosition();
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingPositionRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, [dragState, enabled]);

  const startWindowDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    options?: { allowControl?: boolean },
  ) => {
    if (!enabled || !desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    if (!options?.allowControl && (event.target as HTMLElement).closest('button, input, select, textarea, [role="tab"]')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const currentX = Number.isFinite(window.screenX) ? window.screenX : window.screenLeft;
    const currentY = Number.isFinite(window.screenY) ? window.screenY : window.screenTop;

    setDragState({
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      originX: Math.round(currentX),
      originY: Math.round(currentY),
      width: Math.round(window.outerWidth || window.innerWidth),
      height: Math.round(window.outerHeight || window.innerHeight),
    });
  }, [enabled]);

  return {
    isDragging: dragState !== null,
    startWindowDrag,
  };
}
