import * as THREE from 'three';
import { CCDIKSolver, MMDPhysics, type MMDLoader } from 'three-stdlib';
import type { Avatar3DFrameUpdater } from './avatar3dRuntimeInstance';

// MMD (PMX/PMD) models need more than a generic skinned mesh to look and move right:
// - materials: sphere maps (.sph/.spa) and coloured toon ramps, which three's MeshToonMaterial
//   ignores, and textures whose own alpha cuts out eyelashes, blush and hair tips;
// - bones: IK legs and 付与 (grant) bones are solved after the animation every frame, or VMD
//   motions bend knees and shoulders the wrong way;
// - physics: hair, skirts and ribbons are rigid bodies on springs (Bullet, through ammo.js);
// - pose: MMD models rest in a T/A pose, so a pet with no idle motion gets a relaxed one.

export const MMD_KEEP_TEXTURE_ALPHA_FLAG = 'desktopPetKeepTextureAlpha';

type MmdMaterialData = {
  ambient?: number[];
  diffuse?: number[];
  envFlag?: number;
  envTextureIndex?: number;
  fileName?: string;
  textureIndex?: number;
};

type MmdMaterialMorph = {
  elements: Array<{ diffuse?: number[]; index: number; type?: number }>;
  name: string;
  type: number;
};

type MmdParsedData = {
  materials: MmdMaterialData[];
  metadata: { format: 'pmd' | 'pmx' };
  morphs?: MmdMaterialMorph[];
  textures?: string[];
};

const LOGO_HIDE_MORPH_PATTERN = /(?:logo|ロゴ).*(?:消|非表示|off|hide)|(?:消|非表示|off|hide).*(?:logo|ロゴ)/iu;

// Model authors often float a logo sign over the head and ship a morph (“logo消”) that hides it.
// Vertex morphs are switched on in hideMmdLogo; three's loader ignores material morphs, so those
// hide the materials here.
function hideLogoMaterials(data: MmdParsedData, materials: THREE.Material[]) {
  data.morphs
    ?.filter((morph) => morph.type === 8 && LOGO_HIDE_MORPH_PATTERN.test(morph.name))
    .forEach((morph) => morph.elements.forEach((element) => {
      const multipliesAlphaToZero = (element.type ?? 0) === 0 && element.diffuse?.[3] === 0;
      if (multipliesAlphaToZero && materials[element.index]) materials[element.index].visible = false;
    }));
}

type MmdMaterialBuilder = {
  _loadTexture: (filePath: string, textures: Record<string, THREE.Texture>) => THREE.Texture & { readyCallbacks?: Array<(texture: THREE.Texture) => void> };
  build: (data: MmdParsedData, geometry: unknown, ...rest: unknown[]) => THREE.Material[];
  desktopPetMmdPatched?: boolean;
  resourcePath?: string;
};

function resolveMainTexturePath(builder: MmdMaterialBuilder, data: MmdParsedData, index: number) {
  const material = data.materials[index];
  const file = data.metadata.format === 'pmd'
    ? material?.fileName?.split('*')[0]
    : (material?.textureIndex ?? -1) >= 0 ? data.textures?.[material.textureIndex!] : undefined;
  return file ? `${builder.resourcePath ?? ''}${file}` : null;
}

type MmdSphere = { mode: 'add' | 'multiply'; texture: THREE.Texture };

function resolveSphere(builder: MmdMaterialBuilder, data: MmdParsedData, index: number, textures: Record<string, THREE.Texture>): MmdSphere | null {
  const material = data.materials[index];
  if (!material) return null;
  if (data.metadata.format === 'pmd') {
    const sphereFile = material.fileName?.split('*')[1];
    if (!sphereFile) return null;
    return { mode: sphereFile.toLowerCase().endsWith('.spa') ? 'add' : 'multiply', texture: builder._loadTexture(sphereFile, textures) };
  }
  const textureFile = material.envTextureIndex !== undefined && material.envTextureIndex >= 0 ? data.textures?.[material.envTextureIndex] : undefined;
  if (!textureFile || (material.envFlag !== 1 && material.envFlag !== 2)) return null;
  return { mode: material.envFlag === 2 ? 'add' : 'multiply', texture: builder._loadTexture(textureFile, textures) };
}

