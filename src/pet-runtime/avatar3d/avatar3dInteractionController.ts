import { type PetHoverRegion } from '../interactions/petHoverController';
import {
  type PetHoverInteractionSource,
  type PetHoverInteractionState,
} from '../interactions/petHoverInteractionController';

export type Avatar3DInteractionControllerState = {
  autoRotateMultiplier: number;
  focusLerp: number;
  hasActiveInteraction: boolean;
  idlePitchOffset: number;
  pitchScale: number;
  presentationWeight: number;
  rollOffset: number;
  source: PetHoverInteractionSource | 'none';
  sourceRegion: PetHoverRegion | null;
  yawScale: number;
};

type InteractionProfile = Omit<
  Avatar3DInteractionControllerState,
  'hasActiveInteraction' | 'presentationWeight' | 'source' | 'sourceRegion'
>;

const DEFAULT_INTERACTION_CONTROLLER_STATE: Avatar3DInteractionControllerState = {
  autoRotateMultiplier: 0,
  focusLerp: 0.12,
  hasActiveInteraction: false,
  idlePitchOffset: 0,
  pitchScale: 0,
  presentationWeight: 1,
  rollOffset: 0,
  source: 'none',
  sourceRegion: null,
  yawScale: 0,
};

const INTERACTION_PROFILE_BY_REGION: Record<PetHoverRegion, InteractionProfile> = {
  head: {
    autoRotateMultiplier: 0,
    focusLerp: 0.2,
    idlePitchOffset: 0,
    pitchScale: 0,
    rollOffset: 0,
    yawScale: 0,
  },
  body: {
    autoRotateMultiplier: 0,
    focusLerp: 0.14,
    idlePitchOffset: 0,
    pitchScale: 0,
    rollOffset: 0,
    yawScale: 0,
  },
  handL: {
    autoRotateMultiplier: 0,
    focusLerp: 0.19,
    idlePitchOffset: 0,
    pitchScale: 0,
    rollOffset: 0,
    yawScale: 0,
  },
  handR: {
    autoRotateMultiplier: 0,
    focusLerp: 0.19,
    idlePitchOffset: 0,
    pitchScale: 0,
    rollOffset: 0,
    yawScale: 0,
  },
};

export function resolveAvatar3DInteractionControllerState(
  hoverInteractionState?: PetHoverInteractionState,
): Avatar3DInteractionControllerState {
  const activeEvent = hoverInteractionState?.activeEvent;
  if (!activeEvent) {
    return DEFAULT_INTERACTION_CONTROLLER_STATE;
  }

  const profile = INTERACTION_PROFILE_BY_REGION[activeEvent.region];

  return {
    ...profile,
    hasActiveInteraction: true,
    presentationWeight: activeEvent.weightMultiplier,
    source: activeEvent.source,
    sourceRegion: activeEvent.region,
  };
}
