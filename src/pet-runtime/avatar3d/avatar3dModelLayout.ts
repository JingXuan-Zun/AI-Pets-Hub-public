import * as THREE from 'three';

export type Avatar3DModelLayout = {
  boundsCenter: [number, number, number];
  boundsSize: [number, number, number];
  groundPlaneOffsetY: number;
  normalizedScale: number;
  position: [number, number, number];
};

// MMD models often carry a logo sign hidden by turning its material invisible. Its vertices
// still counted toward the measured size (康熙 came out 16 units deep instead of ~3), which
// threw off framing: the settings preview sat low and cut off long hems. Only vertices of
// visible materials count. Null when nothing on this mesh is hidden (the usual fast path).
function boundsOfVisibleMaterialGroups(mesh: THREE.Mesh): THREE.Box3 | 'none-visible' | null {
  const materials = mesh.material;
  const geometry = mesh.geometry;
  if (!Array.isArray(materials) || !geometry.groups.length) {
    return materials && !Array.isArray(materials) && materials.visible === false ? 'none-visible' : null;
  }
  const visibleGroups = geometry.groups.filter((group) => materials[group.materialIndex ?? 0]?.visible !== false);
  if (visibleGroups.length === geometry.groups.length) return null;
  if (!visibleGroups.length) return 'none-visible';

  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const box = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const seen = new Uint8Array(position.count);
  for (const group of visibleGroups) {
    const end = Math.min(group.start + group.count, index ? index.count : position.count);
    for (let i = group.start; i < end; i += 1) {
      const vertexIndex = index ? index.getX(i) : i;
      if (seen[vertexIndex]) continue;
      seen[vertexIndex] = 1;
      mesh.getVertexPosition(vertexIndex, vertex);
      box.expandByPoint(vertex);
    }
  }
  return box;
}

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

    const hiddenPartBounds = boundsOfVisibleMaterialGroups(child);
    if (hiddenPartBounds === 'none-visible') {
      return;
    }
    if (hiddenPartBounds) {
      nextBounds.copy(hiddenPartBounds);
    } else if (child instanceof THREE.SkinnedMesh) {
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
