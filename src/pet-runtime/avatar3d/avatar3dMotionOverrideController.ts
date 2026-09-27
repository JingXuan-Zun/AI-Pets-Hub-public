import { type PetAction } from '../../types';
import {
  resolvePetContentMotionOverrideBehavior,
  type PetContentManifest,
  type PetContentMotionKey,
  type PetContentReactionActionKey,
} from '../content/petContentManifest';
import {
  resolvePetActionEmotionMode,
  resolvePetActionMotionMode,
  type PetActionMotionOverrideMode,
} from '../core/petActionStateMachine';
import { type Avatar3DExpressionControllerState } from './avatar3dExpressionController';
import { type Avatar3DLipSyncControllerState } from './avatar3dLipSyncController';

export type Avatar3DMotionOverrideSource =
  | 'fallback'
  | 'hover'
  | 'manual'
  | 'message'
  | 'speaking'
  | 'state-machine'
  | 'none';

export type Avatar3DMotionOverrideState = {
  baseMotionKey: PetContentMotionKey;
  lockMsMin: number;
  mode: PetActionMotionOverrideMode;
  overrideMotionKey: PetContentMotionKey | null;
  playbackRateMultiplier: number;
  priorityBoost: number;
  resolvedMotionKey: PetContentMotionKey;
  source: Avatar3DMotionOverrideSource;
};

type CreateMotionOverrideStateInput = {
  baseMotionKey: PetContentMotionKey;
  lockMsMin?: number;
  mode: PetActionMotionOverrideMode;
  overrideMotionKey?: PetContentMotionKey | null;
  playbackRateMultiplier?: number;
  priorityBoost?: number;
  source: Avatar3DMotionOverrideSource;
};

const MOTION_OVERRIDE_SOURCE_PRIORITY: Record<Avatar3DMotionOverrideSource, number> = {
  none: 0,
  'state-machine': 1,
  speaking: 2,
  manual: 2,
  hover: 3,
  fallback: 4,
  message: 5,
};

type ResolveAvatar3DMotionOverrideStateOptions = {
  action?: PetAction;
  contentManifest?: PetContentManifest | null;
  expressionState?: Avatar3DExpressionControllerState;
  isMoving?: boolean;
  lipSyncState?: Avatar3DLipSyncControllerState;
};

function resolveActionMotionKey(action: PetAction, isMoving: boolean) {
  const emotionMode = resolvePetActionEmotionMode(action);
  if (emotionMode === 'eating') {
    return 'eating';
  }

  if (emotionMode === 'happy') {
    return 'happy';
  }

  if (emotionMode === 'sad') {
    return 'sad';
  }

  if (emotionMode === 'sleeping') {
    return 'sleeping';
  }

  const motionMode = resolvePetActionMotionMode(action);
  if (motionMode === 'running') {
    return 'running';
  }

  if (motionMode === 'walking') {
    return 'walking';
  }

  if (motionMode === 'swimming') {
    return 'swimming';
  }

  return isMoving ? 'moving' : 'idle';
}

function resolveExpressionMotionKey(action: PetAction | null | undefined) {
  if (!action) {
    return null;
  }

  return resolveActionMotionKey(action, false);
}

function createMotionOverrideState({
  baseMotionKey,
  lockMsMin = 0,
  mode,
  overrideMotionKey = null,
  playbackRateMultiplier = 1,
  priorityBoost = 0,
  source,
}: CreateMotionOverrideStateInput) {
  return {
    baseMotionKey,
    lockMsMin,
    mode,
    overrideMotionKey,
    playbackRateMultiplier,
    priorityBoost,
    resolvedMotionKey: mode === 'replace'
      ? (overrideMotionKey ?? baseMotionKey)
      : mode === 'soft-stop'
        ? (overrideMotionKey ?? 'idle')
        : baseMotionKey,
    source,
  } satisfies Avatar3DMotionOverrideState;
}

function resolveExpressionActionKey(
  action: PetAction | null | undefined,
): PetContentReactionActionKey | null {
  if (action === 'EATING') {
    return 'eating';
  }

  if (action === 'HAPPY') {
    return 'happy';
  }

  if (action === 'SAD') {
    return 'sad';
  }

  if (action === 'SLEEPING') {
    return 'sleeping';
  }

  return null;
}

