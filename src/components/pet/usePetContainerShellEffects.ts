import { useEffect, useLayoutEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { isLive2DDragReleaseProbeEnabled } from './live2dDragProbeFlag';

const POINTER_PASSTHROUGH_HOVER_POLL_INTERVAL_MS = 80;
const POINTER_PASSTHROUGH_RELEASE_DELAY_MS = 120;
const NATIVE_INTERACTIVE_REGION_PADDING_PX = 6;
const ACTIVITY_REGION_HANDLE_NATIVE_PADDING_PX = NATIVE_INTERACTIVE_REGION_PADDING_PX / 4;
const NATIVE_WINDOW_SHAPE_REGION_PADDING_PX = 48;
const NATIVE_INTERACTIVE_REGION_SYNC_MIN_DELAY_MS = 120;
const NATIVE_INTERACTIVE_REGION_IDLE_RESYNC_MS = 1000;
const NATIVE_PET_SHAPE_STARTUP_SUPPRESSION_MS = 150_000;
const LIVE2D_NATIVE_REGION_PROBE_LIMIT = 260;
const USE_NATIVE_ORDINARY_PET_SHAPE = false;
const NATIVE_WINDOW_SHAPE_SELECTOR = '[data-desktop-pet-interactive="true"], [data-desktop-pet-window-shape="true"]';
const NATIVE_WINDOW_SHAPE_PADDING_ATTRIBUTE = 'data-desktop-pet-window-shape-padding';
const PET_NATIVE_SCOPE = 'pet';

interface PointerInteractivityState {
  hasActiveInteraction: boolean;
  hasEmbeddedPanelOpen: boolean;
  hasHoveredInteractiveElement: boolean;
  hasPointerLock: boolean;
}

interface HoverActivationState {
  hasHoveredInteractiveElement: boolean;
  hasHoveredPetHitArea: boolean;
  suppressPetHitAreaHoverActivation: boolean;
}

interface FullWindowNativeShapeState {
  forceFullWindowOnPetDrag?: boolean;
  hasActivityRegionInteraction: boolean;
  hasCompanionPetDragInteraction?: boolean;
  hasEmbeddedPanelOpen: boolean;
  hasPanelInteraction: boolean;
  hasPetDragInteraction: boolean;
  hasPointerLock: boolean;
}

interface NativePetShapeSuspensionState {
  hasFullWindowNativeShape: boolean;
  hasCompanionPetDragInteraction?: boolean;
  hasPetDragInteraction: boolean;
  hasPointerActivatedNativePetShape?: boolean;
  isStartupSuppressionActive: boolean;
  isPetMotionActive: boolean;
  useNativeOrdinaryPetShape?: boolean;
}

interface NativeInteractiveRegionSyncState {
  hasActivityRegionInteraction?: boolean;
  hasCompanionPetDragInteraction?: boolean;
  hasPetDragInteraction: boolean;
  isPetMotionActive: boolean;
}

interface NativeInteractiveRegionSyncDelayState extends NativeInteractiveRegionSyncState {
  timeSinceLastSyncMs: number;
}

export function shouldKeepPointerInteractive({
  hasActiveInteraction,
  hasEmbeddedPanelOpen,
  hasHoveredInteractiveElement,
  hasPointerLock,
}: PointerInteractivityState) {
  return hasEmbeddedPanelOpen
    || hasPointerLock
    || hasActiveInteraction
    || hasHoveredInteractiveElement;
}

export function shouldUseHoveredInteractiveElement({
  hasHoveredInteractiveElement,
  hasHoveredPetHitArea,
  suppressPetHitAreaHoverActivation,
}: HoverActivationState) {
  return hasHoveredInteractiveElement
    && !(hasHoveredPetHitArea && suppressPetHitAreaHoverActivation);
}

export function shouldUseFullWindowNativeShape({
  forceFullWindowOnPetDrag = false,
  hasCompanionPetDragInteraction = false,
  hasEmbeddedPanelOpen,
  hasPanelInteraction,
  hasPetDragInteraction,
}: FullWindowNativeShapeState) {
  return hasEmbeddedPanelOpen
    || hasPanelInteraction
    || (forceFullWindowOnPetDrag && (hasPetDragInteraction || hasCompanionPetDragInteraction));
}

export function shouldSuspendNativePetShape({
  hasCompanionPetDragInteraction = false,
  hasFullWindowNativeShape,
  hasPetDragInteraction,
  hasPointerActivatedNativePetShape = false,
  isStartupSuppressionActive,
  isPetMotionActive,
  useNativeOrdinaryPetShape = USE_NATIVE_ORDINARY_PET_SHAPE,
}: NativePetShapeSuspensionState) {
  // Before making the transparent window interactive, constrain it to the pet.
  // Otherwise Windows can treat the whole topmost overlay as covering browser video.
  const shouldProtectPointerActivatedShape = hasPointerActivatedNativePetShape
    && !isPetMotionActive
    && !hasPetDragInteraction
    && !hasCompanionPetDragInteraction;

  return !hasFullWindowNativeShape
    && (
      (!useNativeOrdinaryPetShape && !shouldProtectPointerActivatedShape)
      || (isStartupSuppressionActive && !shouldProtectPointerActivatedShape)
      || isPetMotionActive
      || hasPetDragInteraction
      || hasCompanionPetDragInteraction
    );
}

export function shouldUseImmediateNativeInteractiveRegionSync({
  hasActivityRegionInteraction = false,
  hasCompanionPetDragInteraction = false,
  hasPetDragInteraction,
  isPetMotionActive,
}: NativeInteractiveRegionSyncState) {
  return isPetMotionActive
    || hasPetDragInteraction
    || hasCompanionPetDragInteraction
    || hasActivityRegionInteraction;
}

export function resolveNativeInteractiveRegionSyncDelayMs({
  hasActivityRegionInteraction = false,
  hasCompanionPetDragInteraction = false,
  hasPetDragInteraction,
  isPetMotionActive,
  timeSinceLastSyncMs,
}: NativeInteractiveRegionSyncDelayState) {
  if (shouldUseImmediateNativeInteractiveRegionSync({
    hasActivityRegionInteraction,
    hasCompanionPetDragInteraction,
    hasPetDragInteraction,
    isPetMotionActive,
  })) {
    return 0;
  }

  return Math.max(
    0,
    NATIVE_INTERACTIVE_REGION_SYNC_MIN_DELAY_MS - Math.max(0, timeSinceLastSyncMs),
  );
}

export function mapScreenPointToClientPoint(
  screenPoint: { x: number; y: number } | null | undefined,
  windowOffset: { x: number; y: number },
) {
  if (
    !screenPoint
    || !Number.isFinite(screenPoint.x)
    || !Number.isFinite(screenPoint.y)
    || !Number.isFinite(windowOffset.x)
    || !Number.isFinite(windowOffset.y)
  ) {
    return null;
  }

  return {
    x: Math.round(screenPoint.x - windowOffset.x),
    y: Math.round(screenPoint.y - windowOffset.y),
  };
}

export function isClientPointInsideElementRect(
  point: { x: number; y: number },
  element: Element,
) {
  const rect = element.getBoundingClientRect();

  return rect.width > 0
    && rect.height > 0
    && point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom;
}

export function isClientPointInsideActivityRegionHandle(point: { x: number; y: number }) {
  return Array.from(document.querySelectorAll('[data-desktop-pet-activity-region-handle="true"]'))
    .some((element) => isClientPointInsideElementRect(point, element));
}

export function resolveNativeElementScope(element: Element) {
  const explicitScope = element.getAttribute('data-desktop-pet-native-scope')
    ?? element.closest('[data-desktop-pet-native-scope]')?.getAttribute('data-desktop-pet-native-scope');
  if (explicitScope) {
    return explicitScope;
  }

  if (element.closest('[data-desktop-pet-id]')) {
    return PET_NATIVE_SCOPE;
  }

  return 'other';
}

export function shouldCollectNativeInteractiveElement(
  element: Element,
  isPetNativeShapeSuspended: boolean,
) {
  void isPetNativeShapeSuspended;
  // BrowserWindow.setShape clips the visible window, not just hit testing.
  // Pet-scoped visible/protection regions must stay in the native shape, while
  // transparent pet hit areas stay out so 3D protection does not block selection.
  const scope = resolveNativeElementScope(element);
  if (!scope) {
    return false;
  }

  if (
    scope === PET_NATIVE_SCOPE
    && element.getAttribute('data-desktop-pet-interactive') === 'true'
    && !element.hasAttribute('data-desktop-pet-window-shape')
  ) {
    return false;
  }

  return true;
}

export function resolveNativeInteractiveRegionFromRect(
  rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  viewport: { height: number; width: number },
  padding = NATIVE_INTERACTIVE_REGION_PADDING_PX,
) {
  const left = Math.max(0, Math.floor(rect.left - padding));
  const top = Math.max(0, Math.floor(rect.top - padding));
  const right = Math.min(Math.max(0, Math.round(viewport.width)), Math.ceil(rect.right + padding));
  const bottom = Math.min(Math.max(0, Math.round(viewport.height)), Math.ceil(rect.bottom + padding));
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    height,
    width,
    x: left,
    y: top,
  } satisfies DesktopPetInteractiveRegionLike;
}

