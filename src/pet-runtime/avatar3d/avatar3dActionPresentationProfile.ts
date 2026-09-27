import { type PetActionStateMachineSnapshot } from '../core/petActionStateMachine';
import { type Avatar3DInteractionControllerState } from './avatar3dInteractionController';

export type Avatar3DVisualMode =
  | 'idle'
  | 'moving'
  | 'running'
  | 'walking'
  | 'swimming'
  | 'eating'
  | 'happy'
  | 'sad'
  | 'sleeping'
  | 'hover-head'
  | 'hover-body'
  | 'hover-hand-left'
  | 'hover-hand-right';

export type Avatar3DPresentationProfile = {
  animationDurationMs: number;
  lowOpacity: number;
  scaleBase: number;
  scalePeak: number;
  visualMode: Avatar3DVisualMode;
  wrapperClassName: string;
  wrapperClassSource: 'interaction' | 'state-machine';
};

function resolveAvatar3DStateMachineVisualMode(
  snapshot: PetActionStateMachineSnapshot,
): Avatar3DVisualMode {
  if (snapshot.visualEmotionMode === 'eating') {
    return 'eating';
  }

  if (snapshot.visualEmotionMode === 'happy') {
    return 'happy';
  }

  if (snapshot.visualEmotionMode === 'sad') {
    return 'sad';
  }

  if (snapshot.visualEmotionMode === 'sleeping') {
    return 'sleeping';
  }

  if (snapshot.visualMotionMode === 'running') {
    return 'running';
  }

  if (snapshot.visualMotionMode === 'walking') {
    return 'walking';
  }

  if (snapshot.visualMotionMode === 'swimming') {
    return 'swimming';
  }

  if (snapshot.visualIsMoving) {
    return 'moving';
  }

  return 'idle';
}

function resolveAvatar3DStateMachinePresentationProfile(
  visualMode: Avatar3DVisualMode,
): Avatar3DPresentationProfile {
  switch (visualMode) {
    case 'running':
      return {
        animationDurationMs: 640,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.065,
        visualMode,
        wrapperClassName: 'pet-anim-running',
        wrapperClassSource: 'state-machine',
      };
    case 'walking':
      return {
        animationDurationMs: 900,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.048,
        visualMode,
        wrapperClassName: 'pet-anim-walking',
        wrapperClassSource: 'state-machine',
      };
    case 'swimming':
      return {
        animationDurationMs: 1480,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.032,
        visualMode,
        wrapperClassName: 'pet-anim-swimming',
        wrapperClassSource: 'state-machine',
      };
    case 'eating':
      return {
        animationDurationMs: 1120,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.052,
        visualMode,
        wrapperClassName: 'pet-anim-eating',
        wrapperClassSource: 'state-machine',
      };
    case 'happy':
      return {
        animationDurationMs: 820,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.08,
        visualMode,
        wrapperClassName: 'pet-anim-happy',
        wrapperClassSource: 'state-machine',
      };
    case 'sad':
      return {
        animationDurationMs: 1880,
        lowOpacity: 0.8,
        scaleBase: 1,
        scalePeak: 1.04,
        visualMode,
        wrapperClassName: 'pet-anim-sad',
        wrapperClassSource: 'state-machine',
      };
    case 'sleeping':
      return {
        animationDurationMs: 2480,
        lowOpacity: 0.8,
        scaleBase: 1,
        scalePeak: 1.028,
        visualMode,
        wrapperClassName: 'pet-anim-sleeping',
        wrapperClassSource: 'state-machine',
      };
    case 'moving':
      return {
        animationDurationMs: 760,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.04,
        visualMode,
        wrapperClassName: 'pet-anim-moving',
        wrapperClassSource: 'state-machine',
      };
    case 'idle':
      return {
        animationDurationMs: 2200,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.04,
        visualMode,
        wrapperClassName: 'pet-anim-idle',
        wrapperClassSource: 'state-machine',
      };
    default:
      return {
        animationDurationMs: 2200,
        lowOpacity: 1,
        scaleBase: 1,
        scalePeak: 1.04,
        visualMode: 'idle',
        wrapperClassName: 'pet-anim-idle',
        wrapperClassSource: 'state-machine',
      };
  }
}

function resolveAvatar3DInteractionPresentationProfile(
  snapshot: PetActionStateMachineSnapshot,
  interactionState?: Avatar3DInteractionControllerState,
): Avatar3DPresentationProfile | null {
  if (!interactionState?.hasActiveInteraction) {
    return null;
  }

  if (snapshot.requestedIsMoving || snapshot.isExpressionLocked || snapshot.baseAction !== 'IDLE') {
    return null;
  }

  const presentationWeight = Math.min(1.2, Math.max(0.5, interactionState.presentationWeight));

  switch (interactionState.sourceRegion) {
    case 'head':
      return {
        animationDurationMs: Math.round(1180 - presentationWeight * 110),
        lowOpacity: 1,
        scaleBase: 1.012,
        scalePeak: Number((1.062 + presentationWeight * 0.018).toFixed(3)),
        visualMode: 'hover-head',
        wrapperClassName: 'pet-anim-hover-head',
        wrapperClassSource: 'interaction',
      };
    case 'body':
      return {
        animationDurationMs: Math.round(1500 - presentationWeight * 80),
        lowOpacity: 0.94,
        scaleBase: 1.004,
        scalePeak: Number((1.022 + presentationWeight * 0.014).toFixed(3)),
        visualMode: 'hover-body',
        wrapperClassName: 'pet-anim-hover-body',
        wrapperClassSource: 'interaction',
      };
    case 'handL':
      return {
        animationDurationMs: Math.round(1040 - presentationWeight * 70),
        lowOpacity: 1,
        scaleBase: 1.008,
        scalePeak: Number((1.036 + presentationWeight * 0.02).toFixed(3)),
        visualMode: 'hover-hand-left',
        wrapperClassName: 'pet-anim-hover-hand-left',
        wrapperClassSource: 'interaction',
      };
    case 'handR':
      return {
        animationDurationMs: Math.round(1040 - presentationWeight * 70),
        lowOpacity: 1,
        scaleBase: 1.008,
        scalePeak: Number((1.036 + presentationWeight * 0.02).toFixed(3)),
        visualMode: 'hover-hand-right',
        wrapperClassName: 'pet-anim-hover-hand-right',
        wrapperClassSource: 'interaction',
      };
    default:
      return null;
  }
}

export function resolveAvatar3DPresentationProfile(
  snapshot: PetActionStateMachineSnapshot,
  interactionState?: Avatar3DInteractionControllerState,
): Avatar3DPresentationProfile {
  return resolveAvatar3DInteractionPresentationProfile(snapshot, interactionState)
    ?? resolveAvatar3DStateMachinePresentationProfile(resolveAvatar3DStateMachineVisualMode(snapshot));
}