function applyConfiguredMotionOverrideState(
  state: Avatar3DMotionOverrideState,
  contentManifest: PetContentManifest | null | undefined,
  actionKey: PetContentReactionActionKey | null,
  isMoving: boolean,
) {
  if (state.source === 'manual' || state.source === 'state-machine' || state.source === 'none') {
    return state;
  }

  const configuredBehavior = resolvePetContentMotionOverrideBehavior(
    contentManifest,
    state.source,
    actionKey,
    isMoving,
  );

  if (!configuredBehavior) {
    return state;
  }

  return createMotionOverrideState({
    baseMotionKey: state.baseMotionKey,
    lockMsMin: configuredBehavior.lockMsMin ?? state.lockMsMin,
    mode: configuredBehavior.mode ?? state.mode,
    overrideMotionKey: configuredBehavior.overrideMotionKey ?? state.overrideMotionKey,
    playbackRateMultiplier: configuredBehavior.playbackRateMultiplier ?? state.playbackRateMultiplier,
    priorityBoost: configuredBehavior.priorityBoost ?? state.priorityBoost,
    source: state.source,
  });
}

function resolveMotionOverrideModePriority(mode: PetActionMotionOverrideMode) {
  if (mode === 'replace') {
    return 3;
  }

  if (mode === 'soft-stop') {
    return 2;
  }

  return 1;
}

function resolveMotionOverridePriorityScore(state: Avatar3DMotionOverrideState) {
  return (
    MOTION_OVERRIDE_SOURCE_PRIORITY[state.source] * 100
    + resolveMotionOverrideModePriority(state.mode) * 10
    + Math.max(0, state.priorityBoost)
  );
}

function mergeMotionOverrideStates(
  primaryState: Avatar3DMotionOverrideState,
  overlayState: Avatar3DMotionOverrideState,
) {
  const primaryPriority = resolveMotionOverridePriorityScore(primaryState);
  const overlayPriority = resolveMotionOverridePriorityScore(overlayState);
  const dominantState = overlayPriority > primaryPriority
    ? overlayState
    : primaryState;
  const secondaryState = dominantState === primaryState
    ? overlayState
    : primaryState;

  if (secondaryState.mode !== 'preserve') {
    return dominantState;
  }

  return createMotionOverrideState({
    baseMotionKey: dominantState.baseMotionKey,
    lockMsMin: Math.max(dominantState.lockMsMin, secondaryState.lockMsMin),
    mode: dominantState.mode,
    overrideMotionKey: dominantState.overrideMotionKey,
    playbackRateMultiplier: Number((
      dominantState.playbackRateMultiplier
      * secondaryState.playbackRateMultiplier
    ).toFixed(3)),
    priorityBoost: dominantState.priorityBoost + Math.max(0, secondaryState.priorityBoost),
    source: dominantState.source,
  });
}

