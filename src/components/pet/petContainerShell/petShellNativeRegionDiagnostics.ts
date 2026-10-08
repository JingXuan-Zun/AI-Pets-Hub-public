import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { LIVE2D_NATIVE_REGION_PROBE_LIMIT } from './petShellPointerPolicy';
import { summarizePointerElement } from './petShellNativeElements';
import { type PetShellInteractionQueries } from './petShellInteractionQueries';
import { type CollectNativeInteractiveRegionEntries } from './petShellNativeRegionCollection';
import { type PetShellPointerContext } from './petShellPointerSessionTypes';

type RegionEntries = ReturnType<CollectNativeInteractiveRegionEntries>;

export function pushLive2DNativeRegionProbe(
  ctx: PetShellPointerContext,
  queries: PetShellInteractionQueries,
  sample: { reason: string; regionEntries: RegionEntries; regions: DesktopPetInteractiveRegionLike[]; signature: string },
) {
  const { session } = ctx;
  const { reason, regionEntries, regions, signature } = sample;
  if (
    !ctx.live2DDragProbeEnabled
    || session.live2DNativeRegionProbeCount >= LIVE2D_NATIVE_REGION_PROBE_LIMIT
  ) {
    return;
  }
  session.live2DNativeRegionProbeCount += 1;
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP native interactive region probe', {
    count: regions.length,
    dirtyWhilePending: session.nativeInteractiveRegionSyncDirtyWhilePending,
    firstEntry: regionEntries[0] ?? null,
    firstRegion: regions[0] ?? null,
    forceFullWindowOnPetDrag: queries.hasForceFullWindowOnPetDrag(),
    hasActiveInteraction: queries.hasActiveInteraction(),
    hasActivityRegionInteraction: queries.hasActivityRegionInteraction(),
    hasCompanionPetDragInteraction: queries.hasCompanionPetDragInteraction(),
    hasEmbeddedPanelOpen: queries.hasEmbeddedPanelOpen(),
    hasFullWindowNativeShape: queries.hasFullWindowNativeShape(),
    hasHoveredNativePetElement: session.hasHoveredNativePetElement,
    hasPetDragInteraction: queries.hasPetDragInteraction(),
    hasPointerActivatedNativePetShape: queries.hasPointerActivatedNativePetShape(),
    hasStartupSuppressedNativePetShape: queries.hasStartupSuppressedNativePetShape(),
    hasSuspendedNativePetShape: queries.hasSuspendedNativePetShape(),
    isPetMotionActive: queries.hasCurrentPetMotionActive(),
    pointerLock: ctx.pointerInteractionLockRef.current,
    probeIndex: session.live2DNativeRegionProbeCount,
    reason,
    scheduleSource: session.nativeInteractiveRegionScheduleSource,
    signature,
    viewport: {
      height: Math.round(window.innerHeight),
      width: Math.round(window.innerWidth),
    },
  });
}

function summarizeRegionCenters(regions: DesktopPetInteractiveRegionLike[]) {
  return regions.map((region) => {
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
}

function pushNativeRegionSummary(
  ctx: PetShellPointerContext,
  queries: PetShellInteractionQueries,
  regionEntries: RegionEntries,
  regions: DesktopPetInteractiveRegionLike[],
) {
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
  const regionSummaries = summarizeRegionCenters(regions);
  ctx.pushPointerDiagnosticLog('renderer native interactive regions', {
    count: regions.length,
    entries: regionEntries,
    elementAtFirstRegionCenter: summarizePointerElement(elementAtFirstRegionCenter),
    firstRegion,
    firstRegionCenter,
    hasActiveInteraction: queries.hasActiveInteraction(),
    hasActivityRegionInteraction: queries.hasActivityRegionInteraction(),
    hasEmbeddedPanelOpen: queries.hasEmbeddedPanelOpen(),
    hasFullWindowNativeShape: queries.hasFullWindowNativeShape(),
    hasPanelInteraction: queries.hasPanelInteraction(),
    hasPointerActivatedNativePetShape: queries.hasPointerActivatedNativePetShape(),
    forceFullWindowOnPetDrag: queries.hasForceFullWindowOnPetDrag(),
    hasHoveredNativePetElement: ctx.session.hasHoveredNativePetElement,
    hasStartupSuppressedNativePetShape: queries.hasStartupSuppressedNativePetShape(),
    hasSuspendedNativePetShape: queries.hasSuspendedNativePetShape(),
    isPetMotionActive: queries.hasCurrentPetMotionActive(),
    pointerLock: ctx.pointerInteractionLockRef.current,
    screen: {
      x: Math.round(window.screenX),
      y: Math.round(window.screenY),
    },
    regions: regionSummaries,
    useNativeInteractiveRegions: ctx.useNativeInteractiveRegions,
    viewport: {
      height: Math.round(window.innerHeight),
      width: Math.round(window.innerWidth),
    },
  });
}

export function pushNativeRegionDiagnostics(
  ctx: PetShellPointerContext,
  queries: PetShellInteractionQueries,
  sample: { regionEntries: RegionEntries; regions: DesktopPetInteractiveRegionLike[]; signature: string },
) {
  if (!ctx.pointerDiagnosticsEnabled) {
    return;
  }
  if (ctx.session.nativeInteractiveRegionDiagnosticsSignature === sample.signature) {
    return;
  }
  ctx.session.nativeInteractiveRegionDiagnosticsSignature = sample.signature;
  pushNativeRegionSummary(ctx, queries, sample.regionEntries, sample.regions);
  sample.regionEntries.forEach((entry, index) => {
    ctx.pushPointerDiagnosticLog('renderer native interactive region entry', {
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
