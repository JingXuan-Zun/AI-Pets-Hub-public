import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import { resolveNativeInteractiveRegionSyncDelayMs } from './petShellPointerPolicy';
import {
  createNativeInteractiveRegionsSignature,
  summarizeNativeInteractiveRegionMutationSource,
} from './petShellNativeElements';
import { type PetShellInteractionQueries } from './petShellInteractionQueries';
import { type CollectNativeInteractiveRegionEntries } from './petShellNativeRegionCollection';
import { pushLive2DNativeRegionProbe, pushNativeRegionDiagnostics } from './petShellNativeRegionDiagnostics';
import { type PetShellPointerContext } from './petShellPointerSessionTypes';

function resolveRegionSyncOptions(queries: PetShellInteractionQueries, regions: DesktopPetInteractiveRegionLike[]) {
  return (
    queries.hasForceFullWindowOnPetDrag()
    && (queries.hasPetDragInteraction() || queries.hasCompanionPetDragInteraction())
    && regions.length === 1
    && regions[0]?.x === 0
    && regions[0]?.y === 0
  )
    ? { source: 'pet-drag' }
    : undefined;
}

export function createPetShellNativeRegionSync(
  ctx: PetShellPointerContext,
  queries: PetShellInteractionQueries,
  collectNativeInteractiveRegionEntries: CollectNativeInteractiveRegionEntries,
) {
  const { session } = ctx;
  const syncNativeInteractiveRegionsImpl = (reason = session.nativeInteractiveRegionScheduleReason) => {
    session.nativeInteractiveRegionLastSyncedAt = window.performance?.now?.() ?? Date.now();
    if (
      (queries.hasPetDragInteraction() || queries.hasCompanionPetDragInteraction())
      && !queries.hasForceFullWindowOnPetDrag()
    ) {
      ctx.pushPointerDiagnosticLog('renderer native interactive region sync deferred to bounded drag preview', {
        hasCompanionPetDragInteraction: queries.hasCompanionPetDragInteraction(),
        hasPetDragInteraction: queries.hasPetDragInteraction(),
        reason,
      });
      return;
    }

    const regionEntries = collectNativeInteractiveRegionEntries();
    const regions = regionEntries.map((entry) => entry.region);
    const signature = createNativeInteractiveRegionsSignature(regions);
    pushLive2DNativeRegionProbe(ctx, queries, { reason, regionEntries, regions, signature });
    pushNativeRegionDiagnostics(ctx, queries, { regionEntries, regions, signature });

    if (ctx.nativeInteractiveRegionBaseRegionsRef) {
      ctx.nativeInteractiveRegionBaseRegionsRef.current = regions;
    }
    const interactiveRegionSyncOptions = resolveRegionSyncOptions(queries, regions);
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
  const clearScheduledNativeInteractiveRegionSync = () => {
    if (session.nativeInteractiveRegionSyncTimeoutId !== null) {
      window.clearTimeout(session.nativeInteractiveRegionSyncTimeoutId);
      session.nativeInteractiveRegionSyncTimeoutId = null;
    }
    if (session.nativeInteractiveRegionSyncAnimationFrameId !== null) {
      window.cancelAnimationFrame(session.nativeInteractiveRegionSyncAnimationFrameId);
      session.nativeInteractiveRegionSyncAnimationFrameId = null;
    }
    session.nativeInteractiveRegionSyncDirtyWhilePending = false;
  };
  const syncNativeInteractiveRegionsAfterRenderCommit = () => {
    if (!ctx.useNativeInteractiveRegions) {
      return;
    }

    clearScheduledNativeInteractiveRegionSync();
    session.nativeInteractiveRegionScheduleReason = 'post-render-commit';
    session.nativeInteractiveRegionScheduleSource = { type: 'post-render-commit' };
    session.syncNativeInteractiveRegions('post-render-commit');
  };
  const scheduleNativeInteractiveRegionsSync = (reason = 'scheduled', source: unknown = reason) => {
    if (!ctx.useNativeInteractiveRegions) {
      return;
    }

    session.nativeInteractiveRegionScheduleReason = reason;
    session.nativeInteractiveRegionScheduleSource = summarizeNativeInteractiveRegionMutationSource(source);

    if (
      session.nativeInteractiveRegionSyncAnimationFrameId !== null
      || session.nativeInteractiveRegionSyncTimeoutId !== null
    ) {
      session.nativeInteractiveRegionSyncDirtyWhilePending = true;
      return;
    }

    session.nativeInteractiveRegionSyncDirtyWhilePending = false;
    const now = window.performance?.now?.() ?? Date.now();
    const waitMs = resolveNativeInteractiveRegionSyncDelayMs({
      hasActivityRegionInteraction: queries.hasActivityRegionInteraction(),
      hasCompanionPetDragInteraction: queries.hasCompanionPetDragInteraction(),
      hasPetDragInteraction: queries.hasPetDragInteraction(),
      isPetMotionActive: queries.hasCurrentPetMotionActive(),
      timeSinceLastSyncMs: now - session.nativeInteractiveRegionLastSyncedAt,
    });
    session.nativeInteractiveRegionSyncTimeoutId = window.setTimeout(() => {
      session.nativeInteractiveRegionSyncTimeoutId = null;
      session.nativeInteractiveRegionSyncAnimationFrameId = window.requestAnimationFrame(() => {
        session.nativeInteractiveRegionSyncAnimationFrameId = null;
        session.syncNativeInteractiveRegions(session.nativeInteractiveRegionScheduleReason);
        if (session.nativeInteractiveRegionSyncDirtyWhilePending) {
          session.nativeInteractiveRegionSyncDirtyWhilePending = false;
          scheduleNativeInteractiveRegionsSync('dirty-while-pending');
        }
      });
    }, waitMs);
  };
  const handleRefreshNativeInteractiveRegions = (payload: unknown) => {
    if (!ctx.useNativeInteractiveRegions) {
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
    if (ctx.nativeInteractiveRegionBaseRegionsRef) {
      ctx.nativeInteractiveRegionBaseRegionsRef.current = regions;
    }
    session.nativeInteractiveRegionScheduleReason = 'refresh-native-interactive-regions';
    session.nativeInteractiveRegionScheduleSource = { type: 'refresh-native-interactive-regions' };
    desktopPetShellRuntime.setInteractiveRegions(regions, {
      force: true,
      source: 'fresh-shape',
    });
  };
  return {
    clearScheduledNativeInteractiveRegionSync,
    handleRefreshNativeInteractiveRegions,
    scheduleNativeInteractiveRegionsSync,
    syncNativeInteractiveRegionsAfterRenderCommit,
    syncNativeInteractiveRegionsImpl,
  };
}

export type PetShellNativeRegionSync = ReturnType<typeof createPetShellNativeRegionSync>;
