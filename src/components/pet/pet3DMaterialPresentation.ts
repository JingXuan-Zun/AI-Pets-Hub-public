import * as THREE from 'three';

type TextureBearingMaterial = THREE.Material & {
  alphaMode?: string;
  alphaHash?: boolean;
  alphaMap?: THREE.Texture | null;
  alphaToCoverage?: boolean;
  alphaTest?: number;
  aoMap?: THREE.Texture | null;
  blending?: THREE.Blending;
  bumpMap?: THREE.Texture | null;
  depthTest?: boolean;
  depthWrite?: boolean;
  displacementMap?: THREE.Texture | null;
  dithering?: boolean;
  emissiveMap?: THREE.Texture | null;
  gradientMap?: THREE.Texture | null;
  lightMap?: THREE.Texture | null;
  map?: THREE.Texture | null;
  matcap?: THREE.Texture | null;
  metalnessMap?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  opacity?: number;
  outlineWidthMultiplyTexture?: THREE.Texture | null;
  premultipliedAlpha?: boolean;
  rimMultiplyTexture?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  shadeMultiplyTexture?: THREE.Texture | null;
  shadingShiftTexture?: THREE.Texture | null;
  shadowSide?: THREE.Side | null;
  side?: THREE.Side;
  specularColorMap?: THREE.Texture | null;
  specularIntensityMap?: THREE.Texture | null;
  specularMap?: THREE.Texture | null;
  transmission?: number;
  transparent?: boolean;
  uvAnimationMaskTexture?: THREE.Texture | null;
  isMToonMaterial?: boolean;
  matcapTexture?: THREE.Texture | null;
};

function isEffectivelyOpaqueMaterial(material: TextureBearingMaterial) {
  const opacity = typeof material.opacity === 'number' ? material.opacity : 1;
  const alphaTest = typeof material.alphaTest === 'number' ? material.alphaTest : 0;
  const transmission = typeof material.transmission === 'number' ? material.transmission : 0;

  return opacity >= 0.995
    && alphaTest <= 0.001
    && transmission <= 0.001
    && !material.alphaMap;
}

function shouldForceOpaqueCutoutMaterial(material: TextureBearingMaterial) {
  const opacity = typeof material.opacity === 'number' ? material.opacity : 1;
  const alphaTest = typeof material.alphaTest === 'number' ? material.alphaTest : 0;
  const transmission = typeof material.transmission === 'number' ? material.transmission : 0;
  const alphaMode = typeof material.alphaMode === 'string'
    ? material.alphaMode.trim().toLowerCase()
    : '';

  if (opacity < 0.995 || transmission > 0.001) {
    return false;
  }

  return alphaMode === 'mask'
    || alphaMode === 'opaque'
    || alphaTest >= 0.02
    || Boolean(material.alphaHash);
}

function applyTextureColorSpace(texture: THREE.Texture | null | undefined, colorSpace: THREE.ColorSpace) {
  if (!texture) {
    return;
  }

  texture.colorSpace = colorSpace;
  texture.anisotropy = Math.max(texture.anisotropy || 1, 16);
  texture.needsUpdate = true;
}

export function normalizePetModel3DMaterialPresentation(material: THREE.Material) {
  const nextMaterial = material as TextureBearingMaterial;

  // Preserve the model's original face-side choice unless it is missing.
  nextMaterial.side ??= THREE.FrontSide;
  nextMaterial.shadowSide = nextMaterial.side;

  applyTextureColorSpace(nextMaterial.map, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.emissiveMap, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.matcapTexture, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.specularMap, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.specularColorMap, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.specularIntensityMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.alphaMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.aoMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.bumpMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.displacementMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.gradientMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.lightMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.matcap, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.metalnessMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.normalMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.outlineWidthMultiplyTexture, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.rimMultiplyTexture, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.roughnessMap, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.shadeMultiplyTexture, THREE.SRGBColorSpace);
  applyTextureColorSpace(nextMaterial.shadingShiftTexture, THREE.NoColorSpace);
  applyTextureColorSpace(nextMaterial.uvAnimationMaskTexture, THREE.NoColorSpace);

  const opacity = typeof nextMaterial.opacity === 'number' ? nextMaterial.opacity : 1;
  if (opacity >= 0.999) {
    nextMaterial.opacity = 1;
  }

  if (nextMaterial.isMToonMaterial) {
    // Keep native MToon shading, but still restore opaque / cutout draw modes
    // so the desktop compositor does not wash the avatar into a semi-transparent layer.
    if (nextMaterial.transparent && isEffectivelyOpaqueMaterial(nextMaterial)) {
      nextMaterial.transparent = false;
      nextMaterial.opacity = 1;
      nextMaterial.alphaHash = false;
      nextMaterial.alphaToCoverage = false;
      nextMaterial.blending = THREE.NormalBlending;
    }

    if (nextMaterial.transparent && shouldForceOpaqueCutoutMaterial(nextMaterial)) {
      nextMaterial.transparent = false;
      nextMaterial.opacity = 1;
      nextMaterial.alphaHash = false;
      nextMaterial.alphaToCoverage = false;
      nextMaterial.blending = THREE.NormalBlending;
    }

    nextMaterial.depthTest = true;
    nextMaterial.depthWrite = nextMaterial.transparent
      ? Boolean(nextMaterial.depthWrite)
      : true;
    nextMaterial.dithering = true;
    nextMaterial.needsUpdate = true;
    return;
  }

  nextMaterial.alphaHash = false;

  if (nextMaterial.transparent && isEffectivelyOpaqueMaterial(nextMaterial)) {
    nextMaterial.transparent = false;
    nextMaterial.opacity = 1;
    nextMaterial.alphaHash = false;
    nextMaterial.alphaToCoverage = false;
    nextMaterial.blending = THREE.NormalBlending;
  }

  if (nextMaterial.transparent && shouldForceOpaqueCutoutMaterial(nextMaterial)) {
    nextMaterial.transparent = false;
    nextMaterial.opacity = 1;
    nextMaterial.alphaHash = false;
    nextMaterial.alphaToCoverage = false;
    nextMaterial.blending = THREE.NormalBlending;
  }

  nextMaterial.depthTest = true;
  nextMaterial.depthWrite = true;
  nextMaterial.dithering = true;

  nextMaterial.alphaToCoverage = false;
  nextMaterial.premultipliedAlpha = false;

  nextMaterial.needsUpdate = true;
}
