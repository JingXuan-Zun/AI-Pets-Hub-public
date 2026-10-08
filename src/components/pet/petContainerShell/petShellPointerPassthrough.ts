import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import {
  POINTER_PASSTHROUGH_RELEASE_DELAY_MS,
  mapScreenPointToClientPoint,
  shouldKeepPointerInteractive,
  shouldUseHoveredInteractiveElement,
} from './petShellPointerPolicy';
import { isClientPointInsideActivityRegionHandle, resolveNativeElementScope } from './petShellNativeElements';
import { type PetShellInteractionQueries } from './petShellInteractionQueries';
import { type PetShellPointerContext } from './petShellPointerSessionTypes';

export function createPetShellPointerPassthrough(ctx: PetShellPointerContext, queries: PetShellInteractionQueries) {
  const { session } = ctx;
  const { hasActiveInteraction, hasEmbeddedPanelOpen, isInteractiveElement, isPetHitAreaElement } = queries;
  function clearScheduledPointerPassthroughRelease() {
    if (session.pointerPassthroughReleaseTimeoutId !== null) {
      window.clearTimeout(session.pointerPassthroughReleaseTimeoutId);
      session.pointerPassthroughReleaseTimeoutId = null;
    }
  }

  const applyPointerPassthrough = (ignore: boolean) => {
    if (!ignore) {
      clearScheduledPointerPassthroughRelease();
    }

    if (session.pointerPassthroughState === ignore) {
      return;
    }

    session.pointerPassthroughState = ignore;
    ctx.pushPointerDiagnosticLog('renderer pointer passthrough request', {
      ignore,
      useNativeInteractiveRegions: ctx.useNativeInteractiveRegions,
    });
    desktopPetShellRuntime.setPointerPassthrough(ignore);
  };
  const setHoveredNativeInteractiveState = (
    nextValue: boolean,
    nextPetValue: boolean,
    nextScope: string | null = null,
  ) => {
    if (
      session.hasHoveredNativeInteractiveElement === nextValue
      && session.hasHoveredNativePetElement === nextPetValue
      && session.hoveredNativeInteractiveScope === nextScope
    ) {
      return;
    }

    session.hasHoveredNativeInteractiveElement = nextValue;
    session.hasHoveredNativePetElement = nextPetValue;
    session.hoveredNativeInteractiveScope = nextScope;
    // Do not create cursor-local native shape patches on hover. On Windows,
    // BrowserWindow.setShape clips visible pixels, so hover-driven shape churn
    // can expose a white compositor backing surface when re-entering handles.
    if (ctx.useNativeInteractiveRegions) {
      session.syncNativeInteractiveRegions('hover-state');
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
      session.suppressPetHitAreaHoverActivation = false;
    }

    const shouldUseHoveredElement = shouldUseHoveredInteractiveElement({
      hasHoveredInteractiveElement,
      hasHoveredPetHitArea,
      suppressPetHitAreaHoverActivation: session.suppressPetHitAreaHoverActivation,
    });
    const shouldStayInteractive = shouldKeepPointerInteractive({
      hasActiveInteraction: hasActiveInteraction(),
      hasEmbeddedPanelOpen: hasEmbeddedPanelOpen(),
      hasHoveredInteractiveElement: shouldUseHoveredElement,
      hasPointerLock: ctx.pointerInteractionLockRef.current,
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
    if (ctx.pointerInteractionLockRef.current || hasActiveInteraction() || hasEmbeddedPanelOpen()) {
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

        session.suppressPetHitAreaHoverActivation = false;
        setHoveredNativeInteractiveState(false, false);
        applyPointerPassthrough(true);
      })
      .catch(() => {
        session.suppressPetHitAreaHoverActivation = false;
        setHoveredNativeInteractiveState(false, false);
        applyPointerPassthrough(true);
      });
  };
  const schedulePointerPassthroughRelease = () => {
    if (session.pointerPassthroughReleaseTimeoutId !== null) {
      return;
    }

    session.pointerPassthroughReleaseTimeoutId = window.setTimeout(() => {
      session.pointerPassthroughReleaseTimeoutId = null;
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
  const flushPointerMove = () => {
    session.pointerMoveAnimationFrameId = null;
    if (!session.latestPointerPosition) {
      return;
    }

    updatePassthroughFromPoint(session.latestPointerPosition.x, session.latestPointerPosition.y);
    session.latestPointerPosition = null;
  };
  const schedulePointerMoveUpdate = (clientX: number, clientY: number) => {
    session.latestPointerPosition = { x: clientX, y: clientY };
    if (session.pointerMoveAnimationFrameId !== null) {
      return;
    }

    session.pointerMoveAnimationFrameId = window.requestAnimationFrame(flushPointerMove);
  };
  return {
    applyPointerPassthrough,
    clearScheduledPointerPassthroughRelease,
    schedulePointerMoveUpdate,
    schedulePointerPassthroughRelease,
    setHoveredNativeInteractiveState,
    updatePassthroughFromPoint,
  };
}

export type PetShellPointerPassthrough = ReturnType<typeof createPetShellPointerPassthrough>;