// MMD shades in its own way rather than with scene lights: the material colour
// saturate(diffuse × light + ambient) — usually white — times the texture, then the toon ramp
// darkens and tints only the side facing away from the one MMD light. Run through three's lights
// (divided by π, several directions, ambient added as a grey glow) the same model looks flat and
// grey, so MMD materials replace three's lighting result with that formula.
const MMD_LIGHT_COLOR = 154 / 255;
const MMD_LIGHT_DIRECTION_VIEW = new THREE.Vector3(0.35, 0.65, 0.68).normalize();

const MMD_LIGHTING_PARS = /* glsl */ `
uniform vec3 mmdDiffuse;
uniform vec3 mmdAmbient;
uniform vec3 mmdLightDirection;
uniform float mmdLightColor;
vec3 mmdToSRGBLinear( vec3 value ) {
  return sRGBTransferEOTF( vec4( value, 1.0 ) ).rgb;
}
`;

const MMD_LIGHTING_RESULT = /* glsl */ `
  float mmdDotNL = dot( normal, mmdLightDirection );
  #ifdef USE_GRADIENTMAP
    // The loader turns the toon image on its side, so x runs from shadow to lit.
    vec3 mmdToon = mmdToSRGBLinear( texture2D( gradientMap, vec2( clamp( mmdDotNL * 0.5 + 0.5, 0.02, 0.98 ), 0.5 ) ).rgb );
  #else
    vec3 mmdToon = mix( vec3( 0.75 ), vec3( 1.0 ), smoothstep( -0.05, 0.05, mmdDotNL ) );
  #endif
  vec3 mmdBase = mmdToSRGBLinear( clamp( mmdDiffuse * mmdLightColor + mmdAmbient, 0.0, 1.0 ) );
  vec3 outgoingLight = mmdBase * diffuseColor.rgb * mmdToon;
`;

type MmdMaterialColors = { ambient: [number, number, number]; diffuse: [number, number, number] };

function resolveMaterialColors(data: MmdParsedData, index: number): MmdMaterialColors {
  const material = data.materials[index];
  const diffuse = material?.diffuse ?? [1, 1, 1];
  const ambient = material?.ambient ?? [0.5, 0.5, 0.5];
  return { ambient: [ambient[0] ?? 0.5, ambient[1] ?? 0.5, ambient[2] ?? 0.5], diffuse: [diffuse[0] ?? 1, diffuse[1] ?? 1, diffuse[2] ?? 1] };
}

function extendMmdMaterial(material: THREE.Material, sphere: MmdSphere | null, colors: MmdMaterialColors) {
  if (sphere) {
    sphere.texture.colorSpace = THREE.SRGBColorSpace;
  }
  const toon = material as THREE.MeshToonMaterial;
  // Colour comes in through the MMD formula; three's own colour and glow would count it twice.
  toon.color.setRGB(1, 1, 1);
  toon.emissive.setRGB(0, 0, 0);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.mmdDiffuse = { value: new THREE.Vector3(...colors.diffuse) };
    shader.uniforms.mmdAmbient = { value: new THREE.Vector3(...colors.ambient) };
    shader.uniforms.mmdLightDirection = { value: MMD_LIGHT_DIRECTION_VIEW };
    shader.uniforms.mmdLightColor = { value: MMD_LIGHT_COLOR };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MMD_LIGHTING_PARS}${sphere ? 'uniform sampler2D mmdSphereMap;\n' : ''}`)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', MMD_LIGHTING_RESULT);
    if (!sphere) return;
    shader.uniforms.mmdSphereMap = { value: sphere.texture };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec2 mmdSphereUv = normal.xy * 0.5 + 0.5;
    vec3 mmdSphere = texture2D( mmdSphereMap, vec2( mmdSphereUv.x, 1.0 - mmdSphereUv.y ) ).rgb;
    diffuseColor.rgb ${sphere.mode === 'add' ? '+=' : '*='} mmdSphere;
  }`);
  };
  material.customProgramCacheKey = () => `mmd-shading-${sphere?.mode ?? 'none'}`;
  // Straight alpha blending: MMD's own blend mode writes odd alpha into the transparent desktop window.
  material.blending = THREE.NormalBlending;
  material.needsUpdate = true;
}

