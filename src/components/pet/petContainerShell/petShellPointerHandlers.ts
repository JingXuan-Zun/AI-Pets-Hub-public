import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import { mapScreenPointToClientPoint } from './petShellPointerPolicy';
import { summarizePointerElement } from './petShellNativeElements';
import { type PetShellInteractionQueries } from './petShellInteractionQueries';
import { type PetShellPointerPassthrough } from './petShellPointerPassthrough';
import { type PetShellNativeRegionSync } from './petShellNativeRegionSync';
import { type PetShellPointerContext } from './petShellPointerSessionTypes';

export function createPetShellPointerHandlers(
  ctx: PetShellPointerContext,
  queries: PetShellInteractionQueries,
  passthrough: PetShellPointerPassthrough,
  regionSync: PetShellNativeRegionSync,
) {
  const { session } = ctx;
  const {
    hasActiveInteraction, hasEmbeddedPanelOpen, hasLiveNativeInteractiveRegionSync, isInteractiveElement, isPetHitAreaElement,
  } = queries;
  const {
    applyPointerPassthrough, schedulePointerMoveUpdate, schedulePointerPassthroughRelease,
    setHoveredNativeInteractiveState, updatePassthroughFromPoint,
  } = passthrough;
  const { scheduleNativeInteractiveRegionsSync } = regionSync;
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
    ctx.pushPointerDiagnosticLog('renderer pointerdown capture', {
      button: event.button,
      client: {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      },
      isInteractiveTarget: isInteractiveElement(target),
      pointerLockBefore: ctx.pointerInteractionLockRef.current,
      target: summarizePointerElement(target),
    });
    if (isInteractiveElement(target)) {
      session.suppressPetHitAreaHoverActivation = false;
      ctx.pointerInteractionLockRef.current = true;
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
    ctx.pushPointerDiagnosticLog('renderer pointerup capture', {
      button: event.button,
      client: {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      },
      pointerLockBefore: ctx.pointerInteractionLockRef.current,
      target: summarizePointerElement(target),
    });
    if (isPetHitAreaElement(target) && !hasActiveInteraction() && !hasEmbeddedPanelOpen()) {
      session.suppressPetHitAreaHoverActivation = true;
    }
    ctx.pointerInteractionLockRef.current = false;
    updatePassthroughFromPoint(event.clientX, event.clientY);
  };
  const handleMouseLeave = () => {
    if (!ctx.pointerInteractionLockRef.current && !hasActiveInteraction() && !hasEmbeddedPanelOpen()) {
      schedulePointerPassthroughRelease();
    }
  };
  const handleWindowBlur = () => {
    if (ctx.pointerInteractionLockRef.current || hasActiveInteraction() || hasEmbeddedPanelOpen()) {
      applyPointerPassthrough(false);
      return;
    }

    ctx.pointerInteractionLockRef.current = false;
    schedulePointerPassthroughRelease();
  };
  const pollCursorHover = () => {
    if (!desktopPetShellRuntime.isDesktopMode() || ctx.pointerInteractionLockRef.current || hasActiveInteraction()) {
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
  return {
    handleMouseLeave,
    handleNativeInteractiveRegionDirty,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWindowBlur,
    pollCursorHover,
  };
}
