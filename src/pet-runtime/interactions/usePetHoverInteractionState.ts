import { useEffect, useMemo, useRef, useState } from 'react';
import { type PetHoverState } from './petHoverController';
import {
  createPetHoverInteractionEvent,
  pruneExpiredPetHoverInteractionEvents,
  resolvePetHoverInteractionState,
  type PetHoverInteractionEvent,
} from './petHoverInteractionController';

type UsePetHoverInteractionStateOptions = {
  enabled?: boolean;
  hoverState?: PetHoverState;
};

export function usePetHoverInteractionState({
  enabled = true,
  hoverState,
}: UsePetHoverInteractionStateOptions) {
  const [events, setEvents] = useState<PetHoverInteractionEvent[]>([]);
  const [timestampMs, setTimestampMs] = useState(() => Date.now());
  const activeRegion = hoverState?.activeRegion ?? null;
  const cooldownUntilByRegionRef = useRef<Record<string, number>>({});
  const previousRegionRef = useRef(activeRegion);

  useEffect(() => {
    if (!enabled) {
      previousRegionRef.current = null;
      cooldownUntilByRegionRef.current = {};
      setEvents([]);
      setTimestampMs(Date.now());
      return;
    }

    const nowMs = Date.now();
    const previousRegion = previousRegionRef.current;
    previousRegionRef.current = activeRegion;
    setTimestampMs(nowMs);

    if (!activeRegion || activeRegion === previousRegion) {
      setEvents((currentEvents) => pruneExpiredPetHoverInteractionEvents(currentEvents, nowMs));
      return;
    }

    const cooldownUntilMs = cooldownUntilByRegionRef.current[activeRegion] ?? 0;
    if (cooldownUntilMs > nowMs) {
      setEvents((currentEvents) => pruneExpiredPetHoverInteractionEvents(currentEvents, nowMs));
      return;
    }

    setEvents((currentEvents) => {
      const prunedEvents = pruneExpiredPetHoverInteractionEvents(currentEvents, nowMs);
      const sequenceStartMs = prunedEvents[prunedEvents.length - 1]?.endsAtMs ?? nowMs;
      const nextEvent = createPetHoverInteractionEvent(activeRegion, {
        nowMs,
        sequenceStartMs,
      });
      cooldownUntilByRegionRef.current[activeRegion] = nowMs + nextEvent.cooldownMs;

      return [...prunedEvents, nextEvent];
    });
  }, [activeRegion, enabled]);

  useEffect(() => {
    if (!events.length) {
      return;
    }

    const nowMs = Date.now();
    const nextTransitionMs = events.reduce((closestTimestamp, event) => {
      if (event.endsAtMs <= nowMs) {
        return closestTimestamp;
      }

      return Math.min(closestTimestamp, event.endsAtMs);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nextTransitionMs)) {
      return;
    }

    const timeoutMs = Math.max(16, nextTransitionMs - nowMs);
    const timeoutId = window.setTimeout(() => {
      const nextTimestampMs = Date.now();
      setTimestampMs(nextTimestampMs);
      setEvents((currentEvents) => pruneExpiredPetHoverInteractionEvents(currentEvents, nextTimestampMs));
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [events]);

  return useMemo(() => resolvePetHoverInteractionState(
    events,
    timestampMs,
    activeRegion,
  ), [activeRegion, events, timestampMs]);
}
