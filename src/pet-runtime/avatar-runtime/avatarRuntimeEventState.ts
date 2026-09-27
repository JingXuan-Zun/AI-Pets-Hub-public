import { type PetVisualBounds } from '../../components/pet/petVisualBounds';
import {
  type AvatarRuntimeEvent,
  type AvatarRuntimePerfStats,
  type AvatarRuntimeVisualBoundsSource,
} from './avatarRuntimeEvents';
import { type AvatarRuntimeKind } from './avatarRuntimeTypes';

export type AvatarRuntimeEventStatus = 'error' | 'idle' | 'ready';

export type AvatarRuntimePetEventSummary = {
  lastExpressionKey: string | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  lastEventAt: number | null;
  lastEventType: AvatarRuntimeEvent['type'] | null;
  lastMotionKey: string | null;
  lastPerfStats: AvatarRuntimePerfStats | null;
  lastReadyAt: number | null;
  lastVisualBounds: PetVisualBounds | null;
  lastVisualBoundsAt: number | null;
  lastVisualBoundsSource: AvatarRuntimeVisualBoundsSource | null;
  petId: string;
  runtimeKind: AvatarRuntimeKind;
  status: AvatarRuntimeEventStatus;
};

export type AvatarRuntimeEventSummaryByPetId = Record<string, AvatarRuntimePetEventSummary>;

export function createAvatarRuntimePetEventSummary(
  petId: string,
  runtimeKind: AvatarRuntimeKind,
): AvatarRuntimePetEventSummary {
  return {
    lastExpressionKey: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastEventAt: null,
    lastEventType: null,
    lastMotionKey: null,
    lastPerfStats: null,
    lastReadyAt: null,
    lastVisualBounds: null,
    lastVisualBoundsAt: null,
    lastVisualBoundsSource: null,
    petId,
    runtimeKind,
    status: 'idle',
  };
}

function arePetVisualBoundsEqual(left: PetVisualBounds | null, right: PetVisualBounds | null) {
  return left?.left === right?.left
    && left?.right === right?.right
    && left?.top === right?.top
    && left?.bottom === right?.bottom;
}

function areAvatarRuntimePerfStatsEqual(
  left: AvatarRuntimePerfStats | null,
  right: AvatarRuntimePerfStats | null,
) {
  return left?.fps === right?.fps
    && left?.frameIntervalMs === right?.frameIntervalMs;
}

export function reduceAvatarRuntimePetEventSummary(
  current: AvatarRuntimePetEventSummary | undefined,
  event: AvatarRuntimeEvent,
  eventTime = Date.now(),
): AvatarRuntimePetEventSummary {
  const previous = current ?? createAvatarRuntimePetEventSummary(event.petId, event.runtimeKind);
  const baseNext: AvatarRuntimePetEventSummary = {
    ...previous,
    lastEventAt: eventTime,
    lastEventType: event.type,
    petId: event.petId,
    runtimeKind: event.runtimeKind,
  };

  if (event.type === 'ready') {
    return {
      ...baseNext,
      lastErrorMessage: null,
      lastReadyAt: eventTime,
      status: 'ready',
    };
  }

  if (event.type === 'error') {
    return {
      ...baseNext,
      lastErrorAt: eventTime,
      lastErrorMessage: event.errorMessage,
      status: 'error',
    };
  }

  if (event.type === 'visual-bounds') {
    if (
      previous.lastVisualBoundsSource === event.source
      && arePetVisualBoundsEqual(previous.lastVisualBounds, event.bounds)
    ) {
      return previous;
    }

    return {
      ...baseNext,
      lastVisualBounds: event.bounds,
      lastVisualBoundsAt: eventTime,
      lastVisualBoundsSource: event.source,
    };
  }

  if (event.type === 'motion-state-changed') {
    return {
      ...baseNext,
      lastMotionKey: event.motionKey,
    };
  }

  if (event.type === 'expression-state-changed') {
    return {
      ...baseNext,
      lastExpressionKey: event.expressionKey,
    };
  }

  if (event.type === 'perf-stats') {
    return {
      ...baseNext,
      lastPerfStats: {
        fps: event.fps ?? null,
        frameIntervalMs: event.frameIntervalMs ?? null,
      },
    };
  }

  return baseNext;
}

function areAvatarRuntimePetEventSummariesEqual(
  left: AvatarRuntimePetEventSummary,
  right: AvatarRuntimePetEventSummary,
) {
  return left.petId === right.petId
    && left.runtimeKind === right.runtimeKind
    && left.status === right.status
    && left.lastEventType === right.lastEventType
    && left.lastEventAt === right.lastEventAt
    && left.lastReadyAt === right.lastReadyAt
    && left.lastErrorAt === right.lastErrorAt
    && left.lastErrorMessage === right.lastErrorMessage
    && left.lastMotionKey === right.lastMotionKey
    && left.lastExpressionKey === right.lastExpressionKey
    && areAvatarRuntimePerfStatsEqual(left.lastPerfStats, right.lastPerfStats)
    && left.lastVisualBoundsAt === right.lastVisualBoundsAt
    && left.lastVisualBoundsSource === right.lastVisualBoundsSource
    && arePetVisualBoundsEqual(left.lastVisualBounds, right.lastVisualBounds);
}

export function reduceAvatarRuntimeEventSummaryByPetId(
  current: AvatarRuntimeEventSummaryByPetId,
  event: AvatarRuntimeEvent,
  eventTime = Date.now(),
): AvatarRuntimeEventSummaryByPetId {
  const currentSummary = current[event.petId];
  const nextSummary = reduceAvatarRuntimePetEventSummary(currentSummary, event, eventTime);
  if (currentSummary && areAvatarRuntimePetEventSummariesEqual(currentSummary, nextSummary)) {
    return current;
  }

  return {
    ...current,
    [event.petId]: nextSummary,
  };
}
