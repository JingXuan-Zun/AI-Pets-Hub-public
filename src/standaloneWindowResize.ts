import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { desktopPetShellRuntime } from './desktopShellRuntime';

export type StandaloneWindowResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type StandaloneWindowResizeState = {
  direction: StandaloneWindowResizeDirection;
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
} | null;

interface StandaloneWindowResizeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseStandaloneWindowResizeOptions {
  enabled?: boolean;
  maxHeight?: number;
  maxWidth?: number;
  minHeight: number;
  minWidth: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function useStandaloneWindowResize({
  enabled = true,
  maxHeight = Number.MAX_SAFE_INTEGER,
  maxWidth = Number.MAX_SAFE_INTEGER,
  minHeight,
  minWidth,
}: UseStandaloneWindowResizeOptions) {
  const [resizeState, setResizeState] = useState<StandaloneWindowResizeState>(null);
  const frameRef = useRef<number | null>(null);
  const pendingBoundsRef = useRef<StandaloneWindowResizeBounds | null>(null);

  useEffect(() => {
    if (!resizeState || !enabled) {
      return;
    }

    const flushPendingBounds = () => {
      frameRef.current = null;
      const nextBounds = pendingBoundsRef.current;
      pendingBoundsRef.current = null;

      if (!nextBounds) {
        return;
      }

      desktopPetShellRuntime.setCurrentWindowBounds(nextBounds);
    };

    const scheduleBoundsUpdate = (nextBounds: StandaloneWindowResizeBounds) => {
      pendingBoundsRef.current = nextBounds;
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(flushPendingBounds);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== resizeState.pointerId) {
        return;
      }

      // Window-local client coordinates drift while resizing from the left/top
      // because the window origin itself is moving. Screen coordinates stay stable.
      const deltaX = event.screenX - resizeState.startScreenX;
      const deltaY = event.screenY - resizeState.startScreenY;
      const resizeFromLeft = resizeState.direction.includes('w');
      const resizeFromRight = resizeState.direction.includes('e');
      const resizeFromTop = resizeState.direction.includes('n');
      const resizeFromBottom = resizeState.direction.includes('s');
      const rawWidth = resizeState.originWidth
        + (resizeFromRight ? deltaX : 0)
        - (resizeFromLeft ? deltaX : 0);
      const rawHeight = resizeState.originHeight
        + (resizeFromBottom ? deltaY : 0)
        - (resizeFromTop ? deltaY : 0);
      const nextWidth = clamp(rawWidth, minWidth, maxWidth);
      const nextHeight = clamp(rawHeight, minHeight, maxHeight);

      scheduleBoundsUpdate({
        x: Math.round(
          resizeFromLeft
            ? resizeState.originX + resizeState.originWidth - nextWidth
            : resizeState.originX,
        ),
        y: Math.round(
          resizeFromTop
            ? resizeState.originY + resizeState.originHeight - nextHeight
            : resizeState.originY,
        ),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };

    const stopResize = (event: PointerEvent) => {
      if (event.pointerId !== resizeState.pointerId) {
        return;
      }

      flushPendingBounds();
      setResizeState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingBoundsRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [enabled, maxHeight, maxWidth, minHeight, minWidth, resizeState]);

  const startWindowResize = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    direction: StandaloneWindowResizeDirection,
  ) => {
    if (!enabled || !desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const currentX = Number.isFinite(window.screenX) ? window.screenX : window.screenLeft;
    const currentY = Number.isFinite(window.screenY) ? window.screenY : window.screenTop;
    const currentWidth = window.outerWidth || window.innerWidth;
    const currentHeight = window.outerHeight || window.innerHeight;

    setResizeState({
      direction,
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      originX: Math.round(currentX),
      originY: Math.round(currentY),
      originWidth: Math.round(currentWidth),
      originHeight: Math.round(currentHeight),
    });
  }, [enabled]);

  return {
    isResizing: resizeState !== null,
    startWindowResize,
  };
}