function keepTextureAlpha(material: THREE.Material) {
  material.userData[MMD_KEEP_TEXTURE_ALPHA_FLAG] = true;
  material.transparent = true;
  material.needsUpdate = true;
}

// The loader flags see-through textures on the texture, never on the material, so those parts
// would draw as solid patches. Carry the flag over once the image has been inspected.
function followTextureAlpha(material: THREE.Material) {
  const map = (material as THREE.MeshToonMaterial).map as (THREE.Texture & { readyCallbacks?: Array<() => void>; transparent?: boolean }) | null;
  if (!map) return;
  if (map.transparent) {
    keepTextureAlpha(material);
  } else if (map.readyCallbacks) {
    // The loader's own transparency check was queued first, so this runs after it.
    map.readyCallbacks.push(() => {
      if (map.transparent) keepTextureAlpha(material);
    });
  }
}

export function installMmdMaterialExtensions(loader: MMDLoader) {
  const builder = (loader as unknown as { meshBuilder?: { materialBuilder?: MmdMaterialBuilder } }).meshBuilder?.materialBuilder;
  if (!builder || builder.desktopPetMmdPatched) return;
  // A texture the model names but the folder lacks would sample as black; draw the plain
  // material colour instead.
  const materialsByTexturePath = new Map<string, THREE.Material[]>();
  const previousOnError = loader.manager.onError;
  loader.manager.onError = (url) => {
    previousOnError?.(url);
    materialsByTexturePath.get(url)?.forEach((material) => {
      (material as THREE.MeshToonMaterial).map = null;
      material.needsUpdate = true;
    });
  };
  const build = builder.build.bind(builder);
  builder.build = (data, geometry, ...rest) => {
    const materials = build(data, geometry, ...rest);
    const textures: Record<string, THREE.Texture> = {};
    materials.forEach((material, index) => {
      extendMmdMaterial(material, resolveSphere(builder, data, index, textures), resolveMaterialColors(data, index));
      if (material.opacity < 1) material.userData[MMD_KEEP_TEXTURE_ALPHA_FLAG] = true;
      followTextureAlpha(material);
      const texturePath = resolveMainTexturePath(builder, data, index);
      if (texturePath) materialsByTexturePath.set(texturePath, [...(materialsByTexturePath.get(texturePath) ?? []), material]);
    });
    hideLogoMaterials(data, materials);
    return materials;
  };
  builder.desktopPetMmdPatched = true;
}

