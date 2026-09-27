import { type PetContentExpressionKey } from '../content/petContentManifest';
import { type PetHoverRegion } from './petHoverController';
import { type PetMessageExpressionAction } from './petMessageExpressionSignals';

export type PetHoverInteractionSource = 'hover-enter';

export type PetHoverInteractionEvent = {
  action: PetMessageExpressionAction | null;
  affectsPresentation: boolean;
  cooldownMs: number;
  durationMs: number;
  endsAtMs: number;
  expressionKey: PetContentExpressionKey | null;
  id: string;
  queuedAtMs: number;
  region: PetHoverRegion;
  source: PetHoverInteractionSource;
  startedAtMs: number;
  weightMultiplier: number;
};

export type PetHoverInteractionProfile = {
  action: PetMessageExpressionAction | null;
  affectsPresentation: boolean;
  cooldownMs: number;
  durationMs: number;
  expressionKey: PetContentExpressionKey | null;
  weightMultiplier: number;
};

export type PetHoverInteractionState = {
  activeEvent: PetHoverInteractionEvent | null;
  hasActiveEvent: boolean;
  queuedEvents: PetHoverInteractionEvent[];
  sourceRegion: PetHoverRegion | null;
};

const HOVER_INTERACTION_PROFILE_BY_REGION: Record<PetHoverRegion, PetHoverInteractionProfile> = {
  head: {
    action: 'HAPPY',
    affectsPresentation: false,
    cooldownMs: 420,
    durationMs: 1400,
    expressionKey: 'hover-head',
    weightMultiplier: 1,
  },
  body: {
    action: null,
    affectsPresentation: false,
    cooldownMs: 320,
    durationMs: 1080,
    expressionKey: 'hover-body',
    weightMultiplier: 0.52,
  },
  handL: {
    action: 'HAPPY',
    affectsPresentation: false,
    cooldownMs: 360,
    durationMs: 1180,
    expressionKey: 'hover-hand-left',
    weightMultiplier: 0.68,
  },
  handR: {
    action: 'HAPPY',
    affectsPresentation: false,
    cooldownMs: 360,
    durationMs: 1180,
    expressionKey: 'hover-hand-right',
    weightMultiplier: 0.68,
  },
};

export function resolvePetHoverInteractionProfile(region: PetHoverRegion) {
  return HOVER_INTERACTION_PROFILE_BY_REGION[region];
}

export function pruneExpiredPetHoverInteractionEvents(
  events: PetHoverInteractionEvent[],
  timestampMs: number,
) {
  return events.filter((event) => event.endsAtMs > timestampMs);
}

export function resolvePetHoverInteractionState(
  events: PetHoverInteractionEvent[],
  timestampMs: number,
  sourceRegion: PetHoverRegion | null,
): PetHoverInteractionState {
  const activeEvent = events.find((event) => (
    event.startedAtMs <= timestampMs && event.endsAtMs > timestampMs
  )) ?? null;

  return {
    activeEvent,
    hasActiveEvent: Boolean(activeEvent),
    queuedEvents: activeEvent
      ? events.filter((event) => event.id !== activeEvent.id)
      : events,
    sourceRegion,
  };
}

export function createPetHoverInteractionEvent(
  region: PetHoverRegion,
  options: {
    nowMs: number;
    sequenceStartMs?: number;
  },
): PetHoverInteractionEvent {
  const profile = resolvePetHoverInteractionProfile(region);
  const startedAtMs = Math.max(options.nowMs, options.sequenceStartMs ?? options.nowMs);

  return {
    action: profile.action,
    affectsPresentation: profile.affectsPresentation,
    cooldownMs: profile.cooldownMs,
    durationMs: profile.durationMs,
    endsAtMs: startedAtMs + profile.durationMs,
    expressionKey: profile.expressionKey,
    id: `${region}-${startedAtMs}`,
    queuedAtMs: options.nowMs,
    region,
    source: 'hover-enter',
    startedAtMs,
    weightMultiplier: profile.weightMultiplier,
  };
}
