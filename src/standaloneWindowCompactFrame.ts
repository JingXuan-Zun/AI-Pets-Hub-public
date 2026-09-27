import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopPetShellRuntime } from './desktopShellRuntime';

export const STANDALONE_WINDOW_COMPACT_WIDTH = 56;
export const STANDALONE_WINDOW_COMPACT_HEIGHT = 48;

interface StandaloneWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseStandaloneWindowCompactFrameOptions {
  compactHeight?: number;
  compactWidth?: number;
  enabled?: boolean;
}

function getCurrentWindowBounds(): StandaloneWindowBounds {
  const currentX = Number.isFinite(window.screenX) ? window.screenX : window.screenLeft;
  const currentY = Number.isFinite(window.screenY) ? window.screenY : window.screenTop;

  return {
    x: Math.round(Number.isFinite(currentX) ? currentX : 0),
    y: Math.round(Number.isFinite(currentY) ? currentY : 0),
    width: Math.max(1, Math.round(window.outerWidth || window.innerWidth)),
    height: Math.max(1, Math.round(window.outerHeight || window.innerHeight)),
  };
}

export function useStandaloneWindowCompactFrame({
  compactHeight = STANDALONE_WINDOW_COMPACT_HEIGHT,
  compactWidth = STANDALONE_WINDOW_COMPACT_WIDTH,
  enabled = true,
}: UseStandaloneWindowCompactFrameOptions = {}) {
  const [isCompact, setIsCompact] = useState(false);
  const isCompactRef = useRef(false);
  const restoreBoundsRef = useRef<StandaloneWindowBounds | null>(null);

  useEffect(() => {
    isCompactRef.current = isCompact;
  }, [isCompact]);

  const compactWindow = useCallback(() => {
    if (!enabled) {
      return;
    }

    const currentBounds = getCurrentWindowBounds();
    if (!isCompactRef.current) {
      restoreBoundsRef.current = currentBounds;
    }

    if (desktopPetShellRuntime.isDesktopMode()) {
      desktopPetShellRuntime.setCurrentWindowBounds({
        x: Math.round(currentBounds.x + currentBounds.width - compactWidth),
        y: currentBounds.y,
        width: compactWidth,
        height: compactHeight,
      });
    }

    setIsCompact(true);
  }, [compactHeight, compactWidth, enabled]);

  const restoreWindow = useCallback(() => {
    const restoreBounds = restoreBoundsRef.current;
    restoreBoundsRef.current = null;

    if (enabled && restoreBounds && desktopPetShellRuntime.isDesktopMode()) {
      desktopPetShellRuntime.setCurrentWindowBounds(restoreBounds);
    }

    setIsCompact(false);
  }, [enabled]);

  const resetCompactWindow = useCallback(() => {
    restoreBoundsRef.current = null;
    setIsCompact(false);
  }, []);

  return {
    compactWindow,
    isCompact,
    resetCompactWindow,
    restoreWindow,
  };
}
