import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { getDesktopPetSlot, PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type PetConfig } from '../../types';
import {
  type AvatarRuntimeEvent,
  type AvatarRuntimeEventListener,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import {
  type AvatarRuntimeEventSummaryByPetId,
  reduceAvatarRuntimeEventSummaryByPetId,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeEventState';
import { type DirectionalExtents } from './petActivityRegionMath';
import {
  createUnityInteractionVisualBoundsEvent,
  shouldRouteAvatarRuntimeVisualBoundsEvent,
} from './petUnityVisualBoundsFiltering';

type UsePetContainerAvatarRuntimeEventHandlerOptions = {
  addLog?: ((message: string) => void) | null;
  configRef: MutableRefObject<PetConfig>;
  onCompanionVisualBoundsChange?: ((petId: string, bounds: DirectionalExtents) => void) | null;
  onPrimaryVisualBoundsChange?: ((bounds: DirectionalExtents) => void) | null;
};

type AvatarRuntimeVisualBoundsEvent = Extract<AvatarRuntimeEvent, { type: 'visual-bounds' }>;

type AvatarRuntimeVisualBoundsRouteOptions = {
  onCompanionVisualBoundsChange?: ((petId: string, bounds: DirectionalExtents) => void) | null;
  onPrimaryVisualBoundsChange?: ((bounds: DirectionalExtents) => void) | null;
};

export function routeAvatarRuntimeVisualBoundsEvent(
  event: AvatarRuntimeVisualBoundsEvent,
  {
    onCompanionVisualBoundsChange = null,
    onPrimaryVisualBoundsChange = null,
  }: AvatarRuntimeVisualBoundsRouteOptions,
) {
  if (event.petId === PRIMARY_DESKTOP_PET_SLOT_ID) {
    onPrimaryVisualBoundsChange?.(event.bounds);
    return;
  }

  onCompanionVisualBoundsChange?.(event.petId, event.bounds);
}

const TEXT_PRIMARY_PET = '\u4E3B\u5BA0';
const TEXT_COMPANION_PET = '\u966A\u4F34\u5BA0';
const TEXT_PET_FALLBACK_PREFIX = '\u5BA0\u7269';
const TEXT_RUNTIME_RECOVERED = '\u7684 3D runtime \u5DF2\u6062\u590D';
const TEXT_RUNTIME_RECOVERING = '\u7684 3D runtime \u51FA\u73B0\u5F02\u5E38\uFF0C\u6B63\u5728\u5C1D\u8BD5\u6062\u590D';

function resolveRuntimePetLabel(config: PetConfig, petId: string) {
  const slot = getDesktopPetSlot(config, petId);
  if (!slot) {
    return petId === PRIMARY_DESKTOP_PET_SLOT_ID ? TEXT_PRIMARY_PET : `${TEXT_PET_FALLBACK_PREFIX} ${petId}`;
  }

  return slot.isPrimary
    ? `${TEXT_PRIMARY_PET} ${slot.personality.name}`
    : `${TEXT_COMPANION_PET} ${slot.personality.name}`;
}

type UsePetContainerAvatarRuntimeEventHandlerResult = {
  handleAvatarRuntimeEvent: AvatarRuntimeEventListener;
  runtimeSummaryByPetId: AvatarRuntimeEventSummaryByPetId;
};

export function usePetContainerAvatarRuntimeEventHandler({
  addLog = null,
  configRef,
  onCompanionVisualBoundsChange = null,
  onPrimaryVisualBoundsChange = null,
}: UsePetContainerAvatarRuntimeEventHandlerOptions): UsePetContainerAvatarRuntimeEventHandlerResult {
  const [runtimeSummaryByPetId, setRuntimeSummaryByPetId] = useState<AvatarRuntimeEventSummaryByPetId>({});
  const runtimeSummaryByPetIdRef = useRef(runtimeSummaryByPetId);
  const ignoredUnityVisualBoundsSignatureByPetIdRef = useRef<Record<string, string>>({});

  const handleAvatarRuntimeEvent = useCallback((event: AvatarRuntimeEvent) => {
    const currentSummaryByPetId = runtimeSummaryByPetIdRef.current;
    const previousSummary = currentSummaryByPetId[event.petId];
    const nextSummaryByPetId = reduceAvatarRuntimeEventSummaryByPetId(
      currentSummaryByPetId,
      event,
    );

    if (nextSummaryByPetId !== currentSummaryByPetId) {
      runtimeSummaryByPetIdRef.current = nextSummaryByPetId;
      setRuntimeSummaryByPetId(nextSummaryByPetId);
    }

    const currentSummary = nextSummaryByPetId[event.petId];
    const petLabel = resolveRuntimePetLabel(configRef.current, event.petId);

    if (event.type === 'ready') {
      const wasRecoveringFromError = previousSummary?.status === 'error';
      if (wasRecoveringFromError) {
        addLog?.(`${petLabel}${TEXT_RUNTIME_RECOVERED}`);
      }
      return;
    }

    if (event.type === 'error') {
      const isDistinctError = previousSummary?.status !== 'error'
        || previousSummary?.lastErrorMessage !== event.errorMessage;

      if (isDistinctError) {
        addLog?.(`${petLabel}${TEXT_RUNTIME_RECOVERING}`);
      }
      return;
    }

    if (event.type === 'visual-bounds') {
      const slot = getDesktopPetSlot(configRef.current, event.petId);
      if (event.petId !== PRIMARY_DESKTOP_PET_SLOT_ID && (!slot || !slot.enabled || !slot.modelVisible)) {
        return;
      }

      const shouldRouteVisualBounds = shouldRouteAvatarRuntimeVisualBoundsEvent(event, configRef.current);
      if (!shouldRouteVisualBounds) {
        const ignoredSignature = [
          event.runtimeKind,
          event.source,
          event.bounds.left,
          event.bounds.right,
          event.bounds.top,
          event.bounds.bottom,
        ].join('|');
        if (ignoredUnityVisualBoundsSignatureByPetIdRef.current[event.petId] !== ignoredSignature) {
          ignoredUnityVisualBoundsSignatureByPetIdRef.current[event.petId] = ignoredSignature;
          pushFrontendRuntimeLog(
            'model',
            `ignored incompatible unity measured visual bounds pet=${event.petId}`,
            {
              bounds: event.bounds,
              petId: event.petId,
              runtimeKind: event.runtimeKind,
              source: event.source,
            },
          );
        }
        return;
      }

      const routedVisualBoundsEvent = slot && event.runtimeKind === 'unity'
        ? createUnityInteractionVisualBoundsEvent(
          event,
          slot.scale,
          slot.currentAction === 'WALKING' || slot.currentAction === 'RUNNING' || slot.currentAction === 'SWIMMING',
        )
        : event;

      delete ignoredUnityVisualBoundsSignatureByPetIdRef.current[event.petId];
      routeAvatarRuntimeVisualBoundsEvent(routedVisualBoundsEvent, {
        onCompanionVisualBoundsChange,
        onPrimaryVisualBoundsChange,
      });

      if (
        previousSummary?.lastVisualBoundsSource === currentSummary?.lastVisualBoundsSource
        && previousSummary?.lastVisualBoundsAt === currentSummary?.lastVisualBoundsAt
      ) {
        return;
      }

      pushFrontendRuntimeLog(
        'model',
        `avatar runtime visual bounds source pet=${event.petId} runtime=${event.runtimeKind} source=${event.source}`,
        {
          boundsSource: event.source,
          petId: event.petId,
          runtimeKind: event.runtimeKind,
        },
      );
      return;
    }

    if (
      event.type === 'motion-state-changed'
      || event.type === 'expression-state-changed'
      || event.type === 'perf-stats'
    ) {
      return;
    }
  }, [addLog, configRef, onCompanionVisualBoundsChange, onPrimaryVisualBoundsChange]);

  return {
    handleAvatarRuntimeEvent,
    runtimeSummaryByPetId,
  };
}
