import { useEffect, useLayoutEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { NATIVE_PET_SHAPE_STARTUP_SUPPRESSION_MS } from './petContainerShell/petShellPointerPolicy';
import { startPetShellPointerSession } from './petContainerShell/petShellPointerSession';

export {
  isForceFullShapeOnDragEnabled,
  mapScreenPointToClientPoint,
  resolveNativeInteractiveRegionSyncDelayMs,
  shouldKeepPointerInteractive,
  shouldSuspendNativePetShape,
  shouldUseFullWindowNativeShape,
  shouldUseHoveredInteractiveElement,
  shouldUseImmediateNativeInteractiveRegionSync,
} from './petContainerShell/petShellPointerPolicy';
export {
  isClientPointInsideActivityRegionHandle,
  isClientPointInsideElementRect,
  resolveNativeElementScope,
  resolveNativeInteractiveRegionFromRect,
  resolveNativeInteractiveRegionPadding,
  shouldCollectNativeInteractiveElement,
} from './petContainerShell/petShellNativeElements';

interface UsePetContainerShellEffectsOptions {
  activityRegionDragState: unknown;
  activityRegionResizeState: unknown;
  chatPanelDragState: unknown;
  chatPanelResizeState: unknown;
  companionDragState?: unknown;
  dragState: unknown;
  isChatOpen: boolean;
  isExternalChatOpen: boolean;
  isSettingsOpen: boolean;
  isPetMotionActive?: boolean;
  nativeInteractiveRegionBaseRegionsRef?: MutableRefObject<DesktopPetInteractiveRegionLike[]>;
  nativeInteractiveRegionPostRenderSyncKey?: string;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  setIsChatOpen: Dispatch<SetStateAction<boolean>>;
  useFullWindowNativeShapeForPetDrag?: boolean;
  useNativeInteractiveRegions?: boolean;
  useExternalChatWindow: boolean;
  useExternalSettingsWindow: boolean;
}

export function usePetContainerShellEffects({
  activityRegionDragState,
  activityRegionResizeState,
  chatPanelDragState,
  chatPanelResizeState,
  companionDragState = null,
  dragState,
  isChatOpen,
  isExternalChatOpen,
  isSettingsOpen,
  isPetMotionActive = false,
  nativeInteractiveRegionBaseRegionsRef,
  nativeInteractiveRegionPostRenderSyncKey,
  pointerInteractionLockRef,
  setIsChatOpen,
  useFullWindowNativeShapeForPetDrag = false,
  useNativeInteractiveRegions = false,
  useExternalChatWindow,
  useExternalSettingsWindow,
}: UsePetContainerShellEffectsOptions) {
  const nativePetShapeStartupSuppressionUntilRef = useRef<number | null>(null);
  const nativeInteractiveRegionPostRenderSyncRef = useRef<(() => void) | null>(null);
  const latestNativeShapeRuntimeStateRef = useRef({
    companionDragState,
    dragState,
    isPetMotionActive,
    useFullWindowNativeShapeForPetDrag,
  });
  latestNativeShapeRuntimeStateRef.current = {
    companionDragState,
    dragState,
    isPetMotionActive,
    useFullWindowNativeShapeForPetDrag,
  };

  if (nativePetShapeStartupSuppressionUntilRef.current === null && typeof window !== 'undefined') {
    nativePetShapeStartupSuppressionUntilRef.current = (
      window.performance?.now?.() ?? Date.now()
    ) + NATIVE_PET_SHAPE_STARTUP_SUPPRESSION_MS;
  }

  useEffect(() => {
    if (!desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    desktopPetShellRuntime.setSettingsOpen(
      (useExternalSettingsWindow ? false : isSettingsOpen) || (useExternalChatWindow ? false : isChatOpen),
    );
  }, [isChatOpen, isSettingsOpen, useExternalChatWindow, useExternalSettingsWindow]);

  useEffect(() => {
    if (useExternalChatWindow) {
      setIsChatOpen(isExternalChatOpen);
    }
  }, [isExternalChatOpen, setIsChatOpen, useExternalChatWindow]);

  useEffect(() => (
    () => {
      desktopPetShellRuntime.setSettingsOpen(false);
    }
  ), []);

  useEffect(() => {
    if (!desktopPetShellRuntime.isDesktopMode()) {
      return;
    }

    return startPetShellPointerSession({
      activityRegionDragState,
      activityRegionResizeState,
      chatPanelDragState,
      chatPanelResizeState,
      isChatOpen,
      isSettingsOpen,
      latestNativeShapeRuntimeStateRef,
      nativeInteractiveRegionBaseRegionsRef,
      nativeInteractiveRegionPostRenderSyncRef,
      nativePetShapeStartupSuppressionUntilRef,
      pointerInteractionLockRef,
      useExternalChatWindow,
      useExternalSettingsWindow,
      useNativeInteractiveRegions,
    });
  }, [
    activityRegionDragState,
    activityRegionResizeState,
    chatPanelDragState,
    chatPanelResizeState,
    isChatOpen,
    isSettingsOpen,
    nativeInteractiveRegionBaseRegionsRef,
    pointerInteractionLockRef,
    useNativeInteractiveRegions,
    useExternalChatWindow,
    useExternalSettingsWindow,
  ]);

  useLayoutEffect(() => {
    if (!useNativeInteractiveRegions || !nativeInteractiveRegionPostRenderSyncKey) {
      return;
    }

    nativeInteractiveRegionPostRenderSyncRef.current?.();
  }, [nativeInteractiveRegionPostRenderSyncKey, useNativeInteractiveRegions]);

  useEffect(() => (
    () => {
      pointerInteractionLockRef.current = false;
      desktopPetShellRuntime.setPointerPassthrough(true);
    }
  ), [pointerInteractionLockRef]);

  useEffect(() => (
    () => {
      desktopPetShellRuntime.setInteractiveRegions([]);
    }
  ), []);
}
