import { useEffect, useRef, useState } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { useVisionDisplayEnvironment } from './useVisionDisplayEnvironment';
import {
  buildAreaPreviewCaptureOptions,
  buildAreaSelectionPreviewSource,
  clampCaptureCropRect,
  getActivePreviewSourceId,
  getFilteredCaptureSources,
  getPreviewCaptureSources,
  getSelectedCaptureSource,
  getUpdatedCaptureCropRect,
  normalizeCaptureSourceTypes,
  type CaptureSourceType,
} from './visionSettingsUtils';

interface UseVisionSettingsOptions {
  activeTab: string;
  isOpen: boolean;
  onPreviewCaptureOptionsChange?: (options?: DesktopPetCaptureOptionsLike | null) => void;
  onStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  screenCaptureActive?: boolean;
  screenStream: MediaStream | null;
}

export function useVisionSettings({
  activeTab,
  isOpen,
  onPreviewCaptureOptionsChange,
  onStartScreenCapture,
  screenCaptureActive,
  screenStream,
}: UseVisionSettingsOptions) {
  const {
    availableDisplays,
    loadDisplayEnvironment,
    screenCaptureSources,
    screenCaptureSourcesLoaded,
    screenCaptureSourcesLoading,
    setCaptureSourceTypesLoading,
    windowCaptureSources,
    windowCaptureSourcesLoaded,
    windowCaptureSourcesLoading,
  } = useVisionDisplayEnvironment({
    activeTab,
    isOpen,
  });
  const [desktopAreaSelection, setDesktopAreaSelection] = useState<DesktopPetAreaSelectionLike | null>(null);
  const [captureMode, setCaptureMode] = useState<DesktopPetCaptureMode>('screen');
  const [selectedCaptureSourceId, setSelectedCaptureSourceId] = useState('');
  const [captureCropRect, setCaptureCropRect] = useState<DesktopPetCaptureRectLike>({
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  });
  const previewCaptureOptionsChangeRef = useRef(onPreviewCaptureOptionsChange);
  const pendingPreviewCaptureOptionsRef = useRef<DesktopPetCaptureOptionsLike | null>(null);
  const previewCaptureOptionsFrameRef = useRef<number | null>(null);
  const lastPreviewCaptureOptionsKeyRef = useRef('');
  const screenThumbnailRefreshTimerRef = useRef<number | null>(null);
  const windowThumbnailRefreshTimerRef = useRef<number | null>(null);

  const isDesktopConnected = screenCaptureActive ?? Boolean(screenStream);
  const isWindowAreaMode = captureMode === 'window' || captureMode === 'area';
  const captureSourcesLoading = captureMode === 'screen'
    ? screenCaptureSourcesLoading
    : windowCaptureSourcesLoading;
  const hasScreenCaptureSourcesLoaded = screenCaptureSourcesLoaded || screenCaptureSources.length > 0;
  const areaSelectionPreviewSource = buildAreaSelectionPreviewSource(desktopAreaSelection, windowCaptureSources);
  const previewCaptureSources = getPreviewCaptureSources(
    captureMode,
    screenCaptureSources,
    windowCaptureSources,
    areaSelectionPreviewSource,
  );
  const filteredCaptureSources = getFilteredCaptureSources(
    captureMode,
    screenCaptureSources,
    windowCaptureSources,
  );
  const selectedCaptureSource = getSelectedCaptureSource(filteredCaptureSources, selectedCaptureSourceId);
  const activePreviewSourceId = getActivePreviewSourceId(
    captureMode,
    desktopAreaSelection,
    selectedCaptureSource,
  );
  const captureReferenceWidth = Math.max(1, Math.round(desktopAreaSelection?.cropBasisWidth ?? selectedCaptureSource?.width ?? 320));
  const captureReferenceHeight = Math.max(1, Math.round(desktopAreaSelection?.cropBasisHeight ?? selectedCaptureSource?.height ?? 180));
  const hasScreenCaptureThumbnails = screenCaptureSources.some((source) => Boolean(source.thumbnail));
  const hasWindowCaptureThumbnails = windowCaptureSources.some((source) => Boolean(source.thumbnail));

  const clearCaptureThumbnailRefreshTimer = (type: CaptureSourceType) => {
    const timerRef = type === 'screen'
      ? screenThumbnailRefreshTimerRef
      : windowThumbnailRefreshTimerRef;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleCaptureThumbnailRefresh = (
    captureSourceType: CaptureSourceType,
    options?: { refreshCaptureSources?: boolean; delayMs?: number },
  ) => {
    const normalizedType = normalizeCaptureSourceTypes([captureSourceType])[0];
    if (!normalizedType) {
      return;
    }

    clearCaptureThumbnailRefreshTimer(normalizedType);
    const timerRef = normalizedType === 'screen'
      ? screenThumbnailRefreshTimerRef
      : windowThumbnailRefreshTimerRef;

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;

      if (!isOpen || activeTab !== 'vision') {
        return;
      }

      loadDisplayEnvironment({
        captureSourceTypes: [normalizedType],
        refreshCaptureSources: Boolean(options?.refreshCaptureSources),
        includeCaptureThumbnails: true,
      }).catch(() => {
        setCaptureSourceTypesLoading([normalizedType], false);
      });
    }, options?.delayMs ?? (normalizedType === 'screen' ? 140 : 220));
  };

  const loadCaptureSourcesProgressively = (
    captureSourceType: CaptureSourceType,
    options?: { refreshCaptureSources?: boolean },
  ) => {
    const normalizedType = normalizeCaptureSourceTypes([captureSourceType])[0];
    if (!normalizedType) {
      return;
    }

    clearCaptureThumbnailRefreshTimer(normalizedType);

    loadDisplayEnvironment({
      captureSourceTypes: [normalizedType],
      refreshCaptureSources: Boolean(options?.refreshCaptureSources),
      includeCaptureThumbnails: false,
    })
      .then(() => {
        scheduleCaptureThumbnailRefresh(normalizedType, options);
      })
      .catch(() => {
        setCaptureSourceTypesLoading([normalizedType], false);
      });
  };

  useEffect(() => {
    previewCaptureOptionsChangeRef.current = onPreviewCaptureOptionsChange;
  }, [onPreviewCaptureOptionsChange]);

  useEffect(() => {
    if (isOpen && activeTab === 'vision') {
      return;
    }

    clearCaptureThumbnailRefreshTimer('screen');
    clearCaptureThumbnailRefreshTimer('window');
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'vision') {
      return;
    }

    if (hasScreenCaptureSourcesLoaded || screenCaptureSourcesLoading) {
      return;
    }

    loadCaptureSourcesProgressively('screen');
  }, [
    activeTab,
    hasScreenCaptureSourcesLoaded,
    isOpen,
    screenCaptureSourcesLoading,
  ]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'vision' || !screenCaptureSourcesLoaded || !screenCaptureSources.length) {
      return;
    }

    if (screenCaptureSourcesLoading || hasScreenCaptureThumbnails) {
      return;
    }

    scheduleCaptureThumbnailRefresh('screen');
  }, [
    activeTab,
    hasScreenCaptureThumbnails,
    isOpen,
    screenCaptureSourcesLoading,
    screenCaptureSources.length,
    screenCaptureSourcesLoaded,
  ]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'vision' || !screenCaptureSourcesLoading || screenCaptureSources.length) {
      return;
    }

    const retryTimer = window.setTimeout(() => {
      loadCaptureSourcesProgressively('screen', { refreshCaptureSources: true });
    }, 1200);

    return () => {
      window.clearTimeout(retryTimer);
    };
  }, [
    activeTab,
    isOpen,
    screenCaptureSources.length,
    screenCaptureSourcesLoading,
  ]);

  useEffect(() => {
    if (filteredCaptureSources.some((source) => source.id === selectedCaptureSourceId)) {
      return;
    }

    setSelectedCaptureSourceId(filteredCaptureSources[0]?.id ?? '');
  }, [filteredCaptureSources, selectedCaptureSourceId]);

  useEffect(() => {
    setCaptureCropRect((currentRect) => clampCaptureCropRect(
      currentRect,
      captureReferenceWidth,
      captureReferenceHeight,
    ));
  }, [captureReferenceHeight, captureReferenceWidth, selectedCaptureSource?.id]);

  useEffect(() => {
    const notifyPreviewCaptureOptionsChange = previewCaptureOptionsChangeRef.current;
    if (!notifyPreviewCaptureOptionsChange) {
      return;
    }

    pendingPreviewCaptureOptionsRef.current = buildAreaPreviewCaptureOptions(
      captureMode,
      desktopAreaSelection,
      captureCropRect,
      captureReferenceWidth,
      captureReferenceHeight,
    );

    if (previewCaptureOptionsFrameRef.current !== null) {
      return;
    }

    previewCaptureOptionsFrameRef.current = window.requestAnimationFrame(() => {
      previewCaptureOptionsFrameRef.current = null;

      const nextOptions = pendingPreviewCaptureOptionsRef.current;
      const nextKey = nextOptions ? JSON.stringify(nextOptions) : 'null';
      if (lastPreviewCaptureOptionsKeyRef.current === nextKey) {
        return;
      }

      lastPreviewCaptureOptionsKeyRef.current = nextKey;
      previewCaptureOptionsChangeRef.current?.(nextOptions);
    });
  }, [
    captureMode,
    captureCropRect,
    captureReferenceHeight,
    captureReferenceWidth,
    desktopAreaSelection,
  ]);

  useEffect(() => {
    return () => {
      if (previewCaptureOptionsFrameRef.current !== null) {
        window.cancelAnimationFrame(previewCaptureOptionsFrameRef.current);
        previewCaptureOptionsFrameRef.current = null;
      }

      clearCaptureThumbnailRefreshTimer('screen');
      clearCaptureThumbnailRefreshTimer('window');
    };
  }, []);

  const refreshCaptureSources = () => {
    loadCaptureSourcesProgressively(captureMode === 'screen' ? 'screen' : 'window', {
      refreshCaptureSources: true,
    });
  };

  const activateWindowAreaMode = () => {
    setCaptureMode((currentMode) => {
      if (currentMode === 'window' || currentMode === 'area') {
        return currentMode;
      }

      return desktopAreaSelection ? 'area' : 'window';
    });

    if (!windowCaptureSourcesLoaded && !windowCaptureSourcesLoading) {
      loadCaptureSourcesProgressively('window');
      return;
    }

    if (!windowCaptureSourcesLoading && !hasWindowCaptureThumbnails) {
      scheduleCaptureThumbnailRefresh('window');
    }
  };

  const updateCaptureCropRect = (key: keyof DesktopPetCaptureRectLike, value: string) => {
    setCaptureCropRect((currentRect) => getUpdatedCaptureCropRect(
      currentRect,
      key,
      value,
      captureReferenceWidth,
      captureReferenceHeight,
    ));
  };

  const applyDesktopAreaSelection = (selection: DesktopPetAreaSelectionLike) => {
    setDesktopAreaSelection(selection);
    setSelectedCaptureSourceId(selection.sourceId);
    setCaptureCropRect(selection.cropRect);
  };

  const pickDesktopCaptureArea = async () => {
    const nextSelection = await desktopPetShellRuntime.pickDesktopCaptureArea();
    if (!nextSelection) {
      return null;
    }

    applyDesktopAreaSelection(nextSelection);
    return nextSelection;
  };

  const startConfiguredScreenCapture = async () => {
    const source = selectedCaptureSource;
    let nextAreaSelection = desktopAreaSelection;

    if (captureMode === 'area' && !nextAreaSelection) {
      nextAreaSelection = await pickDesktopCaptureArea();
      if (!nextAreaSelection) {
        return;
      }
    }

    await onStartScreenCapture({
      mode: captureMode,
      sourceId: captureMode === 'area' ? nextAreaSelection?.sourceId : source?.id,
      sourceName: captureMode === 'area' ? nextAreaSelection?.sourceName : source?.name,
      sourceType: captureMode === 'area' ? nextAreaSelection?.sourceType : source?.type,
      cropRect: captureMode === 'area' ? captureCropRect : null,
      cropBasisX: captureMode === 'area' ? nextAreaSelection?.cropBasisX : undefined,
      cropBasisY: captureMode === 'area' ? nextAreaSelection?.cropBasisY : undefined,
      cropBasisWidth: captureMode === 'area'
        ? nextAreaSelection?.cropBasisWidth ?? captureReferenceWidth
        : undefined,
      cropBasisHeight: captureMode === 'area'
        ? nextAreaSelection?.cropBasisHeight ?? captureReferenceHeight
        : undefined,
      areaSources: captureMode === 'area'
        ? nextAreaSelection?.areaSources
        : undefined,
    });
  };

  return {
    activePreviewSourceId,
    activateWindowAreaMode,
    availableDisplays,
    captureCropRect,
    captureMode,
    captureReferenceHeight,
    captureReferenceWidth,
    captureSourcesLoading,
    desktopAreaSelection,
    isDesktopConnected,
    isWindowAreaMode,
    pickDesktopCaptureArea,
    previewCaptureSources,
    refreshCaptureSources,
    selectedCaptureSource,
    setCaptureMode,
    setSelectedCaptureSourceId,
    startConfiguredScreenCapture,
    updateCaptureCropRect,
  };
}
