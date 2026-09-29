import * as THREE from 'three';
import {
  type Avatar3DFrameUpdater,
  type Avatar3DRuntimeFrameState,
} from './avatar3dRuntimeInstance';
import {
  POINTER_LOOK_HEAD_HORIZON_Y,
  resolvePointerLookNormalizedTarget,
} from '../interactions/pointerLookTargetNormalization';
import { clampPetPointerLookStrength } from '../interactions/petPointerLookPriority';
import { resolveAvatar3DLookAtInput } from './avatar3dLookAtController';

type LookAtOverlayTarget = {
  lastAppliedQuaternion: THREE.Quaternion;
  lastOffsetQuaternion: THREE.Quaternion;
  object: THREE.Object3D;
  pitchScale: number;
  rollScale: number;
  yawScale: number;
};

export type GenericAvatar3DLookAtDebugSummary = {
  targetNames: string[];
  targetCount: number;
};

const HEAD_BONE_PATTERNS = [
  /(?:^|[_\-\s.])head(?:$|[_\-\s.])/iu,
  /(?:^|[_\-\s.])頭(?:$|[_\-\s.])/iu,
  /(?:^|[_\-\s.])头(?:$|[_\-\s.])/iu,
  /^head$/iu,
  /^頭$/iu,
  /^头$/iu,
];
const NECK_BONE_PATTERNS = [
  /(?:^|[_\-\s.])neck(?:$|[_\-\s.])/iu,
  /(?:^|[_\-\s.])首(?:$|[_\-\s.])/iu,
  /^neck$/iu,
  /^首$/iu,
];
const BODY_BONE_PATTERNS = [
  /upperchest/iu,
  /chest/iu,
  /spine2/iu,
  /spine_?02/iu,
  /上半身2/iu,
  /上半身/iu,
];

const IDENTITY_QUATERNION = new THREE.Quaternion();
const POINTER_LOOK_HORIZONTAL_DIVISOR = 14;
const POINTER_LOOK_VERTICAL_DIVISOR = 21;
const LOOK_AT_POINTER_SMOOTHING = 12;
const LOOK_AT_HOVER_FOCUS_SMOOTHING = 10;
const LOOK_AT_FOCUS_FALLBACK_SMOOTHING = 6;
const LOOK_AT_RETURN_SMOOTHING = 7;
const LOOK_AT_REST_EPSILON = 0.004;

function matchesAnyPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function findFirstBone(object: THREE.Object3D, patterns: RegExp[]) {
  let matchedBone: THREE.Bone | null = null;

  object.traverse((child) => {
    if (matchedBone) {
      return;
    }

    if (child instanceof THREE.Bone && matchesAnyPattern(child.name, patterns)) {
      matchedBone = child;
      return;
    }

    if (child instanceof THREE.SkinnedMesh) {
      matchedBone = child.skeleton.bones.find((bone) => matchesAnyPattern(bone.name, patterns)) ?? null;
    }
  });

  return matchedBone;
}

function createOverlayTarget(
  object: THREE.Object3D | null,
  options: {
    pitchScale: number;
    rollScale?: number;
    yawScale: number;
  },
): LookAtOverlayTarget | null {
  if (!object) {
    return null;
  }

  return {
    lastAppliedQuaternion: new THREE.Quaternion(),
    lastOffsetQuaternion: new THREE.Quaternion(),
    object,
    pitchScale: options.pitchScale,
    rollScale: options.rollScale ?? 0,
    yawScale: options.yawScale,
  };
}

function createLookAtOverlayTargets(object: THREE.Object3D) {
  const headBone = findFirstBone(object, HEAD_BONE_PATTERNS);
  const neckBone = findFirstBone(object, NECK_BONE_PATTERNS);
  const bodyBone = findFirstBone(object, BODY_BONE_PATTERNS);
  const skeletalTargets = [
    createOverlayTarget(bodyBone, { pitchScale: -0.14, rollScale: -0.018, yawScale: 0.24 }),
    createOverlayTarget(neckBone, { pitchScale: -0.22, rollScale: -0.016, yawScale: 0.32 }),
    createOverlayTarget(headBone, { pitchScale: -0.28, rollScale: -0.014, yawScale: 0.38 }),
  ].filter((target): target is LookAtOverlayTarget => Boolean(target));

  if (skeletalTargets.length > 0) {
    return skeletalTargets;
  }

  return [
    createOverlayTarget(object, { pitchScale: -0.025, rollScale: -0.008, yawScale: 0.04 }),
  ].filter((target): target is LookAtOverlayTarget => Boolean(target));
}

