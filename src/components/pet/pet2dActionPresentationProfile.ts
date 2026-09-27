import {
  resolvePet2DAnimationPreset,
  shouldUsePet2DSequenceMotionClass,
  type Pet2DAnimationPreset,
  type Pet2DPresentationState,
} from './pet2dPresentationState';

export type Pet2DSequencePresentationProfile = {
  frameDurationMs: number;
  isPlaying: boolean;
  useMotionPreset: boolean;
};

export type Pet2DActionPresentationProfile = {
  animationPreset: Pet2DAnimationPreset;
  sequence: Pet2DSequencePresentationProfile;
  shouldShowAutoMoveOverlay: boolean;
};

type ResolvePet2DActionPresentationProfileOptions = {
  hasAnimatedSequence?: boolean;
  isAutoMoving?: boolean;
  isExpressionSequenceActive?: boolean;
  presentationState: Pet2DPresentationState;
  scale: number;
  sequenceFrameDurationMultiplier?: number;
};

function shouldPlayPet2DSequence(
  presentationState: Pet2DPresentationState,
) {
  const { baseAction } = presentationState.actionState;
  return baseAction === 'WALKING'
    || baseAction === 'RUNNING'
    || baseAction === 'SWIMMING'
    || presentationState.visualIsMoving;
}

function resolvePet2DSequenceFrameDurationMs(
  presentationState: Pet2DPresentationState,
  durationMultiplier = 1,
) {
  const safeMultiplier = Number.isFinite(durationMultiplier) && durationMultiplier > 0
    ? durationMultiplier
    : 1;
  const { baseAction } = presentationState.actionState;

  if (baseAction === 'RUNNING') {
    return Math.max(20, Math.round(30 * safeMultiplier));
  }

  if (baseAction === 'WALKING' || presentationState.visualIsMoving) {
    return Math.max(20, Math.round(32 * safeMultiplier));
  }

  return Math.max(40, Math.round(96 * safeMultiplier));
}

export function resolvePet2DActionPresentationProfile({
  hasAnimatedSequence = false,
  isAutoMoving = false,
  isExpressionSequenceActive = false,
  presentationState,
  scale,
  sequenceFrameDurationMultiplier = 1,
}: ResolvePet2DActionPresentationProfileOptions): Pet2DActionPresentationProfile {
  const useSequenceMotionPreset = hasAnimatedSequence
    && shouldUsePet2DSequenceMotionClass(presentationState);

  return {
    animationPreset: resolvePet2DAnimationPreset(
      presentationState,
      scale,
      useSequenceMotionPreset,
    ),
    sequence: {
      frameDurationMs: resolvePet2DSequenceFrameDurationMs(
        presentationState,
        sequenceFrameDurationMultiplier,
      ),
      isPlaying: hasAnimatedSequence
        && (isExpressionSequenceActive || shouldPlayPet2DSequence(presentationState)),
      useMotionPreset: useSequenceMotionPreset,
    },
    shouldShowAutoMoveOverlay: isAutoMoving && presentationState.visualIsMoving,
  };
}
