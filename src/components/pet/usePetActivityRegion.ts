import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  MAX_ACTIVITY_AREA_HEIGHT,
  MAX_ACTIVITY_AREA_WIDTH,
  clampActivityAreaScale,
  deriveActivityAreaScaleFromSize,
  resolveActivityAreaSize,
} from '../../activityArea';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetConfig } from '../../types';
import {
  type Area,
  type DirectionalExtents,
  type Position,
  clampActivityRegionOffsetWithinArea,
  clampSceneEntityToActivityArea,
  createActivityBaseCenter,
  createDragBoundsViewport,
  getDisplayPixelSize,
  getDisplayScaleFactor,
  getSelectedActivityDisplay,
  resolvePetCollisionRadius,
  resolveActivityViewport,
  resolveStoredActivityRegionOffset,
  resolveViewportActivitySettings,
} from './petActivityRegionMath';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type ActivityRegionDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originOffsetX: number;
  originOffsetY: number;
} | null;

type ActivityRegionResizeState = {
  direction: ResizeDirection;
  originPetPosition: Position;
  pointerId: number;
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
  originOffsetX: number;
  originOffsetY: number;
} | null;

interface UsePetActivityRegionOptions {
  addLog: (message: string) => void;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  folderHalfHeight: number;
  folderHalfWidth: number;
  folderBoundaryExtents: DirectionalExtents;
  onActivityRegionNativeShapePreview?: (preview: {
    activityArea?: Area;
    activityCenter: Position;
    previousPrimaryPosition?: Position;
    previousActivityCenter: Position;
    primaryPosition?: Position;
  }) => void;
  onUpdateConfig: (config: PetConfig) => void;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  sceneRef: RefObject<HTMLDivElement | null>;
  setPetPos: Dispatch<SetStateAction<Position>>;
}