export function createGenericAvatar3DLookAtDebugSummary(object: THREE.Object3D): GenericAvatar3DLookAtDebugSummary {
  const targets = createLookAtOverlayTargets(object);
  return {
    targetCount: targets.length,
    targetNames: targets.map((target) => target.object.name || target.object.type),
  };
}

function resolveNormalizedPointerLookTarget(frameState?: Avatar3DRuntimeFrameState) {
  const lookInput = resolveAvatar3DLookAtInput(frameState);
  const isPointerLookTarget = lookInput.source === 'pointer';
  const normalizedTarget = resolvePointerLookNormalizedTarget(lookInput.target, {
    neutralY: isPointerLookTarget ? POINTER_LOOK_HEAD_HORIZON_Y : 0,
    xDivisor: POINTER_LOOK_HORIZONTAL_DIVISOR,
    yDivisor: POINTER_LOOK_VERTICAL_DIVISOR,
  });

  if (!normalizedTarget) {
    return null;
  }

  const pointerLookStrength = clampPetPointerLookStrength(frameState?.pointerLookStrength ?? 1);
  if (pointerLookStrength === 1) {
    return normalizedTarget;
  }

  return {
    x: normalizedTarget.x * pointerLookStrength,
    y: normalizedTarget.y * pointerLookStrength,
  };
}

function applyLocalOverlayQuaternion(
  target: LookAtOverlayTarget,
  offsetQuaternion: THREE.Quaternion,
) {
  const object = target.object;
  const currentQuaternion = object.quaternion.clone();
  const canRemovePreviousOffset = currentQuaternion.angleTo(target.lastAppliedQuaternion) < 0.0005;
  const baseQuaternion = canRemovePreviousOffset
    ? currentQuaternion.multiply(target.lastOffsetQuaternion.clone().invert())
    : object.quaternion.clone();

  object.quaternion.copy(baseQuaternion.multiply(offsetQuaternion)).normalize();
  target.lastOffsetQuaternion.copy(offsetQuaternion);
  target.lastAppliedQuaternion.copy(object.quaternion);
}

function applyLookAtOverlayTargets(
  targets: LookAtOverlayTarget[],
  normalizedTarget: { x: number; y: number },
) {
  targets.forEach((target) => {
    const yaw = normalizedTarget.x * target.yawScale;
    const pitch = normalizedTarget.y * target.pitchScale;
    const roll = normalizedTarget.x * target.rollScale;
    const offsetQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, yaw, roll, 'XYZ'),
    );

    applyLocalOverlayQuaternion(target, offsetQuaternion);
  });
}

export function composeAvatar3DFrameUpdaters(
  ...updaters: Array<Avatar3DFrameUpdater | null | undefined>
): Avatar3DFrameUpdater {
  const resolvedUpdaters = updaters.filter((updater): updater is Avatar3DFrameUpdater => Boolean(updater));

  return (delta, frameState) => {
    resolvedUpdaters.forEach((updater) => {
      updater(delta, frameState);
    });
  };
}

export function resolveGenericAvatar3DLookAtSmoothing(frameState?: Avatar3DRuntimeFrameState) {
  const lookInput = resolveAvatar3DLookAtInput(frameState);
  if (!lookInput.target) {
    return LOOK_AT_RETURN_SMOOTHING;
  }

  if (lookInput.source === 'pointer') {
    return LOOK_AT_POINTER_SMOOTHING;
  }

  return frameState?.hoverState?.activeRegion
    ? LOOK_AT_HOVER_FOCUS_SMOOTHING
    : LOOK_AT_FOCUS_FALLBACK_SMOOTHING;
}

export function createGenericAvatar3DLookAtFrameUpdater(
  object: THREE.Object3D,
): Avatar3DFrameUpdater {
  const targets = createLookAtOverlayTargets(object);
  const smoothedTarget = new THREE.Vector2(0, 0);

  return (delta, frameState) => {
    const lookInput = resolveAvatar3DLookAtInput(frameState);
    const normalizedTarget = resolveNormalizedPointerLookTarget(frameState) ?? { x: 0, y: 0 };
    const smoothing = resolveGenericAvatar3DLookAtSmoothing(frameState);
    const lerpFactor = 1 - Math.exp(-Math.max(0, delta) * smoothing);

    smoothedTarget.lerp(new THREE.Vector2(normalizedTarget.x, normalizedTarget.y), lerpFactor);

    if (
      !lookInput.target
      && Math.abs(smoothedTarget.x) < LOOK_AT_REST_EPSILON
      && Math.abs(smoothedTarget.y) < LOOK_AT_REST_EPSILON
    ) {
      smoothedTarget.set(0, 0);
    }

    applyLookAtOverlayTargets(targets, smoothedTarget);
  };
}