export function hideMmdLogo(mesh: THREE.SkinnedMesh) {
  Object.entries(mesh.morphTargetDictionary ?? {}).forEach(([name, index]) => {
    if (LOGO_HIDE_MORPH_PATTERN.test(name) && mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 1;
  });
}

type MmdGrant = {
  affectPosition: boolean;
  affectRotation: boolean;
  index: number;
  isLocal: boolean;
  parentIndex: number;
  ratio: number;
};

type MmdGeometryData = {
  constraints?: unknown[];
  grants?: MmdGrant[];
  iks?: ConstructorParameters<typeof CCDIKSolver>[1];
  rigidBodies?: unknown[];
};

type AmmoVector = { setValue: (x: number, y: number, z: number) => void };

type AmmoRuntime = {
  btVector3: new (x: number, y: number, z: number) => AmmoVector;
  destroy: (object: unknown) => void;
};

type MmdPhysicsInternals = {
  bodies: Array<{ body: unknown }>;
  constraints: Array<{ constraint: unknown }>;
  world: {
    removeConstraint: (constraint: unknown) => void;
    removeRigidBody: (body: unknown) => void;
    setGravity: (gravity: AmmoVector) => void;
  };
};

let ammoRuntime: Promise<AmmoRuntime | null> | null = null;

// ammo.js is about 2 MB, so it loads only when a model actually has physics.
function loadAmmoRuntime() {
  ammoRuntime ??= import('ammojs-typed')
    .then(({ default: createAmmo }) => new Promise<AmmoRuntime>((resolve) => {
      // The module object has its own `then`; awaiting it directly would never settle. The
      // factory also stores itself on `this`, which is undefined when called bare in an ES module.
      (createAmmo as unknown as (this: typeof globalThis) => { then: (onReady: (ammo: AmmoRuntime) => void) => void }).call(globalThis).then((ammo) => {
        (globalThis as { Ammo?: AmmoRuntime }).Ammo = ammo;
        resolve(ammo);
      });
    }))
    .catch(() => {
      ammoRuntime = null;
      return null;
    });
  return ammoRuntime;
}

export type MmdPhysicsRuntime = {
  dispose: () => void;
  physics: MMDPhysics;
  setGravity: (gravity: THREE.Vector3) => void;
};

export async function createMmdPhysics(mesh: THREE.SkinnedMesh): Promise<MmdPhysicsRuntime | null> {
  const data = (mesh.geometry.userData as { MMD?: MmdGeometryData }).MMD;
  if (!data?.rigidBodies?.length) return null;
  const ammo = await loadAmmoRuntime();
  if (!ammo) return null;
  const physics = new MMDPhysics(mesh, data.rigidBodies as never, (data.constraints ?? []) as never, { gravity: new THREE.Vector3(0, -MMD_GRAVITY, 0), maxStepNum: 3, unitStep: 1 / 65 });
  const internals = physics as unknown as MmdPhysicsInternals;
  // One vector reused: MMDPhysics.setGravity allocates a new one in ammo's heap on every call.
  const gravityVector = new ammo.btVector3(0, -MMD_GRAVITY, 0);
  return {
    // The physics world lives in ammo's own heap; free it when the model unloads.
    dispose: () => {
      internals.constraints.forEach(({ constraint }) => {
        internals.world.removeConstraint(constraint);
        ammo.destroy(constraint);
      });
      internals.bodies.forEach(({ body }) => {
        internals.world.removeRigidBody(body);
        ammo.destroy(body);
      });
      ammo.destroy(internals.world);
      ammo.destroy(gravityVector);
    },
    physics,
    setGravity: (gravity) => {
      gravityVector.setValue(gravity.x, gravity.y, gravity.z);
      internals.world.setGravity(gravityVector);
    },
  };
}

const PHYSICS_POSE_SETTLE_SECONDS = 0.5;
// Gravity in model units (about 8 cm each) per second squared; MMD's own is 98, a little lower
// lets hair and cloth swing more.
const MMD_GRAVITY = 90;
// Dragging the pet pushes hair and cloth the other way, like the air does: smoothed drag speed
// (pixels per pointer move, up to about 22) times this, against MMD_GRAVITY.
const DRAG_INERTIA_FORCE = 5;
const identityQuaternion = new THREE.Quaternion();
const grantQuaternion = new THREE.Quaternion();

// Solving runs on top of the animated pose, so the pose is put back before the next frame's
// animation; otherwise bones the motion does not touch would keep turning by their grant ratio.
export function createMmdPoseSolver(mesh: THREE.SkinnedMesh, physicsRuntime: MmdPhysicsRuntime | null = null) {
  const physics = physicsRuntime?.physics ?? null;
  const gravity = new THREE.Vector3(0, -MMD_GRAVITY, 0);
  const appliedGravity = gravity.clone();
  const worldToModel = new THREE.Quaternion();
  const data = (mesh.geometry.userData as { MMD?: MmdGeometryData }).MMD ?? {};
  const bones = mesh.skeleton.bones;
  const ikSolver = data.iks?.length ? new CCDIKSolver(mesh, data.iks) : null;
  const grants = data.grants ?? [];
  const savedQuaternions = new Float32Array(bones.length * 4);
  const savedPositions = new Float32Array(bones.length * 3);
  let hasSavedPose = false;
  let physicsSettled = false;
  let physicsFailed = false;
  let poseSettleSeconds = 0;

  // Physics runs in the model's own space. three's Object3D.worldToLocal refreshes the whole
  // parent chain, so the scaled pet group would leak into the bone maths; the mesh is detached
  // for the step (as three's MMDPhysics does itself for scaled models) and is always re-attached,
  // even when a step throws, so the pet never renders detached at model scale.
  const runPhysics = (step: (activePhysics: MMDPhysics) => void) => {
    if (!physics || physicsFailed) return;
    const parent = mesh.parent;
    mesh.parent = null;
    mesh.updateMatrixWorld(true);
    try {
      step(physics);
    } catch (error) {
      physicsFailed = true;
      console.warn('MMD physics stopped for this model', error);
    } finally {
      mesh.parent = parent;
      mesh.updateMatrixWorld(true);
    }
  };

  const restore = () => {
    if (!hasSavedPose) return;
    bones.forEach((bone, index) => {
      bone.quaternion.fromArray(savedQuaternions, index * 4);
      bone.position.fromArray(savedPositions, index * 3);
    });
  };

  // Physics only sees the model's own space, so tell it where "down" is on screen — the pet tilts
  // while dragged — and add the drag's push.
  const updateGravity = (frameState?: Parameters<Avatar3DFrameUpdater>[1]) => {
    const drag = frameState?.dragVelocity;
    gravity.set(-(drag?.x ?? 0) * DRAG_INERTIA_FORCE, (drag?.y ?? 0) * DRAG_INERTIA_FORCE - MMD_GRAVITY, 0);
    gravity.applyQuaternion(mesh.getWorldQuaternion(worldToModel).invert());
    if (gravity.distanceToSquared(appliedGravity) < 0.25) return;
    appliedGravity.copy(gravity);
    physicsRuntime?.setGravity(gravity);
  };

  const solve: Avatar3DFrameUpdater = (delta, frameState) => {
    bones.forEach((bone, index) => {
      bone.quaternion.toArray(savedQuaternions, index * 4);
      bone.position.toArray(savedPositions, index * 3);
    });
    hasSavedPose = true;
    mesh.updateMatrixWorld(true);
    ikSolver?.update();
    grants.forEach((grant) => {
      const bone = bones[grant.index];
      const parent = bones[grant.parentIndex];
      if (!bone || !parent) return;
      // Rotation grants only, like three's MMD helper; position grants are rare outside dances.
      if (!grant.affectRotation || grant.isLocal) return;
      grantQuaternion.copy(identityQuaternion).slerp(parent.quaternion, grant.ratio);
      bone.quaternion.multiply(grantQuaternion);
    });
    if (!physics) return;
    if (!physicsSettled) {
      // Wait until the arms have come down from the T/A pose: settling the hair first and then
      // sweeping the arms through it traps braids above the shoulders. Then let hair and cloth
      // fall into place from that pose instead of snapping.
      poseSettleSeconds += Math.max(0, delta);
      if (poseSettleSeconds < PHYSICS_POSE_SETTLE_SECONDS) return;
      runPhysics((activePhysics) => activePhysics.reset().warmup(60));
      physicsSettled = true;
      return;
    }
    updateGravity(frameState);
    runPhysics((activePhysics) => activePhysics.update(Math.max(0, delta)));
  };

  return { restore, solve };
}

const RELAXED_ARM_DOWN_DEGREES = 72;
const IDLE_SECONDS = 4;

function findBone(mesh: THREE.SkinnedMesh, name: string) {
  return mesh.skeleton.bones.find((bone) => bone.name === name) ?? null;
}

function armDropQuaternion(mesh: THREE.SkinnedMesh, armName: string, elbowName: string) {
  const arm = findBone(mesh, armName);
  const elbow = findBone(mesh, elbowName);
  if (!arm || !elbow) return null;
  mesh.updateMatrixWorld(true);
  const armPosition = arm.getWorldPosition(new THREE.Vector3());
  const direction = elbow.getWorldPosition(new THREE.Vector3()).sub(armPosition);
  if (Math.abs(direction.x) < 1e-4) return null;
  const currentDown = Math.atan2(-direction.y, Math.abs(direction.x));
  const extraDown = THREE.MathUtils.degToRad(RELAXED_ARM_DOWN_DEGREES) - currentDown;
  if (extraDown <= 0) return null;
  // Rest bones carry no rotation, so a local turn about Z is a turn in the model's front plane.
  return { arm, rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), direction.x > 0 ? -extraDown : extraDown) };
}

