import { useEffect, useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import {
  CAPTURE_SOURCE_TYPES,
  normalizeCaptureSourceTypes,
  type CaptureSourceType,
} from './visionSettingsUtils';

interface UseVisionDisplayEnvironmentOptions {
  activeTab: string;
  isOpen: boolean;
}

interface LoadDisplayEnvironmentOptions {
  captureSourceTypes?: CaptureSourceType[];
  refreshCaptureSources?: boolean;
  includeCaptureThumbnails?: boolean;
}

export function useVisionDisplayEnvironment({
  activeTab,
  isOpen,
}: UseVisionDisplayEnvironmentOptions) {
  const [availableDisplays, setAvailableDisplays] = useState<DesktopPetDisplayLike[]>([]);
  const [screenCaptureSources, setScreenCaptureSources] = useState<DesktopPetCaptureSourceLike[]>([]);
  const [windowCaptureSources, setWindowCaptureSources] = useState<DesktopPetCaptureSourceLike[]>([]);
  const [screenCaptureSourcesLoading, setScreenCaptureSourcesLoading] = useState(false);
  const [windowCaptureSourcesLoading, setWindowCaptureSourcesLoading] = useState(false);
  const [screenCaptureSourcesLoaded, setScreenCaptureSourcesLoaded] = useState(false);
  const [windowCaptureSourcesLoaded, setWindowCaptureSourcesLoaded] = useState(false);

  const setCaptureSourceTypesLoading = (types: CaptureSourceType[], isLoading: boolean) => {
    const normalizedTypes = normalizeCaptureSourceTypes(types);
    if (normalizedTypes.includes('screen')) {
      setScreenCaptureSourcesLoading(isLoading);
    }
    if (normalizedTypes.includes('window')) {
      setWindowCaptureSourcesLoading(isLoading);
    }
  };

  const resetCaptureSourceState = () => {
    setScreenCaptureSources([]);
    setWindowCaptureSources([]);
    setScreenCaptureSourcesLoading(false);
    setWindowCaptureSourcesLoading(false);
    setScreenCaptureSourcesLoaded(false);
    setWindowCaptureSourcesLoaded(false);
  };

  const applyDisplayEnvironment = (
    environment: DesktopPetDisplayEnvironmentLike | null | undefined,
    options?: { preserveCaptureSources?: boolean },
  ) => {
    const preserveCaptureSources = Boolean(options?.preserveCaptureSources);
    setAvailableDisplays(Array.isArray(environment?.displays) ? environment.displays : []);

    if (environment?.captureSourcesIncluded) {
      const nextCaptureSources = Array.isArray(environment?.captureSources) ? environment.captureSources : [];
      const inferredCaptureSourceTypes = Array.from(new Set(
        nextCaptureSources
          .map((source) => source.type)
          .filter((type): type is CaptureSourceType => type === 'screen' || type === 'window'),
      ));
      const includedCaptureSourceTypes =
        Array.isArray(environment?.captureSourceTypesIncluded) && environment.captureSourceTypesIncluded.length
          ? normalizeCaptureSourceTypes(environment.captureSourceTypesIncluded)
          : (inferredCaptureSourceTypes.length
            ? normalizeCaptureSourceTypes(inferredCaptureSourceTypes)
            : [...CAPTURE_SOURCE_TYPES]);
      const captureSourcesPending = Boolean(environment?.captureSourcesPending);

      if (includedCaptureSourceTypes.includes('screen')) {
        setScreenCaptureSources(nextCaptureSources.filter((source) => source.type === 'screen'));
        setScreenCaptureSourcesLoading(captureSourcesPending);
        setScreenCaptureSourcesLoaded(true);
      }
      if (includedCaptureSourceTypes.includes('window')) {
        setWindowCaptureSources(nextCaptureSources.filter((source) => source.type === 'window'));
        setWindowCaptureSourcesLoading(captureSourcesPending);
        setWindowCaptureSourcesLoaded(true);
      }
      return;
    }

    if (!preserveCaptureSources) {
      resetCaptureSourceState();
    }
  };

  const loadDisplayEnvironment = async (options?: LoadDisplayEnvironmentOptions) => {
    if (!desktopPetShellRuntime.isDesktopMode()) {
      applyDisplayEnvironment(null);
      resetCaptureSourceState();
      return;
    }

    const requestedCaptureSourceTypes = Array.isArray(options?.captureSourceTypes)
      ? normalizeCaptureSourceTypes(options.captureSourceTypes)
      : [];
    const includeCaptureSources = requestedCaptureSourceTypes.length > 0;
    const refreshCaptureSources = Boolean(options?.refreshCaptureSources);
    if (includeCaptureSources) {
      setCaptureSourceTypesLoading(requestedCaptureSourceTypes, true);
    }

    const environment = await desktopPetShellRuntime.getDisplayEnvironment({
      includeCaptureSources,
      captureSourceTypes: requestedCaptureSourceTypes,
      preferCachedCaptureSources: includeCaptureSources && !refreshCaptureSources,
      forceRefreshCaptureSources: includeCaptureSources && refreshCaptureSources,
      includeCaptureThumbnails: Boolean(options?.includeCaptureThumbnails),
    });
    if (environment) {
      applyDisplayEnvironment(environment, { preserveCaptureSources: !includeCaptureSources });
      return;
    }

    const displays = await desktopPetShellRuntime.listDisplays();

    if (includeCaptureSources) {
      const nextCaptureSources = await desktopPetShellRuntime.listCaptureSources();
      applyDisplayEnvironment({
        displays,
        captureSources: nextCaptureSources.filter((source) => requestedCaptureSourceTypes.includes(source.type)),
        captureSourceTypesIncluded: requestedCaptureSourceTypes,
        captureSourcesPending: false,
        captureSourcesIncluded: true,
      });
      return;
    }

    applyDisplayEnvironment({
      displays,
      captureSources: [],
      captureSourcesPending: false,
      captureSourcesIncluded: false,
    }, { preserveCaptureSources: true });
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'vision') {
      return;
    }

    let isMounted = true;
    const loadTimer = window.setTimeout(() => {
      loadDisplayEnvironment()
        .catch(() => {
          if (isMounted) {
            applyDisplayEnvironment(null);
            setCaptureSourceTypesLoading(CAPTURE_SOURCE_TYPES, false);
          }
        });
    }, 120);

    const unsubscribe = desktopPetShellRuntime.onDisplayEnvironmentChange((environment) => {
      if (!isMounted) {
        return;
      }

      applyDisplayEnvironment(environment, {
        preserveCaptureSources: !environment?.captureSourcesIncluded,
      });
    });

    return () => {
      isMounted = false;
      window.clearTimeout(loadTimer);
      unsubscribe();
    };
  }, [activeTab, isOpen]);

  return {
    applyDisplayEnvironment,
    availableDisplays,
    loadDisplayEnvironment,
    screenCaptureSources,
    screenCaptureSourcesLoaded,
    screenCaptureSourcesLoading,
    setCaptureSourceTypesLoading,
    windowCaptureSources,
    windowCaptureSourcesLoaded,
    windowCaptureSourcesLoading,
  };
}