export function usePetActivityRegion({
  addLog,
  config,
  configRef,
  folderHalfHeight,
  folderHalfWidth,
  folderBoundaryExtents,
  onActivityRegionNativeShapePreview,
  onUpdateConfig,
  pendingPetConfigSyncRef,
  petPosRef,
  petVisualBounds,
  pointerInteractionLockRef,
  sceneRef,
  setPetPos,
}: UsePetActivityRegionOptions) {
  const [sceneSize, setSceneSize] = useState<Area>({ width: 0, height: 0 });
  const [availableDisplays, setAvailableDisplays] = useState<DesktopPetDisplayLike[]>([]);
  const [activityRegionDragState, setActivityRegionDragState] = useState<ActivityRegionDragState>(null);
  const [activityRegionResizeState, setActivityRegionResizeState] = useState<ActivityRegionResizeState>(null);
  const [activityRegionOffsetPreview, setActivityRegionOffsetPreview] = useState<Position>({ x: 0, y: 0 });
  const activityRegionOffsetPreviewRef = useRef(activityRegionOffsetPreview);
  const [activityRegionAreaPreview, setActivityRegionAreaPreview] = useState<Area>({ width: 0, height: 0 });
  const activityRegionAreaPreviewRef = useRef(activityRegionAreaPreview);
  const previousDisplaySignatureRef = useRef<string | null>(null);
  const previousActivityCenterRef = useRef<Position | null>(null);
  const previousActivityViewportRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const applyAvailableDisplays = useCallback((nextDisplays: DesktopPetDisplayLike[] | null | undefined) => {
    if (!Array.isArray(nextDisplays) || nextDisplays.length === 0) {
      return;
    }

    setAvailableDisplays(nextDisplays);
  }, []);

  useEffect(() => {
    activityRegionOffsetPreviewRef.current = activityRegionOffsetPreview;
  }, [activityRegionOffsetPreview]);

  useEffect(() => {
    activityRegionAreaPreviewRef.current = activityRegionAreaPreview;
  }, [activityRegionAreaPreview]);

  useEffect(() => {
    const sceneElement = sceneRef.current;
    if (!sceneElement) {
      return;
    }

    const updateSceneSize = () => {
      const rect = sceneElement.getBoundingClientRect();
      setSceneSize({ width: rect.width, height: rect.height });
    };

    updateSceneSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSceneSize);
      return () => {
        window.removeEventListener('resize', updateSceneSize);
      };
    }

    const observer = new ResizeObserver(() => {
      updateSceneSize();
    });
    observer.observe(sceneElement);
    window.addEventListener('resize', updateSceneSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSceneSize);
    };
  }, [sceneRef]);

  useEffect(() => {
    if (!desktopPetShellRuntime.isDesktopMode()) {
      setAvailableDisplays([]);
      return;
    }

    let isMounted = true;
    const loadDisplays = () => {
      desktopPetShellRuntime.listDisplays()
        .then((displays) => {
          if (isMounted) {
            pushFrontendRuntimeLog('drag-diagnose', 'activity region loaded displays', {
              count: Array.isArray(displays) ? displays.length : 0,
            });
            applyAvailableDisplays(displays);
          }
        })
        .catch(() => {});
    };

    loadDisplays();
    const unsubscribe = desktopPetShellRuntime.onDisplayEnvironmentChange((environment) => {
      if (!isMounted) {
        return;
      }

      pushFrontendRuntimeLog('drag-diagnose', 'activity region display environment change', {
        displayCount: Array.isArray(environment?.displays) ? environment.displays.length : 0,
      });
      applyAvailableDisplays(Array.isArray(environment?.displays) ? environment.displays : null);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [applyAvailableDisplays, config.settings.activityDisplayId]);

  const selectedDisplay = useMemo(() => (
    getSelectedActivityDisplay(availableDisplays, config.settings.activityDisplayId)
  ), [availableDisplays, config.settings.activityDisplayId]);
  const selectedDisplayScaleFactor = useMemo(() => getDisplayScaleFactor(selectedDisplay), [selectedDisplay]);
  const selectedDisplayPixels = useMemo(() => getDisplayPixelSize(selectedDisplay), [selectedDisplay]);
  const selectedDisplayPixelWidth = selectedDisplayPixels.width;
  const selectedDisplayPixelHeight = selectedDisplayPixels.height;
  const activityViewport = useMemo(() => (
    resolveActivityViewport(selectedDisplay, sceneSize, availableDisplays)
  ), [availableDisplays, sceneSize, selectedDisplay]);
  const dragBoundsViewport = useMemo(() => (
    createDragBoundsViewport(activityViewport, sceneSize)
  ), [activityViewport, sceneSize]);
  const activityBaseCenter = useMemo(() => createActivityBaseCenter(activityViewport), [activityViewport]);
  const getViewportActivitySettings = (settings: PetConfig['settings'] = config.settings) => resolveViewportActivitySettings(
    settings,
    selectedDisplayScaleFactor,
  );
  const resolveActivityAreaForSettings = (settings: PetConfig['settings'] = config.settings) => {
    if (!settings.activityAreaLimitEnabled) {
      return {
        width: Math.max(1, Math.round(dragBoundsViewport.width || sceneSize.width || activityViewport.width || 1)),
        height: Math.max(1, Math.round(dragBoundsViewport.height || sceneSize.height || activityViewport.height || 1)),
      };
    }

    return resolveActivityAreaSize(
      activityViewport.width,
      activityViewport.height,
      getViewportActivitySettings(settings),
    );
  };
  const clampActivityRegionOffset = (
    nextOffset: Position,
    settings: PetConfig['settings'] = config.settings,
  ) => clampActivityRegionOffsetWithinArea(
    nextOffset,
    resolveActivityAreaForSettings(settings),
    activityBaseCenter,
    dragBoundsViewport,
  );
  const resolvedActivityArea = useMemo(() => (
    resolveActivityAreaForSettings(config.settings)
  ), [config.settings, resolveActivityAreaForSettings]);
  const activityArea = useMemo(() => (
    activityRegionAreaPreview.width > 0 && activityRegionAreaPreview.height > 0
      ? activityRegionAreaPreview
      : resolvedActivityArea
  ), [
    activityRegionAreaPreview.height,
    activityRegionAreaPreview.width,
    resolvedActivityArea.height,
    resolvedActivityArea.width,
  ]);
  const activityRegionOffset = useMemo(() => (
    clampActivityRegionOffsetWithinArea(
      activityRegionOffsetPreview,
      activityArea,
      activityBaseCenter,
      dragBoundsViewport,
    )
  ), [activityArea, activityBaseCenter, activityRegionOffsetPreview, dragBoundsViewport]);
  const activityCenter = useMemo(() => ({
    x: activityBaseCenter.x + activityRegionOffset.x,
    y: activityBaseCenter.y + activityRegionOffset.y,
  }), [activityBaseCenter.x, activityBaseCenter.y, activityRegionOffset.x, activityRegionOffset.y]);
  useEffect(() => {
    const displaySignature = selectedDisplay
      ? `${selectedDisplay.id}|${selectedDisplay.x}|${selectedDisplay.y}|${selectedDisplay.width}|${selectedDisplay.height}`
      : 'none';
    const previousDisplaySignature = previousDisplaySignatureRef.current;
    const previousActivityCenter = previousActivityCenterRef.current;
    const previousActivityViewport = previousActivityViewportRef.current;
    const centerDelta = previousActivityCenter
      ? Math.hypot(activityCenter.x - previousActivityCenter.x, activityCenter.y - previousActivityCenter.y)
      : 0;
    const viewportChanged = !previousActivityViewport
      || previousActivityViewport.x !== activityViewport.x
      || previousActivityViewport.y !== activityViewport.y
      || previousActivityViewport.width !== activityViewport.width
      || previousActivityViewport.height !== activityViewport.height;

    if (
      previousDisplaySignature !== null
      && (
        previousDisplaySignature !== displaySignature
        || viewportChanged
        || centerDelta >= 160
      )
    ) {
      pushFrontendRuntimeLog('drag-diagnose', 'activity region geometry changed', {
        activityCenter,
        activityViewport,
        centerDelta,
        displaySignature,
        previousActivityCenter,
        previousActivityViewport,
        previousDisplaySignature,
      });
    }

    previousDisplaySignatureRef.current = displaySignature;
    previousActivityCenterRef.current = activityCenter;
    previousActivityViewportRef.current = activityViewport;
  }, [activityCenter, activityViewport, selectedDisplay]);
  const activityAreaScale = useMemo(() => (
    selectedDisplayPixelWidth > 0 && selectedDisplayPixelHeight > 0
      ? deriveActivityAreaScaleFromSize(
        Math.max(1, Math.round(activityArea.width * selectedDisplayScaleFactor)),
        Math.max(1, Math.round(activityArea.height * selectedDisplayScaleFactor)),
        selectedDisplayPixelWidth,
        selectedDisplayPixelHeight,
      )
      : clampActivityAreaScale(config.settings.activityAreaScale)
  ), [
    activityArea.height,
    activityArea.width,
    config.settings.activityAreaScale,
    selectedDisplayPixelHeight,
    selectedDisplayPixelWidth,
    selectedDisplayScaleFactor,
  ]);

  const clampPositionWithinArea = (
    position: Position,
    area: Area,
    type: 'pet' | 'folder',
    petScale = config.scale,
  ) => clampSceneEntityToActivityArea(position, area, type, {
    folderHalfHeight,
    folderHalfWidth,
    folderBoundaryExtents,
    petScale,
    petVisualBounds,
  });

  const updateActivityRegionOffset = (offset: Position) => {
    const currentConfig = configRef.current;
    const clampedOffset = clampActivityRegionOffset(offset, currentConfig.settings);
    const nextConfig = {
      ...currentConfig,
      settings: {
        ...currentConfig.settings,
        activityOffsetX: clampedOffset.x,
        activityOffsetY: clampedOffset.y,
      },
    };
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig);
  };

  const updateActivityRegionBounds = (
    area: Area,
    offset: Position,
    petPositionOverride?: Position,
  ) => {
    const currentConfig = configRef.current;
    const maxViewportWidth = Math.max(1, Math.round(MAX_ACTIVITY_AREA_WIDTH / selectedDisplayScaleFactor));
    const maxViewportHeight = Math.max(1, Math.round(MAX_ACTIVITY_AREA_HEIGHT / selectedDisplayScaleFactor));
    const normalizedArea = {
      width: Math.max(1, Math.min(maxViewportWidth, Math.round(area.width))),
      height: Math.max(1, Math.min(maxViewportHeight, Math.round(area.height))),
    };
    const clampedOffset = clampActivityRegionOffsetWithinArea(
      offset,
      normalizedArea,
      activityBaseCenter,
      dragBoundsViewport,
    );
    const storedWidth = Math.max(1, Math.min(MAX_ACTIVITY_AREA_WIDTH, Math.round(normalizedArea.width * selectedDisplayScaleFactor)));
    const storedHeight = Math.max(1, Math.min(MAX_ACTIVITY_AREA_HEIGHT, Math.round(normalizedArea.height * selectedDisplayScaleFactor)));
    const clampedPetPosition = clampPositionWithinArea(
      petPositionOverride ?? currentConfig.position,
      normalizedArea,
      'pet',
      currentConfig.scale,
    );
    const clampedFolders = currentConfig.folders.map((folder) => ({
      ...folder,
      position: clampPositionWithinArea(
        folder.position,
        normalizedArea,
        'folder',
      ),
    }));
    const nextConfig = {
      ...currentConfig,
      position: clampedPetPosition,
      folders: clampedFolders,
      settings: {
        ...currentConfig.settings,
        activityAreaManual: true,
        activityAreaWidth: storedWidth,
        activityAreaHeight: storedHeight,
        activityAreaScale: selectedDisplayPixelWidth > 0 && selectedDisplayPixelHeight > 0
          ? deriveActivityAreaScaleFromSize(
            storedWidth,
            storedHeight,
            selectedDisplayPixelWidth,
            selectedDisplayPixelHeight,
          )
          : currentConfig.settings.activityAreaScale,
        activityOffsetX: clampedOffset.x,
        activityOffsetY: clampedOffset.y,
      },
    };

    pendingPetConfigSyncRef.current = true;
    configRef.current = nextConfig;
    petPosRef.current = clampedPetPosition;
    setPetPos(clampedPetPosition);
    onUpdateConfig(nextConfig);
  };

  useEffect(() => {
    if (activityRegionDragState || activityRegionResizeState) {
      return;
    }

    const nextOffset = clampActivityRegionOffset(resolveStoredActivityRegionOffset(config.settings), config.settings);
    activityRegionOffsetPreviewRef.current = nextOffset;
    setActivityRegionOffsetPreview(nextOffset);
  }, [
    activityRegionDragState,
    activityRegionResizeState,
    activityViewport.height,
    activityViewport.width,
    config.settings,
    config.settings.activityAreaHeight,
    config.settings.activityAreaManual,
    config.settings.activityAreaScale,
    config.settings.activityAreaWidth,
    config.settings.activityDisplayId,
    config.settings.activityOffsetX,
    config.settings.activityOffsetY,
    dragBoundsViewport.height,
    dragBoundsViewport.width,
  ]);

  useEffect(() => {
    if (activityRegionDragState || activityRegionResizeState) {
      return;
    }

    activityRegionAreaPreviewRef.current = resolvedActivityArea;
    setActivityRegionAreaPreview(resolvedActivityArea);
  }, [
    activityRegionDragState,
    activityRegionResizeState,
    resolvedActivityArea.height,
    resolvedActivityArea.width,
  ]);

  useEffect(() => {
    if (!activityRegionDragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activityRegionDragState.pointerId) {
        return;
      }

      const nextOffset = clampActivityRegionOffset({
        x: activityRegionDragState.originOffsetX + event.clientX - activityRegionDragState.startX,
        y: activityRegionDragState.originOffsetY + event.clientY - activityRegionDragState.startY,
      }, configRef.current.settings);
      const previousCenter = {
        x: activityBaseCenter.x + activityRegionOffsetPreviewRef.current.x,
        y: activityBaseCenter.y + activityRegionOffsetPreviewRef.current.y,
      };
      const nextCenter = {
        x: activityBaseCenter.x + nextOffset.x,
        y: activityBaseCenter.y + nextOffset.y,
      };

      onActivityRegionNativeShapePreview?.({
        activityCenter: nextCenter,
        previousActivityCenter: previousCenter,
      });

      activityRegionOffsetPreviewRef.current = nextOffset;
      setActivityRegionOffsetPreview(nextOffset);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activityRegionDragState.pointerId) {
        return;
      }

      pointerInteractionLockRef.current = false;
      const finalOffset = clampActivityRegionOffset(activityRegionOffsetPreviewRef.current, configRef.current.settings);
      setActivityRegionDragState(null);
      setActivityRegionOffsetPreview(finalOffset);

      if (
        finalOffset.x !== activityRegionDragState.originOffsetX
        || finalOffset.y !== activityRegionDragState.originOffsetY
      ) {
        updateActivityRegionOffset(finalOffset);
        addLog('已调整桌宠活动区域位置');
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [activityBaseCenter.x, activityBaseCenter.y, activityRegionDragState, addLog, onActivityRegionNativeShapePreview]);

  useEffect(() => {
    if (!activityRegionResizeState) {
      return;
    }

    const maxViewportWidth = Math.max(1, Math.round(MAX_ACTIVITY_AREA_WIDTH / selectedDisplayScaleFactor));
    const maxViewportHeight = Math.max(1, Math.round(MAX_ACTIVITY_AREA_HEIGHT / selectedDisplayScaleFactor));

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activityRegionResizeState.pointerId) {
        return;
      }

      const deltaX = event.clientX - activityRegionResizeState.startX;
      const deltaY = event.clientY - activityRegionResizeState.startY;
      const resizeFromLeft = activityRegionResizeState.direction.includes('w');
      const resizeFromRight = activityRegionResizeState.direction.includes('e');
      const resizeFromTop = activityRegionResizeState.direction.includes('n');
      const resizeFromBottom = activityRegionResizeState.direction.includes('s');
      const nextWidth = Math.max(
        1,
        Math.min(
          maxViewportWidth,
          activityRegionResizeState.originWidth
            + (resizeFromRight ? deltaX : 0)
            - (resizeFromLeft ? deltaX : 0),
        ),
      );
      const nextHeight = Math.max(
        1,
        Math.min(
          maxViewportHeight,
          activityRegionResizeState.originHeight
            + (resizeFromBottom ? deltaY : 0)
            - (resizeFromTop ? deltaY : 0),
        ),
      );
      const nextArea = {
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      };
      const nextOffset = clampActivityRegionOffsetWithinArea(
        {
          x: activityRegionResizeState.originOffsetX
            + (resizeFromLeft ? (activityRegionResizeState.originWidth - nextArea.width) / 2 : 0)
            + (resizeFromRight ? (nextArea.width - activityRegionResizeState.originWidth) / 2 : 0),
          y: activityRegionResizeState.originOffsetY
            + (resizeFromTop ? (activityRegionResizeState.originHeight - nextArea.height) / 2 : 0)
            + (resizeFromBottom ? (nextArea.height - activityRegionResizeState.originHeight) / 2 : 0),
        },
        nextArea,
        activityBaseCenter,
        dragBoundsViewport,
      );
      const previewPetPosition = clampPositionWithinArea(
        activityRegionResizeState.originPetPosition,
        nextArea,
        'pet',
        configRef.current.scale,
      );
      const previousCenter = {
        x: activityBaseCenter.x + activityRegionOffsetPreviewRef.current.x,
        y: activityBaseCenter.y + activityRegionOffsetPreviewRef.current.y,
      };
      const nextCenter = {
        x: activityBaseCenter.x + nextOffset.x,
        y: activityBaseCenter.y + nextOffset.y,
      };

      onActivityRegionNativeShapePreview?.({
        activityArea: nextArea,
        activityCenter: nextCenter,
        previousActivityCenter: previousCenter,
        previousPrimaryPosition: petPosRef.current,
        primaryPosition: previewPetPosition,
      });

      activityRegionAreaPreviewRef.current = nextArea;
      activityRegionOffsetPreviewRef.current = nextOffset;
      setActivityRegionAreaPreview(nextArea);
      setActivityRegionOffsetPreview(nextOffset);
      petPosRef.current = previewPetPosition;
      setPetPos((currentPosition) => (
        currentPosition.x === previewPetPosition.x
        && currentPosition.y === previewPetPosition.y
          ? currentPosition
          : previewPetPosition
      ));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activityRegionResizeState.pointerId) {
        return;
      }

      pointerInteractionLockRef.current = false;
      const finalArea = activityRegionAreaPreviewRef.current.width > 0 && activityRegionAreaPreviewRef.current.height > 0
        ? activityRegionAreaPreviewRef.current
        : {
          width: activityRegionResizeState.originWidth,
          height: activityRegionResizeState.originHeight,
        };
      const finalOffset = clampActivityRegionOffsetWithinArea(
        activityRegionOffsetPreviewRef.current,
        finalArea,
        activityBaseCenter,
        dragBoundsViewport,
      );
      const finalPetPosition = clampPositionWithinArea(
        activityRegionResizeState.originPetPosition,
        finalArea,
        'pet',
        configRef.current.scale,
      );
      setActivityRegionResizeState(null);
      setActivityRegionAreaPreview(finalArea);
      setActivityRegionOffsetPreview(finalOffset);
      petPosRef.current = finalPetPosition;
      setPetPos(finalPetPosition);

      if (
        finalArea.width !== Math.round(activityRegionResizeState.originWidth)
        || finalArea.height !== Math.round(activityRegionResizeState.originHeight)
        || finalOffset.x !== activityRegionResizeState.originOffsetX
        || finalOffset.y !== activityRegionResizeState.originOffsetY
      ) {
        updateActivityRegionBounds(finalArea, finalOffset, finalPetPosition);
        addLog('已调整桌宠活动区域大小');
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    activityBaseCenter,
    activityRegionResizeState,
    activityViewport.height,
    activityViewport.width,
    addLog,
    dragBoundsViewport,
    onActivityRegionNativeShapePreview,
    selectedDisplayScaleFactor,
  ]);

  const startActivityRegionDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerInteractionLockRef.current = true;
    setActivityRegionDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originOffsetX: activityRegionOffset.x,
      originOffsetY: activityRegionOffset.y,
    });
  }, [activityRegionOffset.x, activityRegionOffset.y, pointerInteractionLockRef]);

  const startActivityRegionResize = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    direction: ResizeDirection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerInteractionLockRef.current = true;

    const nextArea = activityArea.width > 0 && activityArea.height > 0
      ? activityArea
      : resolvedActivityArea;
    activityRegionAreaPreviewRef.current = nextArea;
    setActivityRegionAreaPreview(nextArea);
    setActivityRegionResizeState({
      direction,
      originPetPosition: petPosRef.current,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: nextArea.width,
      originHeight: nextArea.height,
      originOffsetX: activityRegionOffset.x,
      originOffsetY: activityRegionOffset.y,
    });
  }, [
    activityArea,
    activityRegionOffset.x,
    activityRegionOffset.y,
    petPosRef,
    pointerInteractionLockRef,
    resolvedActivityArea,
  ]);

  return {
    activityArea,
    activityAreaScale,
    activityCenter,
    activityRegionDragState,
    activityRegionResizeState,
    activityViewport,
    availableDisplays,
    sceneSize,
    selectedDisplayScaleFactor,
    startActivityRegionDrag,
    startActivityRegionResize,
  };
}
