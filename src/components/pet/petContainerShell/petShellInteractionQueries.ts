import {
  isForceFullShapeOnDragEnabled,
  shouldSuspendNativePetShape,
  shouldUseFullWindowNativeShape,
  shouldUseImmediateNativeInteractiveRegionSync,
} from './petShellPointerPolicy';
import { type PetShellPointerContext } from './petShellPointerSessionTypes';

export function createPetShellInteractionQueries(ctx: PetShellPointerContext) {
  const isInteractiveElement = (element: Element | null) =>
    Boolean(element?.closest('[data-desktop-pet-interactive="true"]'));
  const isPetHitAreaElement = (element: Element | null) =>
    Boolean(element?.closest('[data-desktop-pet-id]'));
  const hasPetDragInteraction = () => Boolean(ctx.latestNativeShapeRuntimeStateRef.current.dragState);
  const hasCompanionPetDragInteraction = () => (
    Boolean(ctx.latestNativeShapeRuntimeStateRef.current.companionDragState)
  );
  const hasCurrentPetMotionActive = () => Boolean(ctx.latestNativeShapeRuntimeStateRef.current.isPetMotionActive);
  const hasForceFullWindowOnPetDrag = () => (
    ctx.latestNativeShapeRuntimeStateRef.current.useFullWindowNativeShapeForPetDrag
    || isForceFullShapeOnDragEnabled()
  );
  const hasEmbeddedPanelOpen = () => (
    (!ctx.useExternalChatWindow && ctx.isChatOpen)
    || (!ctx.useExternalSettingsWindow && ctx.isSettingsOpen)
  );
  const hasActiveInteraction = () => Boolean(
    hasPetDragInteraction()
    || hasCompanionPetDragInteraction()
    || ctx.chatPanelDragState
    || ctx.chatPanelResizeState
    || ctx.activityRegionDragState
    || ctx.activityRegionResizeState,
  );
  const hasPanelInteraction = () => Boolean(ctx.chatPanelDragState || ctx.chatPanelResizeState);
  const hasActivityRegionInteraction = () => Boolean(ctx.activityRegionDragState || ctx.activityRegionResizeState);
  const hasFullWindowNativeShape = () => shouldUseFullWindowNativeShape({
    forceFullWindowOnPetDrag: hasForceFullWindowOnPetDrag(),
    hasActivityRegionInteraction: hasActivityRegionInteraction(),
    hasCompanionPetDragInteraction: hasCompanionPetDragInteraction(),
    hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
    hasPanelInteraction: hasPanelInteraction(),
    hasPetDragInteraction: hasPetDragInteraction(),
    hasPointerLock: ctx.pointerInteractionLockRef.current,
  });
  const hasStartupSuppressedNativePetShape = () => {
    const suppressionUntil = ctx.nativePetShapeStartupSuppressionUntilRef.current;
    if (suppressionUntil === null) {
      return false;
    }

    const now = window.performance?.now?.() ?? Date.now();
    return now < suppressionUntil;
  };
  const hasPointerActivatedNativePetShape = () => (
    ctx.session.hasHoveredNativePetElement
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
  return {
    hasActiveInteraction,
    hasActivityRegionInteraction,
    hasCompanionPetDragInteraction,
    hasCurrentPetMotionActive,
    hasEmbeddedPanelOpen,
    hasForceFullWindowOnPetDrag,
    hasFullWindowNativeShape,
    hasLiveNativeInteractiveRegionSync,
    hasPanelInteraction,
    hasPetDragInteraction,
    hasPointerActivatedNativePetShape,
    hasStartupSuppressedNativePetShape,
    hasSuspendedNativePetShape,
    isInteractiveElement,
    isPetHitAreaElement,
  };
}

export type PetShellInteractionQueries = ReturnType<typeof createPetShellInteractionQueries>;
