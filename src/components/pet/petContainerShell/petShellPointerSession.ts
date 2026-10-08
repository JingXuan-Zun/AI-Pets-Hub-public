import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { isLive2DDragReleaseProbeEnabled } from '../live2dDragProbeFlag';
import {
  NATIVE_INTERACTIVE_REGION_IDLE_RESYNC_MS,
  POINTER_PASSTHROUGH_HOVER_POLL_INTERVAL_MS,
  isPointerDiagnosticsEnabled,
} from './petShellPointerPolicy';
import { createPetShellInteractionQueries, type PetShellInteractionQueries } from './petShellInteractionQueries';
import { createPetShellPointerPassthrough } from './petShellPointerPassthrough';
import { createPetShellNativeRegionCollector } from './petShellNativeRegionCollection';
import { createPetShellNativeRegionSync } from './petShellNativeRegionSync';
import { createPetShellPointerHandlers } from './petShellPointerHandlers';
import {
  type PetShellPointerContext,
  type PetShellPointerSessionState,
  type PetShellPointerSessionValues,
} from './petShellPointerSessionTypes';

function createPetShellPointerSessionState(): PetShellPointerSessionState {
  return {
    hasHoveredNativeInteractiveElement: false,
    hasHoveredNativePetElement: false,
    hoverPollIntervalId: null,
    hoveredNativeInteractiveScope: null,
    latestPointerPosition: null,
    live2DNativeRegionProbeCount: 0,
    nativeInteractiveRegionDiagnosticsSignature: '',
    nativeInteractiveRegionLastSyncedAt: 0,
    nativeInteractiveRegionObserver: null,
    nativeInteractiveRegionResyncIntervalId: null,
    nativeInteractiveRegionScheduleReason: 'mount',
    nativeInteractiveRegionScheduleSource: {
      type: 'mount',
    },
    nativeInteractiveRegionSyncAnimationFrameId: null,
    nativeInteractiveRegionSyncDirtyWhilePending: false,
    nativeInteractiveRegionSyncTimeoutId: null,
    pointerMoveAnimationFrameId: null,
    pointerPassthroughReleaseTimeoutId: null,
    pointerPassthroughState: null,
    suppressPetHitAreaHoverActivation: false,
    syncNativeInteractiveRegions: () => {},
  };
}

function createPetShellPointerContext(values: PetShellPointerSessionValues): PetShellPointerContext {
  const pointerDiagnosticsEnabled = isPointerDiagnosticsEnabled();
  const live2DDragProbeEnabled = isLive2DDragReleaseProbeEnabled();
  return {
    ...values,
    live2DDragProbeEnabled,
    pointerDiagnosticsEnabled,
    pushPointerDiagnosticLog: (message: string, details?: unknown) => {
      if (pointerDiagnosticsEnabled) {
        pushFrontendRuntimeLog('pointer', message, details);
      }
    },
    session: createPetShellPointerSessionState(),
  };
}

function logPointerShellMounted(ctx: PetShellPointerContext, queries: PetShellInteractionQueries) {
  ctx.pushPointerDiagnosticLog('renderer pointer shell effect mounted', {
    hasEmbeddedPanelOpen: queries.hasEmbeddedPanelOpen(),
    forceFullWindowOnPetDrag: queries.hasForceFullWindowOnPetDrag(),
    hasFullWindowNativeShape: queries.hasFullWindowNativeShape(),
    hasStartupSuppressedNativePetShape: queries.hasStartupSuppressedNativePetShape(),
    hasSuspendedNativePetShape: queries.hasSuspendedNativePetShape(),
    isPetMotionActive: queries.hasCurrentPetMotionActive(),
    screen: {
      x: Math.round(window.screenX),
      y: Math.round(window.screenY),
    },
    useNativeInteractiveRegions: ctx.useNativeInteractiveRegions,
    viewport: {
      height: Math.round(window.innerHeight),
      width: Math.round(window.innerWidth),
    },
  });
}

