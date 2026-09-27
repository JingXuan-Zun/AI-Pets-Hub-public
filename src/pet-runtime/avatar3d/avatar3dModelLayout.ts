import * as THREE from 'three';

export type Avatar3DModelLayout = {
  boundsCenter: [number, number, number];
  boundsSize: [number, number, number];
  groundPlaneOffsetY: number;
  normalizedScale: number;
  position: [number, number, number];
};

export function resolveAvatar3DModelLayout(object: THREE.Object3D): Avatar3DModelLayout {
  object.updateMatrixWorld(true);
  const rootInverseMatrix = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const bounds = new THREE.Box3();
  const nextBounds = new THREE.Box3();
  let hasRenderableBounds = false;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const geometry = child.geometry;
    if (!geometry) {
      return;
    }

    if (child instanceof THREE.SkinnedMesh) {
      child.updateMatrixWorld(true);
      child.computeBoundingBox();
      if (!child.boundingBox) {
        return;
      }

      nextBounds.copy(child.boundingBox);
    } else {
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      if (!geometry.boundingBox) {
        return;
      }

      nextBounds.copy(geometry.boundingBox);
    }

    nextBounds.applyMatrix4(child.matrixWorld);
    nextBounds.applyMatrix4(rootInverseMatrix);

    if (!hasRenderableBounds) {
      bounds.copy(nextBounds);
      hasRenderableBounds = true;
      return;
    }

    bounds.union(nextBounds);
  });

  if (!hasRenderableBounds) {
    bounds.setFromObject(object);
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const groundPlaneOffsetY = bounds.min.y - center.y;

  const maxAxis = Math.max(size.x, size.y, size.z, 1);

  return {
    boundsCenter: [center.x, center.y, center.z],
    boundsSize: [size.x, size.y, size.z],
    groundPlaneOffsetY,
    normalizedScale: 1.85 / maxAxis,
    position: [-center.x, -center.y, -center.z],
  };
}