export function resolveNativeInteractiveRegionPadding(element: Element) {
  const explicitPadding = element.getAttribute(NATIVE_WINDOW_SHAPE_PADDING_ATTRIBUTE);
  if (explicitPadding !== null) {
    const parsedPadding = Number(explicitPadding);
    if (Number.isFinite(parsedPadding)) {
      return Math.max(0, Math.min(128, parsedPadding));
    }
  }

  const isActivityRegionHandle = element.getAttribute('data-desktop-pet-activity-region-handle') === 'true';
  if (isActivityRegionHandle) {
    return ACTIVITY_REGION_HANDLE_NATIVE_PADDING_PX;
  }

  return element.hasAttribute('data-desktop-pet-window-shape')
    && !element.hasAttribute('data-desktop-pet-interactive')
    ? NATIVE_WINDOW_SHAPE_REGION_PADDING_PX
    : NATIVE_INTERACTIVE_REGION_PADDING_PX;
}

function isPointerDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('pointerDiagnostics') === '1';
}

export function isForceFullShapeOnDragEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('forceFullShapeOnDrag') === '1';
}

function createNativeInteractiveRegionsSignature(regions: DesktopPetInteractiveRegionLike[]) {
  return regions
    .map((region) => `${region.x},${region.y},${region.width},${region.height}`)
    .join('|');
}