// A quiet standing loop: arms down from the T/A pose and a slow breath in the upper body.
export function createMmdIdleClip(mesh: THREE.SkinnedMesh) {
  const tracks: THREE.KeyframeTrack[] = [];
  const times = [0, 1, 2, 3, 4].map((step) => (step / 4) * IDLE_SECONDS);
  [['左腕', '左ひじ'], ['右腕', '右ひじ']].forEach(([armName, elbowName], side) => {
    const drop = armDropQuaternion(mesh, armName, elbowName);
    if (!drop) return;
    // Also the resting pose, so a picture or a paused pet is not left in the T/A pose.
    drop.arm.quaternion.copy(drop.rotation);
    const values = times.flatMap((time) => {
      const sway = THREE.MathUtils.degToRad(1.2) * Math.sin((time / IDLE_SECONDS) * Math.PI * 2 + side * Math.PI);
      return drop.rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sway)).toArray();
    });
    tracks.push(new THREE.QuaternionKeyframeTrack(`.bones[${drop.arm.name}].quaternion`, times, values));
  });
  const upperBody = findBone(mesh, '上半身');
  if (upperBody) {
    const values = times.flatMap((time) => new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(1.4) * Math.sin((time / IDLE_SECONDS) * Math.PI * 2),
    ).toArray());
    tracks.push(new THREE.QuaternionKeyframeTrack(`.bones[${upperBody.name}].quaternion`, times, values));
  }
  return tracks.length ? new THREE.AnimationClip('idle', IDLE_SECONDS, tracks) : null;
}

// VMD (MMD motion) is binary: a 30-byte signature, a 20-byte model name, then bone and morph
// keyframes at 30 fps. Only the frame numbers are needed to know how long a motion runs.
export function readVmdDurationMs(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const signature = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, Math.min(30, buffer.byteLength)));
  if (!signature.startsWith('Vocaloid Motion Data')) return null;
  let offset = 50;
  let lastFrame = 0;
  const readFrames = (recordSize: number) => {
    if (offset + 4 > buffer.byteLength) return;
    const count = view.getUint32(offset, true);
    offset += 4;
    for (let index = 0; index < count && offset + recordSize <= buffer.byteLength; index += 1) {
      lastFrame = Math.max(lastFrame, view.getUint32(offset + 15, true));
      offset += recordSize;
    }
  };
  readFrames(111);
  readFrames(23);
  return lastFrame > 0 ? Math.round((lastFrame / 30) * 1000) : null;
}
