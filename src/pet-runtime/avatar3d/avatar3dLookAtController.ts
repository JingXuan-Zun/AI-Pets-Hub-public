import * as THREE from 'three';
import { type VRM } from '@pixiv/three-vrm';
import { type Avatar3DRuntimeFrameState } from './avatar3dRuntimeInstance';
import {
  POINTER_LOOK_HEAD_HORIZON_Y,
  resolvePointerLookNormalizedTarget,
} from '../interactions/pointerLookTargetNormalization';
import { clampPetPointerLookStrength } from '../interactions/petPointerLookPriority';
import {
  resolvePetPerformanceLookInput,
  type PetPerformanceLookInputSource,
} from '../interactions/petPerformanceLookInput';

export type Avatar3DLookAtDebugSummary = {
  hasLookAt: boolean;
  mode: 'vrm' | 'none';
};

const LOOK_AT_HORIZONTAL_DIVISOR = 14;
const LOOK_AT_VERTICAL_DIVISOR = 21;
const LOOK_AT_TARGET_DISTANCE = 0.72;
const LOOK_AT_HORIZONTAL_OFFSET = 0.22;
const LOOK_AT_VERTICAL_OFFSET = 0.16;
const LOOK_AT_TRACKING_LERP = 0.18;
const LOOK_AT_CENTERING_LERP = 0.12;
const FOCUS_FALLBACK_LOOK_AT_LERP = 0.12;
const FOCUS_FALLBACK_HORIZONTAL_SCALE = 0.82;
const FOCUS_FALLBACK_VERTICAL_SCALE = 0.72;

type Avatar3DLookAtProfile = {
  focusLerp: number;
  horizontalScale: number;
  verticalScale: number;
};

type Avatar3DLookAtInput = {
  source: PetPerformanceLookInputSource;
  target: {
    x: number;
    y: number;
  } | null;
};

const DEFAULT_LOOK_AT_PROFILE: Avatar3DLookAtProfile = {
  focusLerp: LOOK_AT_TRACKING_LERP,
  horizontalScale: 1,
  verticalScale: 1,
};

const FOCUS_FALLBACK_LOOK_AT_PROFILE: Avatar3DLookAtProfile = {
  focusLerp: FOCUS_FALLBACK_LOOK_AT_LERP,
  horizontalScale: FOCUS_FALLBACK_HORIZONTAL_SCALE,
  verticalScale: FOCUS_FALLBACK_VERTICAL_SCALE,
};

const LOOK_AT_PROFILE_BY_REGION: Record<string, Avatar3DLookAtProfile> = {
  body: {
    focusLerp: 0.16,
    horizontalScale: 0.68,
    verticalScale: 0.42,
  },
  handL: {
    focusLerp: 0.2,
    horizontalScale: 0.82,
    verticalScale: 0.58,
  },
  handR: {
    focusLerp: 0.2,
    horizontalScale: 0.82,
    verticalScale: 0.58,
  },
  head: {
    focusLerp: 0.24,
    horizontalScale: 1,
    verticalScale: 0.92,
  },
};

export function resolveAvatar3DLookAtFocusTarget(frameState?: Avatar3DRuntimeFrameState) {
  return resolveAvatar3DLookAtInput(frameState).target;
}

export function resolveAvatar3DLookAtInput(frameState?: Avatar3DRuntimeFrameState): Avatar3DLookAtInput {
  const focusTarget = frameState?.hoverState?.activeRegion && frameState.hoverState.focusTarget
    ? frameState.hoverState.focusTarget
    : frameState?.focusTarget ?? frameState?.hoverState?.focusTarget ?? null;

  return resolvePetPerformanceLookInput({
    focusTarget,
    pointerLookTarget: frameState?.pointerLookTarget,
  });
}

