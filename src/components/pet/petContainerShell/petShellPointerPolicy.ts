export const POINTER_PASSTHROUGH_HOVER_POLL_INTERVAL_MS = 80;
export const POINTER_PASSTHROUGH_RELEASE_DELAY_MS = 120;
const NATIVE_INTERACTIVE_REGION_SYNC_MIN_DELAY_MS = 120;
export const NATIVE_INTERACTIVE_REGION_IDLE_RESYNC_MS = 1000;
export const NATIVE_PET_SHAPE_STARTUP_SUPPRESSION_MS = 150_000;
export const LIVE2D_NATIVE_REGION_PROBE_LIMIT = 260;
const USE_NATIVE_ORDINARY_PET_SHAPE = false;

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

export function isPointerDiagnosticsEnabled() {
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