function startNativeRegionObservation(
  ctx: PetShellPointerContext,
  handleNativeInteractiveRegionDirty: (source?: Event | MutationRecord[]) => void,
  scheduleSync: (reason?: string) => void,
) {
  const { session } = ctx;
  if (!ctx.useNativeInteractiveRegions) {
    desktopPetShellRuntime.setInteractiveRegions([]);
    return;
  }
  session.nativeInteractiveRegionObserver = new MutationObserver(handleNativeInteractiveRegionDirty);
  session.nativeInteractiveRegionObserver.observe(document.body, {
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
  session.nativeInteractiveRegionResyncIntervalId = window.setInterval(
    () => scheduleSync('idle-resync'),
    NATIVE_INTERACTIVE_REGION_IDLE_RESYNC_MS,
  );
  session.nativeInteractiveRegionScheduleReason = 'initial';
  session.nativeInteractiveRegionScheduleSource = { type: 'initial' };
  session.syncNativeInteractiveRegions('initial');
}

// Starts one pointer-passthrough/native-region session for the shell effect
// and returns its cleanup, in the original setup and teardown order.
export function startPetShellPointerSession(values: PetShellPointerSessionValues) {
  const ctx = createPetShellPointerContext(values);
  const { session } = ctx;
  const queries = createPetShellInteractionQueries(ctx);
  const passthrough = createPetShellPointerPassthrough(ctx, queries);
  const collectNativeInteractiveRegionEntries = createPetShellNativeRegionCollector(ctx, queries);
  const regionSync = createPetShellNativeRegionSync(ctx, queries, collectNativeInteractiveRegionEntries);
  session.syncNativeInteractiveRegions = regionSync.syncNativeInteractiveRegionsImpl;
  const { syncNativeInteractiveRegionsAfterRenderCommit } = regionSync;
  ctx.nativeInteractiveRegionPostRenderSyncRef.current = syncNativeInteractiveRegionsAfterRenderCommit;
  const handlers = createPetShellPointerHandlers(ctx, queries, passthrough, regionSync);

  logPointerShellMounted(ctx, queries);
  passthrough.applyPointerPassthrough(!queries.hasEmbeddedPanelOpen());
  window.addEventListener('pointermove', handlers.handlePointerMove, true);
  window.addEventListener('pointerdown', handlers.handlePointerDown, true);
  window.addEventListener('pointerup', handlers.handlePointerUp, true);
  window.addEventListener('pointercancel', handlers.handlePointerUp, true);
  document.addEventListener('mouseleave', handlers.handleMouseLeave);
  window.addEventListener('blur', handlers.handleWindowBlur);
  session.hoverPollIntervalId = window.setInterval(handlers.pollCursorHover, POINTER_PASSTHROUGH_HOVER_POLL_INTERVAL_MS);
  handlers.pollCursorHover();
  startNativeRegionObservation(ctx, handlers.handleNativeInteractiveRegionDirty, regionSync.scheduleNativeInteractiveRegionsSync);
  const unsubscribeRefreshNativeInteractiveRegions = desktopPetShellRuntime.onRefreshNativeInteractiveRegions(
    regionSync.handleRefreshNativeInteractiveRegions,
  );

  return () => {
    if (session.pointerMoveAnimationFrameId !== null) {
      window.cancelAnimationFrame(session.pointerMoveAnimationFrameId);
    }
    passthrough.clearScheduledPointerPassthroughRelease();
    if (session.hoverPollIntervalId !== null) {
      window.clearInterval(session.hoverPollIntervalId);
    }
    if (session.nativeInteractiveRegionResyncIntervalId !== null) {
      window.clearInterval(session.nativeInteractiveRegionResyncIntervalId);
    }
    regionSync.clearScheduledNativeInteractiveRegionSync();
    if (ctx.nativeInteractiveRegionPostRenderSyncRef.current === syncNativeInteractiveRegionsAfterRenderCommit) {
      ctx.nativeInteractiveRegionPostRenderSyncRef.current = null;
    }
    session.nativeInteractiveRegionObserver?.disconnect();
    if (ctx.nativeInteractiveRegionBaseRegionsRef) {
      ctx.nativeInteractiveRegionBaseRegionsRef.current = [];
    }
    window.removeEventListener('pointermove', handlers.handlePointerMove, true);
    window.removeEventListener('pointerdown', handlers.handlePointerDown, true);
    window.removeEventListener('pointerup', handlers.handlePointerUp, true);
    window.removeEventListener('pointercancel', handlers.handlePointerUp, true);
    document.removeEventListener('mouseleave', handlers.handleMouseLeave);
    window.removeEventListener('blur', handlers.handleWindowBlur);
    window.removeEventListener('resize', handlers.handleNativeInteractiveRegionDirty);
    window.removeEventListener('scroll', handlers.handleNativeInteractiveRegionDirty, true);
    unsubscribeRefreshNativeInteractiveRegions();
  };
}