export function resolveAvatar3DMotionOverrideState({
  action = 'IDLE',
  contentManifest = null,
  expressionState,
  isMoving = false,
  lipSyncState,
}: ResolveAvatar3DMotionOverrideStateOptions): Avatar3DMotionOverrideState {
  const baseMotionKey = resolveActionMotionKey(action, isMoving);
  const expressionSource = expressionState?.source ?? 'none';
  const expressionAction = expressionState?.activeAction ?? null;
  const expressionActionKey = resolveExpressionActionKey(expressionAction);
  const expressionMotionKey = resolveExpressionMotionKey(expressionAction);
  const baseActionIsLocked = baseMotionKey === 'eating' || baseMotionKey === 'sleeping';
  const hasBaseLocomotion = baseMotionKey === 'moving'
    || baseMotionKey === 'walking'
    || baseMotionKey === 'running'
    || baseMotionKey === 'swimming';

  if (expressionSource === 'hover') {
    return applyConfiguredMotionOverrideState(createMotionOverrideState({
      baseMotionKey,
      mode: 'preserve',
      overrideMotionKey: expressionMotionKey,
      playbackRateMultiplier: hasBaseLocomotion ? 0.98 : 0.96,
      source: 'hover',
    }), contentManifest, expressionActionKey, isMoving);
  }

  if (expressionSource === 'manual') {
    return createMotionOverrideState({
      baseMotionKey,
      mode: 'preserve',
      source: 'state-machine',
    });
  }

  const speakingOverlayState = lipSyncState?.isActive
    ? applyConfiguredMotionOverrideState(createMotionOverrideState({
      baseMotionKey,
      mode: 'preserve',
      playbackRateMultiplier: hasBaseLocomotion ? 0.99 : 0.97,
      source: 'speaking',
    }), contentManifest, null, isMoving)
    : null;

  if (expressionAction === 'EATING' && expressionMotionKey) {
    const expressionState = applyConfiguredMotionOverrideState(createMotionOverrideState({
      baseMotionKey,
      lockMsMin: 320,
      mode: 'replace',
      overrideMotionKey: expressionMotionKey,
      playbackRateMultiplier: 0.96,
      priorityBoost: 18,
      source: expressionSource === 'none' ? 'fallback' : expressionSource,
    }), contentManifest, expressionActionKey, isMoving);

    return speakingOverlayState
      ? mergeMotionOverrideStates(expressionState, speakingOverlayState)
      : expressionState;
  }

  if (expressionAction === 'SLEEPING' && expressionMotionKey) {
    const expressionState = applyConfiguredMotionOverrideState(createMotionOverrideState({
      baseMotionKey,
      lockMsMin: 720,
      mode: 'replace',
      overrideMotionKey: expressionMotionKey,
      playbackRateMultiplier: 0.9,
      priorityBoost: 24,
      source: expressionSource === 'none' ? 'fallback' : expressionSource,
    }), contentManifest, expressionActionKey, isMoving);

    return speakingOverlayState
      ? mergeMotionOverrideStates(expressionState, speakingOverlayState)
      : expressionState;
  }

  if (baseActionIsLocked && expressionAction) {
    const expressionState = applyConfiguredMotionOverrideState(createMotionOverrideState({
      baseMotionKey,
      mode: 'preserve',
      overrideMotionKey: expressionMotionKey,
      playbackRateMultiplier: 0.96,
      source: expressionSource === 'none' ? 'state-machine' : expressionSource,
    }), contentManifest, expressionActionKey, isMoving);

    return speakingOverlayState
      ? mergeMotionOverrideStates(expressionState, speakingOverlayState)
      : expressionState;
  }

  if ((expressionAction === 'HAPPY' || expressionAction === 'SAD') && expressionMotionKey) {
    if (hasBaseLocomotion) {
      const expressionState = applyConfiguredMotionOverrideState(createMotionOverrideState({
        baseMotionKey,
        mode: 'preserve',
        overrideMotionKey: expressionMotionKey,
        playbackRateMultiplier: expressionAction === 'SAD' ? 0.94 : 0.98,
        source: expressionSource === 'none' ? 'message' : expressionSource,
      }), contentManifest, expressionActionKey, isMoving);

      return speakingOverlayState
        ? mergeMotionOverrideStates(expressionState, speakingOverlayState)
        : expressionState;
    }

    const expressionState = applyConfiguredMotionOverrideState(createMotionOverrideState({
      baseMotionKey,
      lockMsMin: expressionSource === 'message' ? 180 : 120,
      mode: 'replace',
      overrideMotionKey: expressionMotionKey,
      playbackRateMultiplier: expressionAction === 'SAD' ? 0.92 : 1.02,
      priorityBoost: expressionAction === 'SAD' ? 10 : 8,
      source: expressionSource === 'none' ? 'message' : expressionSource,
    }), contentManifest, expressionActionKey, isMoving);

    return speakingOverlayState
      ? mergeMotionOverrideStates(expressionState, speakingOverlayState)
      : expressionState;
  }

  if (speakingOverlayState) {
    return speakingOverlayState;
  }

  return createMotionOverrideState({
    baseMotionKey,
    mode: 'preserve',
    source: 'state-machine',
  });
}
