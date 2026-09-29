import { useEffect, useMemo, useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { type DesktopMouseInteractionTarget } from './desktopMouseTarget';

const DESKTOP_MOUSE_POLL_INTERVAL_MS = 500;

type Position = {
  x: number;
  y: number;
};

interface UseDesktopMouseTargetOptions {
  activityCenter: Position;
  availableDisplays: DesktopPetDisplayLike[];
  config: PetConfig;
}

function resolveVirtualDesktopOrigin(availableDisplays: DesktopPetDisplayLike[]) {
  if (!availableDisplays.length) {
    return { x: 0, y: 0 };
  }

  return availableDisplays.reduce((origin, display) => ({
    x: Math.min(origin.x, Number.isFinite(display.x) ? display.x : origin.x),
    y: Math.min(origin.y, Number.isFinite(display.y) ? display.y : origin.y),
  }), {
    x: Number.isFinite(availableDisplays[0]?.x) ? availableDisplays[0].x : 0,
    y: Number.isFinite(availableDisplays[0]?.y) ? availableDisplays[0].y : 0,
  });
}

function mapCursorPointToTarget(
  point: DesktopPetCursorPointLike,
  virtualOrigin: Position,
  activityCenter: Position,
): DesktopMouseInteractionTarget | null {
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    id: 'desktop-mouse',
    position: {
      x: Math.round(x - virtualOrigin.x - activityCenter.x),
      y: Math.round(y - virtualOrigin.y - activityCenter.y),
    },
    updatedAt: Number.isFinite(point.updatedAt) ? Number(point.updatedAt) : Date.now(),
  };
}

export function useDesktopMouseTarget({
  activityCenter,
  availableDisplays,
  config,
}: UseDesktopMouseTargetOptions) {
  const [cursorPoint, setCursorPoint] = useState<DesktopPetCursorPointLike | null>(null);
  const shouldTrackDesktopMouse = desktopPetShellRuntime.isDesktopMode()
    && !config.settings.activityAreaLimitEnabled
    && config.settings.desktopMouseInteractionEnabled;

  useEffect(() => {
    if (!shouldTrackDesktopMouse) {
      setCursorPoint(null);
      return undefined;
    }

    let isMounted = true;
    let didLogReady = false;
    const loadCursorPoint = () => {
      desktopPetShellRuntime.getCursorScreenPoint()
        .then((point) => {
          if (!isMounted) {
            return;
          }

          setCursorPoint(point);
          if (!didLogReady && point) {
            didLogReady = true;
            pushFrontendRuntimeLog('desktop-mouse', 'desktop mouse tracking started');
          }
        })
        .catch((error) => {
          pushFrontendRuntimeLog('desktop-mouse', 'desktop mouse tracking failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    };

    loadCursorPoint();
    const refreshIntervalId = window.setInterval(loadCursorPoint, DESKTOP_MOUSE_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(refreshIntervalId);
    };
  }, [shouldTrackDesktopMouse]);

  return useMemo(() => {
    if (!shouldTrackDesktopMouse || !cursorPoint) {
      return null;
    }

    const virtualOrigin = resolveVirtualDesktopOrigin(availableDisplays);
    return mapCursorPointToTarget(cursorPoint, virtualOrigin, activityCenter);
  }, [
    activityCenter.x,
    activityCenter.y,
    availableDisplays,
    cursorPoint,
    shouldTrackDesktopMouse,
  ]);
}
