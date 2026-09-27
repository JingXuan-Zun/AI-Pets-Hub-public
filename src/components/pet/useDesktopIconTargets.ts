import { useEffect, useMemo, useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import { type DesktopIconInteractionTarget } from './desktopIconTargets';

const DESKTOP_ICON_REFRESH_INTERVAL_MS = 15000;

type Position = {
  x: number;
  y: number;
};

interface UseDesktopIconTargetsOptions {
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

function mapDesktopIconToTarget(
  icon: DesktopPetDesktopIconLike,
  virtualOrigin: Position,
  activityCenter: Position,
): DesktopIconInteractionTarget | null {
  const centerX = Number(icon.centerX);
  const centerY = Number(icon.centerY);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    return null;
  }

  return {
    id: icon.id || `desktop-icon-${icon.index}`,
    name: icon.name || `Desktop item ${icon.index + 1}`,
    position: {
      x: Math.round(centerX - virtualOrigin.x - activityCenter.x),
      y: Math.round(centerY - virtualOrigin.y - activityCenter.y),
    },
  };
}

export function useDesktopIconTargets({
  activityCenter,
  availableDisplays,
  config,
}: UseDesktopIconTargetsOptions) {
  const [desktopIcons, setDesktopIcons] = useState<DesktopPetDesktopIconLike[]>([]);
  const shouldTrackDesktopIcons = desktopPetShellRuntime.isDesktopMode()
    && !config.settings.activityAreaLimitEnabled
    && config.settings.desktopIconInteractionEnabled;

  useEffect(() => {
    if (!shouldTrackDesktopIcons) {
      setDesktopIcons([]);
      return undefined;
    }

    let isMounted = true;
    const loadDesktopIcons = (forceRefresh = false) => {
      desktopPetShellRuntime.listDesktopIcons({ forceRefresh })
        .then((icons) => {
          if (!isMounted) {
            return;
          }

          const nextIcons = Array.isArray(icons) ? icons : [];
          setDesktopIcons(nextIcons);
          pushFrontendRuntimeLog('desktop-icons', 'desktop icons loaded', {
            count: nextIcons.length,
          });
        })
        .catch((error) => {
          pushFrontendRuntimeLog('desktop-icons', 'desktop icons load failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    };

    loadDesktopIcons(true);
    const refreshIntervalId = window.setInterval(() => loadDesktopIcons(), DESKTOP_ICON_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(refreshIntervalId);
    };
  }, [shouldTrackDesktopIcons]);

  return useMemo(() => {
    if (!shouldTrackDesktopIcons || !desktopIcons.length) {
      return [] as DesktopIconInteractionTarget[];
    }

    const virtualOrigin = resolveVirtualDesktopOrigin(availableDisplays);
    return desktopIcons
      .map((icon) => mapDesktopIconToTarget(icon, virtualOrigin, activityCenter))
      .filter((target): target is DesktopIconInteractionTarget => target !== null);
  }, [
    activityCenter.x,
    activityCenter.y,
    availableDisplays,
    desktopIcons,
    shouldTrackDesktopIcons,
  ]);
}
