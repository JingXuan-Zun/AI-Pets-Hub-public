import * as THREE from 'three';
import { type Avatar3DReactionState } from './useAvatar3DReactionState';
import { type PetHoverState } from '../interactions/petHoverController';
import { type Avatar3DMotionState } from './avatar3dMotionStateController';
import { type Avatar3DVisualMode } from './avatar3dActionPresentationProfile';

export type Avatar3DRuntimeFrameState = {
  focusTarget?: {
    x: number;
    y: number;
  } | null;
  pointerLookTarget?: {
    x: number;
    y: number;
  } | null;
  pointerLookStrength?: number;
  hoverState?: PetHoverState;
  motionState?: Avatar3DMotionState;
  reactionState?: Avatar3DReactionState;
  visualMode?: Avatar3DVisualMode;
  wrapperClassName?: string;
};

export type Avatar3DFrameUpdater = (
  delta: number,
  frameState?: Avatar3DRuntimeFrameState,
) => void;

export type Avatar3DObjectDebugSummary = {
  animationClipCount?: number;
  animationClipNames?: string[];
  boneCount: number;
  materialCount: number;
  meshCount: number;
  morphTargetCount: number;
  skinnedMeshCount: number;
  triangleCount: number;
  visibleMeshCount: number;
};

export type Avatar3DRuntimeInstance = {
  debugSummary: Avatar3DObjectDebugSummary;
  dispose?: () => void;
  object: THREE.Object3D;
  sourceLabel?: string;
  update?: Avatar3DFrameUpdater | null;
};

type CreateAvatar3DRuntimeInstanceOptions = {
  debugSummary?: Avatar3DObjectDebugSummary;
  dispose?: () => void;
  object: THREE.Object3D;
  sourceLabel?: string;
  update?: Avatar3DFrameUpdater | null;
};

export function summarizeAvatar3DObjectForDebug(object: THREE.Object3D): Avatar3DObjectDebugSummary {
  const uniqueBoneSet = new Set<string>();
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let visibleMeshCount = 0;
  let materialCount = 0;
  let triangleCount = 0;
  let morphTargetCount = 0;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshCount += 1;
      materialCount += Array.isArray(child.material) ? child.material.length : 1;
      triangleCount += child.geometry?.index
        ? Math.floor(child.geometry.index.count / 3)
        : Math.floor((child.geometry?.attributes?.position?.count ?? 0) / 3);
      morphTargetCount += child.morphTargetInfluences?.length ?? 0;

      if (child.visible) {
        visibleMeshCount += 1;
      }
    }

    if (child instanceof THREE.SkinnedMesh) {
      skinnedMeshCount += 1;
      child.skeleton?.bones.forEach((bone) => {
        uniqueBoneSet.add(bone.uuid);
      });
    }
  });

  return {
    boneCount: uniqueBoneSet.size,
    materialCount,
    meshCount,
    morphTargetCount,
    skinnedMeshCount,
    triangleCount,
    visibleMeshCount,
  };
}

export function createAvatar3DRuntimeInstance({
  debugSummary,
  dispose,
  object,
  sourceLabel,
  update = null,
}: CreateAvatar3DRuntimeInstanceOptions): Avatar3DRuntimeInstance {
  return {
    debugSummary: debugSummary ?? summarizeAvatar3DObjectForDebug(object),
    dispose,
    object,
    sourceLabel,
    update,
  };
}