export function resolveAvatar3DLookAtProfile(frameState?: Avatar3DRuntimeFrameState): Avatar3DLookAtProfile {
  const activeRegion = frameState?.hoverState?.activeRegion ?? null;
  const lookInput = resolveAvatar3DLookAtInput(frameState);
  const interactionState = frameState?.reactionState?.interactionState;
  const fallbackProfile = activeRegion
    ? (LOOK_AT_PROFILE_BY_REGION[activeRegion] ?? DEFAULT_LOOK_AT_PROFILE)
    : lookInput.source === 'focus'
      ? FOCUS_FALLBACK_LOOK_AT_PROFILE
    : DEFAULT_LOOK_AT_PROFILE;

  return {
    focusLerp: THREE.MathUtils.clamp(
      interactionState?.focusLerp ?? fallbackProfile.focusLerp,
      0.08,
      0.36,
    ),
    horizontalScale: THREE.MathUtils.clamp(
      interactionState?.yawScale || fallbackProfile.horizontalScale,
      0.35,
      1.2,
    ),
    verticalScale: THREE.MathUtils.clamp(
      interactionState?.pitchScale || fallbackProfile.verticalScale,
      0.25,
      1.1,
    ),
  };
}

export function resolveNormalizedAvatar3DLookAtFocusTarget(frameState?: Avatar3DRuntimeFrameState) {
  const lookInput = resolveAvatar3DLookAtInput(frameState);
  const focusTarget = lookInput.target;
  if (!focusTarget) {
    return null;
  }

  const profile = resolveAvatar3DLookAtProfile(frameState);
  const isPointerLookTarget = lookInput.source === 'pointer';
  const pointerLookStrength = isPointerLookTarget
    ? clampPetPointerLookStrength(frameState?.pointerLookStrength ?? 1)
    : 1;
  const normalizedTarget = resolvePointerLookNormalizedTarget(
    {
      x: focusTarget.x * profile.horizontalScale,
      y: focusTarget.y * profile.verticalScale,
    },
    {
      neutralY: isPointerLookTarget
        ? POINTER_LOOK_HEAD_HORIZON_Y * profile.verticalScale
        : 0,
      xDivisor: LOOK_AT_HORIZONTAL_DIVISOR,
      yDivisor: LOOK_AT_VERTICAL_DIVISOR,
    },
  );

  if (!normalizedTarget || pointerLookStrength === 1) {
    return normalizedTarget;
  }

  return {
    x: normalizedTarget.x * pointerLookStrength,
    y: normalizedTarget.y * pointerLookStrength,
  };
}

export function createVRMLookAtDebugSummary(vrm: VRM): Avatar3DLookAtDebugSummary {
  return {
    hasLookAt: Boolean(vrm.lookAt),
    mode: vrm.lookAt ? 'vrm' : 'none',
  };
}

export function createVRMLookAtFrameApplier(vrm: VRM) {
  const lookAt = vrm.lookAt;
  if (!lookAt) {
    return (_frameState?: Avatar3DRuntimeFrameState) => {};
  }

  lookAt.autoUpdate = false;

  const lookAtOrigin = new THREE.Vector3();
  const lookAtRotation = new THREE.Quaternion();
  const lookAtOffset = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const smoothedTarget = new THREE.Vector3();
  let hasSmoothedTarget = false;

  return (frameState?: Avatar3DRuntimeFrameState) => {
    const normalizedFocusTarget = resolveNormalizedAvatar3DLookAtFocusTarget(frameState);
    const lookAtProfile = resolveAvatar3DLookAtProfile(frameState);
    const horizontalOffset = normalizedFocusTarget?.x ?? 0;
    const verticalOffset = normalizedFocusTarget?.y ?? 0;
    const lerpFactor = normalizedFocusTarget
      ? lookAtProfile.focusLerp
      : LOOK_AT_CENTERING_LERP;

    lookAt.getLookAtWorldPosition(lookAtOrigin);
    lookAt.getLookAtWorldQuaternion(lookAtRotation);

    lookAtOffset
      .set(
        horizontalOffset * LOOK_AT_HORIZONTAL_OFFSET,
        verticalOffset * LOOK_AT_VERTICAL_OFFSET,
        LOOK_AT_TARGET_DISTANCE,
      )
      .applyQuaternion(lookAtRotation);

    desiredTarget.copy(lookAtOrigin).add(lookAtOffset);

    if (!hasSmoothedTarget) {
      smoothedTarget.copy(desiredTarget);
      hasSmoothedTarget = true;
    } else {
      smoothedTarget.lerp(desiredTarget, lerpFactor);
    }

    lookAt.lookAt(smoothedTarget);
  };
}