function summarizeNativeInteractiveRegionMutationSource(source: unknown) {
  if (Array.isArray(source)) {
    const records = source.filter((record): record is MutationRecord => record instanceof MutationRecord);
    return {
      attributes: records.slice(0, 8).map((record) => record.attributeName ?? record.type),
      count: records.length,
      target: summarizePointerElement(records[0]?.target instanceof Element ? records[0].target : null),
      type: 'mutation',
    };
  }

  if (source instanceof Event) {
    return {
      type: source.type,
    };
  }

  return {
    type: typeof source === 'string' ? source : 'unknown',
  };
}

function getNativeElementScopePriority(scope: string | null) {
  if (scope === PET_NATIVE_SCOPE) {
    return 0;
  }

  if (scope === 'activity-region') {
    return 1;
  }

  return 2;
}

function summarizePointerElement(element: Element | null) {
  if (!element) {
    return null;
  }

  const className = element.getAttribute('class') ?? '';
  const interactiveElement = element.closest('[data-desktop-pet-interactive="true"]');
  const petElement = element.closest('[data-desktop-pet-id]');

  return {
    className: className ? className.slice(0, 120) : null,
    id: element.id || null,
    interactive: Boolean(interactiveElement),
    interactiveTag: interactiveElement?.tagName.toLowerCase() ?? null,
    petId: petElement?.getAttribute('data-desktop-pet-id') ?? null,
    scope: resolveNativeElementScope(element),
    tag: element.tagName.toLowerCase(),
  };
}

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

    let pointerPassthroughState: boolean | null = null;
    let pointerMoveAnimationFrameId: number | null = null;
    let pointerPassthroughReleaseTimeoutId: number | null = null;
    let hoverPollIntervalId: number | null = null;
    let nativeInteractiveRegionResyncIntervalId: number | null = null;
    let nativeInteractiveRegionSyncAnimationFrameId: number | null = null;
    let nativeInteractiveRegionSyncTimeoutId: number | null = null;
    let nativeInteractiveRegionSyncDirtyWhilePending = false;
    let nativeInteractiveRegionObserver: MutationObserver | null = null;
    let nativeInteractiveRegionLastSyncedAt = 0;
    let latestPointerPosition: { x: number; y: number } | null = null;
    let hasHoveredNativeInteractiveElement = false;
    let hasHoveredNativePetElement = false;
    let hoveredNativeInteractiveScope: string | null = null;
    let suppressPetHitAreaHoverActivation = false;
    let syncNativeInteractiveRegions: (reason?: string) => void = () => {};
    let nativeInteractiveRegionDiagnosticsSignature = '';
    let live2DNativeRegionProbeCount = 0;
    let nativeInteractiveRegionScheduleReason = 'mount';
    let nativeInteractiveRegionScheduleSource: ReturnType<typeof summarizeNativeInteractiveRegionMutationSource> = {
      type: 'mount',
    };
    const pointerDiagnosticsEnabled = isPointerDiagnosticsEnabled();
    const live2DDragProbeEnabled = isLive2DDragReleaseProbeEnabled();

    const pushPointerDiagnosticLog = (message: string, details?: unknown) => {
      if (pointerDiagnosticsEnabled) {
        pushFrontendRuntimeLog('pointer', message, details);
      }
    };

    function clearScheduledPointerPassthroughRelease() {
      if (pointerPassthroughReleaseTimeoutId !== null) {
        window.clearTimeout(pointerPassthroughReleaseTimeoutId);
        pointerPassthroughReleaseTimeoutId = null;
      }
    }

    const applyPointerPassthrough = (ignore: boolean) => {
      if (!ignore) {
        clearScheduledPointerPassthroughRelease();
      }

      if (pointerPassthroughState === ignore) {
        return;
      }

      pointerPassthroughState = ignore;
      pushPointerDiagnosticLog('renderer pointer passthrough request', {
        ignore,
        useNativeInteractiveRegions,
      });
      desktopPetShellRuntime.setPointerPassthrough(ignore);
    };
    const isInteractiveElement = (element: Element | null) =>
      Boolean(element?.closest('[data-desktop-pet-interactive="true"]'));
    const isPetHitAreaElement = (element: Element | null) =>
      Boolean(element?.closest('[data-desktop-pet-id]'));
    const hasPetDragInteraction = () => Boolean(latestNativeShapeRuntimeStateRef.current.dragState);
    const hasCompanionPetDragInteraction = () => (
      Boolean(latestNativeShapeRuntimeStateRef.current.companionDragState)
    );
    const hasCurrentPetMotionActive = () => Boolean(latestNativeShapeRuntimeStateRef.current.isPetMotionActive);
    const hasForceFullWindowOnPetDrag = () => (
      latestNativeShapeRuntimeStateRef.current.useFullWindowNativeShapeForPetDrag
      || isForceFullShapeOnDragEnabled()
    );
    const hasEmbeddedPanelOpen = () => (
      (!useExternalChatWindow && isChatOpen)
      || (!useExternalSettingsWindow && isSettingsOpen)
    );
    const hasActiveInteraction = () => Boolean(
      hasPetDragInteraction()
      || hasCompanionPetDragInteraction()
      || chatPanelDragState
      || chatPanelResizeState
      || activityRegionDragState
      || activityRegionResizeState,
    );
    const hasPanelInteraction = () => Boolean(chatPanelDragState || chatPanelResizeState);
    const hasActivityRegionInteraction = () => Boolean(activityRegionDragState || activityRegionResizeState);
    const hasFullWindowNativeShape = () => shouldUseFullWindowNativeShape({
      forceFullWindowOnPetDrag: hasForceFullWindowOnPetDrag(),
      hasActivityRegionInteraction: hasActivityRegionInteraction(),
      hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
      hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
      hasPanelInteraction: hasPanelInteraction(),
      hasPetDragInteraction: hasPetDragInteraction(),
      hasPointerLock: pointerInteractionLockRef.current,
    });
    const hasStartupSuppressedNativePetShape = () => {
      const suppressionUntil = nativePetShapeStartupSuppressionUntilRef.current;
      if (suppressionUntil === null) {
        return false;
      }

      const now = window.performance?.now?.() ?? Date.now();
      return now < suppressionUntil;
    };
    const hasPointerActivatedNativePetShape = () => (
      hasHoveredNativePetElement
    );
    const hasLiveNativeInteractiveRegionSync = () => shouldUseImmediateNativeInteractiveRegionSync({
      hasActivityRegionInteraction: hasActivityRegionInteraction(),
      hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
      hasPetDragInteraction: hasPetDragInteraction(),
      isPetMotionActive: hasCurrentPetMotionActive(),
    });
    const hasSuspendedNativePetShape = () => shouldSuspendNativePetShape({
      hasFullWindowNativeShape: hasFullWindowNativeShape(),
      hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
      hasPetDragInteraction: hasPetDragInteraction(),
      hasPointerActivatedNativePetShape: hasPointerActivatedNativePetShape(),
      isStartupSuppressionActive: hasStartupSuppressedNativePetShape(),
      isPetMotionActive: hasCurrentPetMotionActive(),
    });
    const setHoveredNativeInteractiveState = (
      nextValue: boolean,
      nextPetValue: boolean,
      nextScope: string | null = null,
    ) => {
      if (
        hasHoveredNativeInteractiveElement === nextValue
        && hasHoveredNativePetElement === nextPetValue
        && hoveredNativeInteractiveScope === nextScope
      ) {
        return;
      }

      hasHoveredNativeInteractiveElement = nextValue;
      hasHoveredNativePetElement = nextPetValue;
      hoveredNativeInteractiveScope = nextScope;
      // Do not create cursor-local native shape patches on hover. On Windows,
      // BrowserWindow.setShape clips visible pixels, so hover-driven shape churn
      // can expose a white compositor backing surface when re-entering handles.
      if (useNativeInteractiveRegions) {
        syncNativeInteractiveRegions('hover-state');
      }
    };
    const resolvePointerInteractivityFromPoint = (clientX: number, clientY: number) => {
      const hoveredElement = document.elementFromPoint(clientX, clientY);
      const hoveredActivityRegionHandle = isClientPointInsideActivityRegionHandle({
        x: clientX,
        y: clientY,
      });
      const hasHoveredInteractiveElement = isInteractiveElement(hoveredElement) || hoveredActivityRegionHandle;
      const hasHoveredPetHitArea = !hoveredActivityRegionHandle && isPetHitAreaElement(hoveredElement);
      const nativeInteractiveScope = hoveredActivityRegionHandle
        ? 'activity-region'
        : hoveredElement
          ? resolveNativeElementScope(hoveredElement)
          : null;
      if (!hasHoveredPetHitArea) {
        suppressPetHitAreaHoverActivation = false;
      }

      const shouldUseHoveredElement = shouldUseHoveredInteractiveElement({
        hasHoveredInteractiveElement,
        hasHoveredPetHitArea,
        suppressPetHitAreaHoverActivation,
      });
      const shouldStayInteractive = shouldKeepPointerInteractive({
        hasActiveInteraction: hasActiveInteraction(),
        hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
        hasHoveredInteractiveElement: shouldUseHoveredElement,
        hasPointerLock: pointerInteractionLockRef.current,
      });

      return {
        hasHoveredPetHitArea,
        nativeInteractiveScope: shouldUseHoveredElement ? nativeInteractiveScope : null,
        shouldStayInteractive,
        shouldUseHoveredElement,
      };
    };
    const isClientPointInsideViewport = (clientX: number, clientY: number) => (
      clientX >= 0
      && clientY >= 0
      && clientX < window.innerWidth
      && clientY < window.innerHeight
    );
    const releasePointerPassthroughIfStillOutside = () => {
      if (pointerInteractionLockRef.current || hasActiveInteraction() || hasEmbeddedPanelOpen()) {
        applyPointerPassthrough(false);
        return;
      }

      desktopPetShellRuntime.getCursorScreenPoint()
        .then((screenPoint) => {
          const clientPoint = mapScreenPointToClientPoint(screenPoint, {
            x: window.screenX,
            y: window.screenY,
          });
          if (
            clientPoint
            && isClientPointInsideViewport(clientPoint.x, clientPoint.y)
          ) {
            const nextHoverState = resolvePointerInteractivityFromPoint(clientPoint.x, clientPoint.y);
            if (nextHoverState.shouldStayInteractive) {
              setHoveredNativeInteractiveState(
                nextHoverState.shouldUseHoveredElement,
                nextHoverState.shouldUseHoveredElement && nextHoverState.hasHoveredPetHitArea,
                nextHoverState.nativeInteractiveScope,
              );
              applyPointerPassthrough(false);
              return;
            }
          }

          suppressPetHitAreaHoverActivation = false;
          setHoveredNativeInteractiveState(false, false);
          applyPointerPassthrough(true);
        })
        .catch(() => {
          suppressPetHitAreaHoverActivation = false;
          setHoveredNativeInteractiveState(false, false);
          applyPointerPassthrough(true);
        });
    };
    const schedulePointerPassthroughRelease = () => {
      if (pointerPassthroughReleaseTimeoutId !== null) {
        return;
      }

      pointerPassthroughReleaseTimeoutId = window.setTimeout(() => {
        pointerPassthroughReleaseTimeoutId = null;
        releasePointerPassthroughIfStillOutside();
      }, POINTER_PASSTHROUGH_RELEASE_DELAY_MS);
    };
    const updatePassthroughFromPoint = (clientX: number, clientY: number) => {
      const nextHoverState = resolvePointerInteractivityFromPoint(clientX, clientY);
      setHoveredNativeInteractiveState(
        nextHoverState.shouldUseHoveredElement,
        nextHoverState.shouldUseHoveredElement && nextHoverState.hasHoveredPetHitArea,
        nextHoverState.nativeInteractiveScope,
      );
      if (nextHoverState.shouldStayInteractive) {
        applyPointerPassthrough(false);
        return;
      }

      schedulePointerPassthroughRelease();
    };
    const collectNativeInteractiveRegionEntries = (options?: {
      inputProxyOnly?: boolean;
      localPetOnly?: boolean;
    }) => {
      if (!useNativeInteractiveRegions) {
        return [];
      }

      const localPetOnly = Boolean(options?.localPetOnly);
      const inputProxyOnly = Boolean(options?.inputProxyOnly);
      if (hasFullWindowNativeShape() && !localPetOnly && !inputProxyOnly) {
        return [{
          element: null,
          elementAtElementCenter: null,
          elementCenter: null,
          reason: 'full-window',
          rect: null,
          region: {
            height: Math.max(1, Math.round(window.innerHeight)),
            width: Math.max(1, Math.round(window.innerWidth)),
            x: 0,
            y: 0,
          } satisfies DesktopPetInteractiveRegionLike,
          scope: 'full-window',
        }];
      }

      const isPetNativeShapeSuspended = hasSuspendedNativePetShape();

      const viewport = {
        height: window.innerHeight,
        width: window.innerWidth,
      };
      const entries = Array.from(document.querySelectorAll(NATIVE_WINDOW_SHAPE_SELECTOR))
        .sort((firstElement, secondElement) => (
          getNativeElementScopePriority(resolveNativeElementScope(firstElement))
          - getNativeElementScopePriority(resolveNativeElementScope(secondElement))
        ))
        .map((element) => {
          if (element.getAttribute('data-desktop-pet-window-shape') === 'full-window') {
            if (localPetOnly || inputProxyOnly) {
              return null;
            }
            return {
              element: summarizePointerElement(element),
              elementAtElementCenter: null,
              elementCenter: null,
              reason: 'full-window-shape',
              rect: null,
              region: {
                height: Math.max(1, Math.round(window.innerHeight)),
                width: Math.max(1, Math.round(window.innerWidth)),
                x: 0,
                y: 0,
              } satisfies DesktopPetInteractiveRegionLike,
              scope: 'full-window',
            };
          }

          if (
            (localPetOnly || inputProxyOnly)
            && element.getAttribute('data-desktop-pet-interactive') !== 'true'
          ) {
            return null;
          }

          if (
            (localPetOnly || inputProxyOnly)
            && (
              localPetOnly
              && resolveNativeElementScope(element) !== PET_NATIVE_SCOPE
            )
          ) {
            return null;
          }

          if (
            !localPetOnly
            && !inputProxyOnly
            && !shouldCollectNativeInteractiveElement(element, isPetNativeShapeSuspended)
          ) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          const padding = resolveNativeInteractiveRegionPadding(element);
          const region = resolveNativeInteractiveRegionFromRect(
            rect,
            viewport,
            padding,
          );
          if (!region) {
            return null;
          }

          const elementCenter = {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          };
          const scope = resolveNativeElementScope(element);

          return {
            element: summarizePointerElement(element),
            elementAtElementCenter: summarizePointerElement(
              document.elementFromPoint(elementCenter.x, elementCenter.y),
            ),
            elementCenter,
            reason: null,
            rect: {
              bottom: Math.round(rect.bottom),
              height: Math.round(rect.height),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
            },
            region,
            scope,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      return localPetOnly
        ? entries.filter((entry) => entry.scope === PET_NATIVE_SCOPE)
        : entries;
    };
    const syncNativeInteractiveRegionsImpl = (reason = nativeInteractiveRegionScheduleReason) => {
      nativeInteractiveRegionLastSyncedAt = window.performance?.now?.() ?? Date.now();
      if (
        (hasPetDragInteraction() || hasCompanionPetDragInteraction())
        && !hasForceFullWindowOnPetDrag()
      ) {
        pushPointerDiagnosticLog('renderer native interactive region sync deferred to bounded drag preview', {
          hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
          hasPetDragInteraction: hasPetDragInteraction(),
          reason,
        });
        return;
      }

      const regionEntries = collectNativeInteractiveRegionEntries();
      const regions = regionEntries.map((entry) => entry.region);
      const signature = createNativeInteractiveRegionsSignature(regions);
      if (
        live2DDragProbeEnabled
        && live2DNativeRegionProbeCount < LIVE2D_NATIVE_REGION_PROBE_LIMIT
      ) {
        live2DNativeRegionProbeCount += 1;
        pushFrontendRuntimeLog('drag-diagnose', 'TEMP native interactive region probe', {
          count: regions.length,
          dirtyWhilePending: nativeInteractiveRegionSyncDirtyWhilePending,
          firstEntry: regionEntries[0] ?? null,
          firstRegion: regions[0] ?? null,
          forceFullWindowOnPetDrag: hasForceFullWindowOnPetDrag(),
          hasActiveInteraction: hasActiveInteraction(),
          hasActivityRegionInteraction: hasActivityRegionInteraction(),
          hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
          hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
          hasFullWindowNativeShape: hasFullWindowNativeShape(),
          hasHoveredNativePetElement,
          hasPetDragInteraction: hasPetDragInteraction(),
          hasPointerActivatedNativePetShape: hasPointerActivatedNativePetShape(),
          hasStartupSuppressedNativePetShape: hasStartupSuppressedNativePetShape(),
          hasSuspendedNativePetShape: hasSuspendedNativePetShape(),
          isPetMotionActive: hasCurrentPetMotionActive(),
          pointerLock: pointerInteractionLockRef.current,
          probeIndex: live2DNativeRegionProbeCount,
          reason,
          scheduleSource: nativeInteractiveRegionScheduleSource,
          signature,
          viewport: {
            height: Math.round(window.innerHeight),
            width: Math.round(window.innerWidth),
          },
        });
      }
      if (pointerDiagnosticsEnabled) {
        if (nativeInteractiveRegionDiagnosticsSignature !== signature) {
          nativeInteractiveRegionDiagnosticsSignature = signature;
          const firstRegion = regions[0] ?? null;
          const firstRegionCenter = firstRegion
            ? {
                x: Math.round(firstRegion.x + firstRegion.width / 2),
                y: Math.round(firstRegion.y + firstRegion.height / 2),
              }
            : null;
          const elementAtFirstRegionCenter = firstRegionCenter
            ? document.elementFromPoint(firstRegionCenter.x, firstRegionCenter.y)
            : null;
          const regionSummaries = regions.map((region) => {
            const center = {
              x: Math.round(region.x + region.width / 2),
              y: Math.round(region.y + region.height / 2),
            };

            return {
              center,
              elementAtCenter: summarizePointerElement(document.elementFromPoint(center.x, center.y)),
              region,
            };
          });
          pushPointerDiagnosticLog('renderer native interactive regions', {
            count: regions.length,
            entries: regionEntries,
            elementAtFirstRegionCenter: summarizePointerElement(elementAtFirstRegionCenter),
            firstRegion,
            firstRegionCenter,
            hasActiveInteraction: hasActiveInteraction(),
            hasActivityRegionInteraction: hasActivityRegionInteraction(),
            hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
            hasFullWindowNativeShape: hasFullWindowNativeShape(),
            hasPanelInteraction: hasPanelInteraction(),
            hasPointerActivatedNativePetShape: hasPointerActivatedNativePetShape(),
            forceFullWindowOnPetDrag: hasForceFullWindowOnPetDrag(),
            hasHoveredNativePetElement,
            hasStartupSuppressedNativePetShape: hasStartupSuppressedNativePetShape(),
            hasSuspendedNativePetShape: hasSuspendedNativePetShape(),
            isPetMotionActive: hasCurrentPetMotionActive(),
            pointerLock: pointerInteractionLockRef.current,
            screen: {
              x: Math.round(window.screenX),
              y: Math.round(window.screenY),
            },
            regions: regionSummaries,
            useNativeInteractiveRegions,
            viewport: {
              height: Math.round(window.innerHeight),
              width: Math.round(window.innerWidth),
            },
          });
          regionEntries.forEach((entry, index) => {
            pushPointerDiagnosticLog('renderer native interactive region entry', {
              element: entry.element,
              elementAtElementCenter: entry.elementAtElementCenter,
              elementCenter: entry.elementCenter,
              index,
              reason: entry.reason,
              rect: entry.rect,
              region: entry.region,
            });
          });
        }
      }

      if (nativeInteractiveRegionBaseRegionsRef) {
        nativeInteractiveRegionBaseRegionsRef.current = regions;
      }
      const interactiveRegionSyncOptions = (
        hasForceFullWindowOnPetDrag()
        && (hasPetDragInteraction() || hasCompanionPetDragInteraction())
        && regions.length === 1
        && regions[0]?.x === 0
        && regions[0]?.y === 0
      )
        ? { source: 'pet-drag' }
        : undefined;
      desktopPetShellRuntime.setInteractiveRegions(regions, interactiveRegionSyncOptions);
      desktopPetShellRuntime.setInteractiveRegions(
        collectNativeInteractiveRegionEntries({ inputProxyOnly: true })
          .map((entry) => entry.region),
        {
          force: true,
          source: 'render-input-proxy',
        },
      );
    };
    syncNativeInteractiveRegions = syncNativeInteractiveRegionsImpl;
    const clearScheduledNativeInteractiveRegionSync = () => {
      if (nativeInteractiveRegionSyncTimeoutId !== null) {
        window.clearTimeout(nativeInteractiveRegionSyncTimeoutId);
        nativeInteractiveRegionSyncTimeoutId = null;
      }
      if (nativeInteractiveRegionSyncAnimationFrameId !== null) {
        window.cancelAnimationFrame(nativeInteractiveRegionSyncAnimationFrameId);
        nativeInteractiveRegionSyncAnimationFrameId = null;
      }
      nativeInteractiveRegionSyncDirtyWhilePending = false;
    };
    const syncNativeInteractiveRegionsAfterRenderCommit = () => {
      if (!useNativeInteractiveRegions) {
        return;
      }

      clearScheduledNativeInteractiveRegionSync();
      nativeInteractiveRegionScheduleReason = 'post-render-commit';
      nativeInteractiveRegionScheduleSource = { type: 'post-render-commit' };
      syncNativeInteractiveRegions('post-render-commit');
    };
    nativeInteractiveRegionPostRenderSyncRef.current = syncNativeInteractiveRegionsAfterRenderCommit;
    const scheduleNativeInteractiveRegionsSync = (reason = 'scheduled', source: unknown = reason) => {
      if (!useNativeInteractiveRegions) {
        return;
      }

      nativeInteractiveRegionScheduleReason = reason;
      nativeInteractiveRegionScheduleSource = summarizeNativeInteractiveRegionMutationSource(source);

      if (
        nativeInteractiveRegionSyncAnimationFrameId !== null
        || nativeInteractiveRegionSyncTimeoutId !== null
      ) {
        nativeInteractiveRegionSyncDirtyWhilePending = true;
        return;
      }

      nativeInteractiveRegionSyncDirtyWhilePending = false;
      const now = window.performance?.now?.() ?? Date.now();
      const waitMs = resolveNativeInteractiveRegionSyncDelayMs({
        hasActivityRegionInteraction: hasActivityRegionInteraction(),
        hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
        hasPetDragInteraction: hasPetDragInteraction(),
        isPetMotionActive: hasCurrentPetMotionActive(),
        timeSinceLastSyncMs: now - nativeInteractiveRegionLastSyncedAt,
      });
      nativeInteractiveRegionSyncTimeoutId = window.setTimeout(() => {
        nativeInteractiveRegionSyncTimeoutId = null;
        nativeInteractiveRegionSyncAnimationFrameId = window.requestAnimationFrame(() => {
          nativeInteractiveRegionSyncAnimationFrameId = null;
          syncNativeInteractiveRegions(nativeInteractiveRegionScheduleReason);
          if (nativeInteractiveRegionSyncDirtyWhilePending) {
            nativeInteractiveRegionSyncDirtyWhilePending = false;
            scheduleNativeInteractiveRegionsSync('dirty-while-pending');
          }
        });
      }, waitMs);
    };
    const flushPointerMove = () => {
      pointerMoveAnimationFrameId = null;
      if (!latestPointerPosition) {
        return;
      }

      updatePassthroughFromPoint(latestPointerPosition.x, latestPointerPosition.y);
      latestPointerPosition = null;
    };
    const schedulePointerMoveUpdate = (clientX: number, clientY: number) => {
      latestPointerPosition = { x: clientX, y: clientY };
      if (pointerMoveAnimationFrameId !== null) {
        return;
      }

      pointerMoveAnimationFrameId = window.requestAnimationFrame(flushPointerMove);
    };
    const handleNativeInteractiveRegionDirty = (source?: Event | MutationRecord[]) => {
      scheduleNativeInteractiveRegionsSync('dom-dirty', source ?? 'dom-dirty');
    };

    const handlePointerMove = (event: PointerEvent) => {
      schedulePointerMoveUpdate(event.clientX, event.clientY);
      if (hasLiveNativeInteractiveRegionSync()) {
        scheduleNativeInteractiveRegionsSync('pointermove-live-sync', event);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      pushPointerDiagnosticLog('renderer pointerdown capture', {
        button: event.button,
        client: {
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        },
        isInteractiveTarget: isInteractiveElement(target),
        pointerLockBefore: pointerInteractionLockRef.current,
        target: summarizePointerElement(target),
      });
      if (isInteractiveElement(target)) {
        suppressPetHitAreaHoverActivation = false;
        pointerInteractionLockRef.current = true;
        // A pet click is only the prepare phase of a possible drag. Do not
        // resample/apply the native BrowserWindow shape here: on Windows the
        // first shape transition can expose the transparent compositor
        // backing surface for one frame. The real drag controller enables the
        // full-window drag session after the movement threshold is crossed.
        const isPetHitArea = isPetHitAreaElement(target);
        if (!isPetHitArea) {
          setHoveredNativeInteractiveState(true, false);
          applyPointerPassthrough(false);
        }
      }
    };
    const handlePointerUp = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      pushPointerDiagnosticLog('renderer pointerup capture', {
        button: event.button,
        client: {
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        },
        pointerLockBefore: pointerInteractionLockRef.current,
        target: summarizePointerElement(target),
      });
      if (isPetHitAreaElement(target) && !hasActiveInteraction() && !hasEmbeddedPanelOpen()) {
        suppressPetHitAreaHoverActivation = true;
      }
      pointerInteractionLockRef.current = false;
      updatePassthroughFromPoint(event.clientX, event.clientY);
    };
    const handleMouseLeave = () => {
      if (!pointerInteractionLockRef.current && !hasActiveInteraction() && !hasEmbeddedPanelOpen()) {
        schedulePointerPassthroughRelease();
      }
    };
    const handleWindowBlur = () => {
      if (pointerInteractionLockRef.current || hasActiveInteraction() || hasEmbeddedPanelOpen()) {
        applyPointerPassthrough(false);
        return;
      }

      pointerInteractionLockRef.current = false;
      schedulePointerPassthroughRelease();
    };
    const pollCursorHover = () => {
      if (!desktopPetShellRuntime.isDesktopMode() || pointerInteractionLockRef.current || hasActiveInteraction()) {
        return;
      }

      desktopPetShellRuntime.getCursorScreenPoint()
        .then((screenPoint) => {
          const clientPoint = mapScreenPointToClientPoint(screenPoint, {
            x: window.screenX,
            y: window.screenY,
          });
          if (!clientPoint) {
            return;
          }

          const isInsideViewport = clientPoint.x >= 0
            && clientPoint.y >= 0
            && clientPoint.x < window.innerWidth
            && clientPoint.y < window.innerHeight;

          if (!isInsideViewport) {
            if (!hasEmbeddedPanelOpen()) {
              schedulePointerPassthroughRelease();
            }
            return;
          }

          updatePassthroughFromPoint(clientPoint.x, clientPoint.y);
        })
        .catch(() => {});
    };

    pushPointerDiagnosticLog('renderer pointer shell effect mounted', {
      hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
      forceFullWindowOnPetDrag: hasForceFullWindowOnPetDrag(),
      hasFullWindowNativeShape: hasFullWindowNativeShape(),
      hasStartupSuppressedNativePetShape: hasStartupSuppressedNativePetShape(),
      hasSuspendedNativePetShape: hasSuspendedNativePetShape(),
      isPetMotionActive: hasCurrentPetMotionActive(),
      screen: {
        x: Math.round(window.screenX),
        y: Math.round(window.screenY),
      },
      useNativeInteractiveRegions,
      viewport: {
        height: Math.round(window.innerHeight),
        width: Math.round(window.innerWidth),
      },
    });
    applyPointerPassthrough(!hasEmbeddedPanelOpen());
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('pointercancel', handlePointerUp, true);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('blur', handleWindowBlur);
    hoverPollIntervalId = window.setInterval(pollCursorHover, POINTER_PASSTHROUGH_HOVER_POLL_INTERVAL_MS);
    pollCursorHover();
    if (useNativeInteractiveRegions) {
      nativeInteractiveRegionObserver = new MutationObserver(handleNativeInteractiveRegionDirty);
      nativeInteractiveRegionObserver.observe(document.body, {
        attributeFilter: [
          'class',
          'data-desktop-pet-interactive',
          'data-desktop-pet-window-shape',
          'style',
        ],
        attributes: true,
        childList: true,
        subtree: true,
      });
      window.addEventListener('resize', handleNativeInteractiveRegionDirty);
      window.addEventListener('scroll', handleNativeInteractiveRegionDirty, true);
      nativeInteractiveRegionResyncIntervalId = window.setInterval(
        () => scheduleNativeInteractiveRegionsSync('idle-resync'),
        NATIVE_INTERACTIVE_REGION_IDLE_RESYNC_MS,
      );
      nativeInteractiveRegionScheduleReason = 'initial';
      nativeInteractiveRegionScheduleSource = { type: 'initial' };
      syncNativeInteractiveRegions('initial');
    } else {
      desktopPetShellRuntime.setInteractiveRegions([]);
    }
    const unsubscribeRefreshNativeInteractiveRegions = desktopPetShellRuntime.onRefreshNativeInteractiveRegions((payload) => {
      if (!useNativeInteractiveRegions) {
        return;
      }

      clearScheduledNativeInteractiveRegionSync();
      const isPostDragInputProxyRequest = Boolean(
        payload
        && typeof payload === 'object'
        && 'inputProxy' in payload
        && payload.inputProxy,
      );
      const regionEntries = collectNativeInteractiveRegionEntries({
        localPetOnly: isPostDragInputProxyRequest,
      });
      const regions = regionEntries.map((entry) => entry.region);
      if (isPostDragInputProxyRequest) {
        desktopPetShellRuntime.setInteractiveRegions(regions, {
          force: true,
          source: 'post-drag-input-proxy',
        });
        return;
      }
      if (nativeInteractiveRegionBaseRegionsRef) {
        nativeInteractiveRegionBaseRegionsRef.current = regions;
      }
      nativeInteractiveRegionScheduleReason = 'refresh-native-interactive-regions';
      nativeInteractiveRegionScheduleSource = { type: 'refresh-native-interactive-regions' };
      desktopPetShellRuntime.setInteractiveRegions(regions, {
        force: true,
        source: 'fresh-shape',
      });
    });

    return () => {
      if (pointerMoveAnimationFrameId !== null) {
        window.cancelAnimationFrame(pointerMoveAnimationFrameId);
      }
      clearScheduledPointerPassthroughRelease();
      if (hoverPollIntervalId !== null) {
        window.clearInterval(hoverPollIntervalId);
      }
      if (nativeInteractiveRegionResyncIntervalId !== null) {
        window.clearInterval(nativeInteractiveRegionResyncIntervalId);
      }
      clearScheduledNativeInteractiveRegionSync();
      if (nativeInteractiveRegionPostRenderSyncRef.current === syncNativeInteractiveRegionsAfterRenderCommit) {
        nativeInteractiveRegionPostRenderSyncRef.current = null;
      }
      nativeInteractiveRegionObserver?.disconnect();
      if (nativeInteractiveRegionBaseRegionsRef) {
        nativeInteractiveRegionBaseRegionsRef.current = [];
      }
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('pointercancel', handlePointerUp, true);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleNativeInteractiveRegionDirty);
      window.removeEventListener('scroll', handleNativeInteractiveRegionDirty, true);
      unsubscribeRefreshNativeInteractiveRegions();
    };
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
