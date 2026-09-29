import * as THREE from 'three';
import { MMDLoader } from 'three-stdlib';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  resolve3DModelDependencyUrl,
  resolve3DModelDirectoryUrl,
  type Supported3DModelFormat,
} from '../../model3dFormatSupport';
import { normalizePetModel3DMaterialPresentation } from '../../components/pet/pet3DMaterialPresentation';
import {
  createAvatar3DRuntimeInstance,
  summarizeAvatar3DObjectForDebug,
  type Avatar3DObjectDebugSummary,
  type Avatar3DRuntimeInstance,
} from './avatar3dRuntimeInstance';
import {
  resolvePetContentMotionAssetSources,
  resolvePetContentMotionNames,
  type PetContentManifest,
  type PetContentMotionAssetFormat,
  type PetContentMotionKey,
  type ResolvedPetContentMotionAssetSource,
} from '../content/petContentManifest';
import {
  createVRMReactionDebugSummary,
  createVRMRuntimeFrameUpdater,
} from './avatar3dVRMReactionRuntime';
import { createMorphTargetRuntimeFrameUpdater } from './avatar3dMorphTargetReactionRuntime';
import {
  composeAvatar3DFrameUpdaters,
  createGenericAvatar3DLookAtFrameUpdater,
} from './avatar3dGenericLookAtController';
import { createVRMLookAtDebugSummary } from './avatar3dLookAtController';
import { loadPetContentManifestForModel } from '../content/petContentManifestLoader';
import {
  createAnimatedAvatar3DRuntimeInstance,
  dedupeAnimationClipsByName,
} from './avatar3dAnimatedRuntimeInstance';
import {
  registerAvatar3DMotionClipDurationEntries,
} from './avatar3dMotionClipDurationStore';

export type LoaderWithManager = THREE.Loader & {
  manager: THREE.LoadingManager;
};

export type ResourcePathAwareLoader = LoaderWithManager & {
  setPath?: (path: string) => ResourcePathAwareLoader;
  setResourcePath?: (path: string) => ResourcePathAwareLoader;
};

type VRMEnabledGLTF = GLTF & {
  userData: GLTF['userData'] & {
    vrm?: VRM;
    vrmAnimations?: VRMAnimation[];
  };
};

export type LoadedVRMAssetInstance = Avatar3DRuntimeInstance & {
  debug: {
    animationClipCount: number;
    animationClipNames: string[];
    contentManifestId: string | null;
    contentManifestSourceUrl: string | null;
    expressionNamesByAction: Partial<Record<'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING', string>>;
    externalMotionClipNames: string[];
    externalMotionSourceUrls: string[];
    lookAtAvailable: boolean;
    metaVersion: string | null;
    mouthExpressionNames: string[];
  };
};

export type LoadedAvatar3DExternalMotionClipsResult = {
  clips: THREE.AnimationClip[];
  failedSourceUrls: string[];
  loadedAssetCount: number;
  sourceUrls: string[];
};

type LoadedAvatar3DMotionAssetClips = {
  clips: THREE.AnimationClip[];
  format: PetContentMotionAssetFormat;
  sourceUrl: string;
};

const avatar3DMotionAssetRequestCache = new Map<string, Promise<LoadedAvatar3DMotionAssetClips>>();
const gltfAssetRequestCache = new Map<string, Promise<GLTF>>();
const fbxAssetRequestCache = new Map<string, Promise<THREE.Group>>();
const objAssetRequestCache = new Map<string, Promise<THREE.Group>>();
const stlAssetRequestCache = new Map<string, Promise<THREE.BufferGeometry>>();
const pmxAssetRequestCache = new Map<string, Promise<THREE.SkinnedMesh>>();
const VRMA_MOTION_ASSET_FORMAT = 'vrma' satisfies PetContentMotionAssetFormat;
const EXTERNAL_MOTION_DOWNSAMPLE_MAX_FPS = 30;
const EXTERNAL_MOTION_DOWNSAMPLE_MIN_TOTAL_KEYFRAMES = 12000;
const EXTERNAL_MOTION_DOWNSAMPLE_MIN_TRACK_SAMPLE_RATE = 40;
const SUPPORTED_PET_CONTENT_MOTION_KEYS: PetContentMotionKey[] = [
  'idle',
  'moving',
  'walking',
  'running',
  'swimming',
  'eating',
  'happy',
  'sad',
  'sleeping',
  'hover-head',
  'hover-body',
  'hover-hand-left',
  'hover-hand-right',
];

export function summarizeObjectForDebug(object: THREE.Object3D): Avatar3DObjectDebugSummary {
  return summarizeAvatar3DObjectForDebug(object);
}

export function prepareObjectForDisplay(object: THREE.Object3D) {
  object.traverse((child) => {
    child.frustumCulled = false;

    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => {
          const nextMaterial = (
            normalizeDesktopPetRenderableMaterial(child, material)
          );
          normalizePetModel3DMaterialPresentation(nextMaterial);
          return nextMaterial;
        });
      } else if (child.material) {
        child.material = normalizeDesktopPetRenderableMaterial(child, child.material);
        normalizePetModel3DMaterialPresentation(child.material);
      }
    }
  });

  return object;
}

function normalizeDesktopPetRenderableMaterial(
  _mesh: THREE.Mesh,
  material: THREE.Material,
) {
  // Preserve native VRM MToon materials so their original color, shade,
  // and alpha response survive desktop rendering instead of being flattened
  // into a generic PBR fallback.
  return material;
}

export function createPreparedSkeletonClone(object: THREE.Object3D) {
  return prepareObjectForDisplay(cloneSkeleton(object));
}

export function createPreparedDeepClone(object: THREE.Object3D) {
  return prepareObjectForDisplay(object.clone(true));
}

export function createPreparedStlMesh(geometry: THREE.BufferGeometry) {
  const nextGeometry = geometry.clone();
  nextGeometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    nextGeometry,
    new THREE.MeshStandardMaterial({
      color: '#d9ebff',
      metalness: 0.06,
      roughness: 0.62,
    }),
  );

  return prepareObjectForDisplay(mesh);
}

export function configure3DAssetLoader(loader: LoaderWithManager, sourceUrl: string) {
  const resourceBaseUrl = resolve3DModelDirectoryUrl(sourceUrl);
  const nextLoader = loader as ResourcePathAwareLoader;

  // useLoader memoizes loader instances, so always reset the main file path.
  nextLoader.setPath?.('');

  if (resourceBaseUrl) {
    nextLoader.setResourcePath?.(resourceBaseUrl);
  }

  loader.manager.addHandler(/\.tga$/iu, new TGALoader(loader.manager));
  loader.manager.addHandler(/\.dds$/iu, new DDSLoader(loader.manager));
  loader.manager.setURLModifier((requestUrl) => resolve3DModelDependencyUrl(requestUrl, sourceUrl));
}

export function configureVRMLoader(loader: GLTFLoader, sourceUrl: string) {
  configure3DAssetLoader(loader, sourceUrl);
  loader.register((parser) => new VRMLoaderPlugin(parser));
}

function configureVRMAnimationLoader(loader: GLTFLoader, sourceUrl: string) {
  configure3DAssetLoader(loader, sourceUrl);
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
}

function normalizeAnimationClipName(name: string) {
  return name.trim().toLowerCase();
}

function countAnimationTrackKeyframes(track: THREE.KeyframeTrack) {
  return track.times?.length ?? 0;
}

function countAnimationClipKeyframes(clip: THREE.AnimationClip) {
  return clip.tracks.reduce((sum, track) => sum + countAnimationTrackKeyframes(track), 0);
}

function estimateAnimationTrackSampleRate(track: THREE.KeyframeTrack) {
  const keyframeCount = countAnimationTrackKeyframes(track);
  if (keyframeCount < 2) {
    return 0;
  }

  const startTime = track.times[0] ?? 0;
  const endTime = track.times[keyframeCount - 1] ?? startTime;
  const duration = endTime - startTime;
  if (!(duration > 0)) {
    return 0;
  }

  return (keyframeCount - 1) / duration;
}

function cloneAnimationTrackWithSubset(
  track: THREE.KeyframeTrack,
  keepIndexes: number[],
) {
  if (keepIndexes.length >= countAnimationTrackKeyframes(track)) {
    return track;
  }

  const valueSize = track.getValueSize();
  const sampleTimes = new Float32Array(keepIndexes.length);
  const sampleValues = new Float32Array(keepIndexes.length * valueSize);

  keepIndexes.forEach((sourceIndex, targetIndex) => {
    sampleTimes[targetIndex] = track.times[sourceIndex] ?? 0;
    const sourceValueOffset = sourceIndex * valueSize;
    const targetValueOffset = targetIndex * valueSize;

    for (let valueIndex = 0; valueIndex < valueSize; valueIndex += 1) {
      sampleValues[targetValueOffset + valueIndex] = track.values[sourceValueOffset + valueIndex] ?? 0;
    }
  });

  const TrackConstructor = track.constructor as new (
    name: string,
    times: Float32Array,
    values: Float32Array,
    interpolation?: THREE.InterpolationModes,
  ) => THREE.KeyframeTrack;
  const clonedTrack = new TrackConstructor(
    track.name,
    sampleTimes,
    sampleValues,
    track.getInterpolation(),
  );
  clonedTrack.setInterpolation(track.getInterpolation());
  return clonedTrack;
}

function downsampleAnimationTrack(
  track: THREE.KeyframeTrack,
  maxSampleRate = EXTERNAL_MOTION_DOWNSAMPLE_MAX_FPS,
) {
  const sampleRate = estimateAnimationTrackSampleRate(track);
  const keyframeCount = countAnimationTrackKeyframes(track);
  if (
    keyframeCount < 3
    || !(sampleRate > maxSampleRate)
  ) {
    return track;
  }

  const minFrameStep = 1 / maxSampleRate;
  const keepIndexes = [0];
  let lastKeptTime = track.times[0] ?? 0;

  for (let index = 1; index < keyframeCount - 1; index += 1) {
    const nextTime = track.times[index] ?? lastKeptTime;
    if ((nextTime - lastKeptTime) >= minFrameStep) {
      keepIndexes.push(index);
      lastKeptTime = nextTime;
    }
  }

  keepIndexes.push(keyframeCount - 1);
  return cloneAnimationTrackWithSubset(track, keepIndexes);
}

function shouldDownsampleExternalMotionClip(clip: THREE.AnimationClip) {
  const totalKeyframes = countAnimationClipKeyframes(clip);
  if (totalKeyframes < EXTERNAL_MOTION_DOWNSAMPLE_MIN_TOTAL_KEYFRAMES) {
    return false;
  }

  return clip.tracks.some((track) => (
    estimateAnimationTrackSampleRate(track) > EXTERNAL_MOTION_DOWNSAMPLE_MIN_TRACK_SAMPLE_RATE
  ));
}

function resolveExternalMotionTargetDuration(motionKey: PetContentMotionKey) {
  switch (motionKey) {
    case 'moving':
    case 'walking':
      return 1.7;
    case 'running':
      return 1.15;
    case 'swimming':
      return 1.8;
    case 'happy':
      return 3.2;
    case 'sad':
      return 3.8;
    case 'eating':
      return 2.8;
    case 'hover-head':
    case 'hover-body':
    case 'hover-hand-left':
    case 'hover-hand-right':
      return 2.4;
    case 'sleeping':
      return 5.6;
    case 'idle':
    default:
      return 4.8;
  }
}

function resolveExternalMotionPlaybackRateCap(motionKey: PetContentMotionKey) {
  switch (motionKey) {
    case 'moving':
    case 'walking':
      return 3.4;
    case 'running':
      return 3.8;
    case 'swimming':
      return 3.1;
    case 'idle':
    case 'sleeping':
      return 1.6;
    default:
      return 2.25;
  }
}

function resolveExternalMotionPlaybackRateMultiplier(
  motionKey: PetContentMotionKey,
  clip: THREE.AnimationClip,
) {
  const duration = Number.isFinite(clip.duration) ? clip.duration : 0;
  const targetDuration = resolveExternalMotionTargetDuration(motionKey);
  if (!(duration > targetDuration * 1.15)) {
    return 1;
  }

  const durationRatio = duration / targetDuration;
  const multiplier = 1 + ((durationRatio - 1) * 0.72);
  return Number(Math.min(
    resolveExternalMotionPlaybackRateCap(motionKey),
    Math.max(1, multiplier),
  ).toFixed(3));
}

function prepareExternalMotionClipForRuntime(
  clip: THREE.AnimationClip,
  motionKey: PetContentMotionKey,
) {
  let preparedClip = clip.clone().trim().optimize();
  if (shouldDownsampleExternalMotionClip(preparedClip)) {
    preparedClip = new THREE.AnimationClip(
      preparedClip.name,
      preparedClip.duration,
      preparedClip.tracks.map((track) => downsampleAnimationTrack(track)),
      preparedClip.blendMode,
    ).trim().optimize();
  }

  preparedClip.userData = {
    ...(clip.userData ?? {}),
    desktopPetExternalMotionKeyframes: countAnimationClipKeyframes(preparedClip),
    desktopPetPlaybackRateMultiplier: resolveExternalMotionPlaybackRateMultiplier(motionKey, preparedClip),
  };
  return preparedClip;
}

function filterAnimationClipsByNames(
  clips: THREE.AnimationClip[],
  clipNames: string[],
) {
  if (!clipNames.length) {
    return clips;
  }

  const normalizedClipNames = clipNames
    .map(normalizeAnimationClipName)
    .filter(Boolean);
  const exactMatches = clips.filter((clip) => normalizedClipNames.includes(normalizeAnimationClipName(clip.name)));
  if (exactMatches.length) {
    return exactMatches;
  }

  const fuzzyMatches = clips.filter((clip) => {
    const normalizedClipName = normalizeAnimationClipName(clip.name);
    return normalizedClipNames.some((candidateName) => (
      normalizedClipName.includes(candidateName)
      || candidateName.includes(normalizedClipName)
    ));
  });
  if (fuzzyMatches.length) {
    return fuzzyMatches;
  }

  return clips.length === 1 ? clips : [];
}

function applyMotionNameAliases(
  clips: THREE.AnimationClip[],
  motionNames: string[],
) {
  if (!clips.length || !motionNames.length) {
    return clips;
  }

  const normalizedMotionNameSet = new Set(
    motionNames.map(normalizeAnimationClipName).filter(Boolean),
  );
  const hasDirectMatch = clips.some((clip) => normalizedMotionNameSet.has(normalizeAnimationClipName(clip.name)));
  if (hasDirectMatch) {
    return clips;
  }

  if (clips.length === 1) {
    return motionNames.map((motionName) => {
      const aliasedClip = clips[0].clone();
      aliasedClip.name = motionName;
      return aliasedClip;
    });
  }

  if (clips.length > 1 && motionNames.length === 1) {
    const primaryMotionName = motionNames[0];
    if (!primaryMotionName) {
      return clips;
    }

    // Keep one stable alias per imported source so manual custom motion
    // selection can still lock onto this asset when it contains many clips.
    const aliasedPrimaryClip = clips[0].clone();
    aliasedPrimaryClip.name = primaryMotionName;
    return [aliasedPrimaryClip, ...clips];
  }

  if (clips.length === motionNames.length) {
    return clips.map((clip, index) => {
      const motionName = motionNames[index];
      if (!motionName || normalizeAnimationClipName(clip.name) === normalizeAnimationClipName(motionName)) {
        return clip;
      }

      const aliasedClip = clip.clone();
      aliasedClip.name = motionName;
      return aliasedClip;
    });
  }

  return clips;
}

function resolveLongestAnimationClipDurationMs(clips: THREE.AnimationClip[]) {
  const longestDurationSeconds = clips.reduce((longestDuration, clip) => (
    Number.isFinite(clip.duration) && clip.duration > 0
      ? Math.max(longestDuration, clip.duration)
      : longestDuration
  ), 0);

  return longestDurationSeconds > 0
    ? Math.max(1, Math.round(longestDurationSeconds * 1000))
    : null;
}

function registerResolvedExternalMotionClipDurations(options: {
  aliasedClips: THREE.AnimationClip[];
  motionSource: ResolvedPetContentMotionAssetSource;
  preferredMotionNames: string[];
  selectedClips: THREE.AnimationClip[];
}) {
  const {
    aliasedClips,
    motionSource,
    preferredMotionNames,
    selectedClips,
  } = options;
  const selectedDurationMs = resolveLongestAnimationClipDurationMs(selectedClips);
  registerAvatar3DMotionClipDurationEntries([
    ...aliasedClips
      .filter((clip) => Number.isFinite(clip.duration) && clip.duration > 0)
      .map((clip) => ({
        durationMs: Math.max(1, Math.round(clip.duration * 1000)),
        name: clip.name,
      })),
    ...(
      selectedDurationMs
        ? [
            ...preferredMotionNames,
            ...motionSource.clipNames,
          ].map((name) => ({
            durationMs: selectedDurationMs,
            name,
          }))
        : []
    ),
  ]);
}

function loadMotionClipsFromGltfFamilySource(
  sourceUrl: string,
  format: Extract<PetContentMotionAssetFormat, 'glb' | 'gltf'>,
) {
  return new Promise<LoadedAvatar3DMotionAssetClips>((resolve, reject) => {
    const loader = new GLTFLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (gltf) => {
        resolve({
          clips: gltf.animations.filter((clip): clip is THREE.AnimationClip => clip instanceof THREE.AnimationClip),
          format,
          sourceUrl,
        });
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function loadMotionClipsFromFbxSource(sourceUrl: string) {
  return new Promise<LoadedAvatar3DMotionAssetClips>((resolve, reject) => {
    const loader = new FBXLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (fbx) => {
        resolve({
          clips: fbx.animations.filter((clip): clip is THREE.AnimationClip => clip instanceof THREE.AnimationClip),
          format: 'fbx',
          sourceUrl,
        });
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function loadMotionClipsFromVrmaSource(sourceUrl: string, vrm: VRM) {
  return new Promise<LoadedAvatar3DMotionAssetClips>((resolve, reject) => {
    const loader = new GLTFLoader(new THREE.LoadingManager());
    configureVRMAnimationLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (gltf) => {
        const rawClips = gltf.animations.filter((clip): clip is THREE.AnimationClip => (
          clip instanceof THREE.AnimationClip
        ));
        const vrmAnimations = Array.isArray((gltf as VRMEnabledGLTF).userData.vrmAnimations)
          ? (gltf as VRMEnabledGLTF).userData.vrmAnimations
          : [];
        const clips = vrmAnimations.map((vrmAnimation, index) => {
          const clip = stripVRMAnimationLookAtTracks(createVRMAnimationClip(vrmAnimation, vrm), vrm);
          clip.name = rawClips[index]?.name?.trim() || `vrma-clip-${index + 1}`;
          return clip;
        });

        resolve({
          clips,
          format: VRMA_MOTION_ASSET_FORMAT,
          sourceUrl,
        });
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function isVRMLookAtQuaternionProxyLike(object: THREE.Object3D) {
  const candidate = object as THREE.Object3D & {
    _applyToLookAt?: unknown;
    type?: string;
  };
  const normalizedName = candidate.name.trim().toLowerCase();
  return (
    candidate.type === 'VRMLookAtQuaternionProxy'
    || normalizedName === 'vrmlookatquaternionproxy'
    || typeof candidate._applyToLookAt === 'function'
  );
}

function collectVRMLookAtTrackNames(vrm: VRM) {
  const trackNames = new Set<string>([
    'VRMLookAtQuaternionProxy.quaternion',
    'VRMLookAtQuaternionProxy.rotation',
  ]);

  vrm.scene.traverse((child) => {
    if (!isVRMLookAtQuaternionProxyLike(child)) {
      return;
    }

    const proxyName = child.name.trim();
    if (!proxyName) {
      return;
    }

    trackNames.add(`${proxyName}.quaternion`);
    trackNames.add(`${proxyName}.rotation`);
  });

  return trackNames;
}

function isVRMLookAtTrackName(trackName: string, lookAtTrackNameSet: Set<string>) {
  const normalizedTrackName = trackName.trim();
  if (!normalizedTrackName) {
    return false;
  }

  if (lookAtTrackNameSet.has(normalizedTrackName)) {
    return true;
  }

  return normalizedTrackName.toLowerCase().includes('vrmlookatquaternionproxy');
}

function stripVRMAnimationLookAtTracks(clip: THREE.AnimationClip, vrm: VRM) {
  const lookAtTrackNameSet = collectVRMLookAtTrackNames(vrm);
  const droppedTrackNames = clip.tracks
    .map((track) => track.name.trim())
    .filter((trackName) => isVRMLookAtTrackName(trackName, lookAtTrackNameSet));
  const filteredTracks = clip.tracks.filter((track) => !isVRMLookAtTrackName(track.name, lookAtTrackNameSet));

  if (filteredTracks.length === clip.tracks.length) {
    return clip;
  }

  const sanitizedClip = new THREE.AnimationClip(
    clip.name,
    clip.duration,
    filteredTracks,
    clip.blendMode,
  );
  sanitizedClip.userData = {
    ...(clip.userData ?? {}),
    desktopPetDroppedLookAtTrackCount: droppedTrackNames.length,
    desktopPetDroppedLookAtTrackNames: droppedTrackNames,
    desktopPetDroppedLookAtTrack: true,
  };
  sanitizedClip.resetDuration();
  return sanitizedClip;
}

function removeVRMLookAtQuaternionProxyNodes(vrm: VRM) {
  const removableNodes: THREE.Object3D[] = [];

  vrm.scene.traverse((child) => {
    if (isVRMLookAtQuaternionProxyLike(child)) {
      removableNodes.push(child);
    }
  });

  removableNodes.forEach((child) => {
    child.parent?.remove(child);
  });

  return removableNodes.length;
}

function loadAvatar3DMotionAssetClips(
  source: ResolvedPetContentMotionAssetSource,
  options?: {
    vrm?: VRM | null;
  },
) {
  if (!source.format) {
    return Promise.reject(new Error(`Unsupported motion asset format for ${source.sourceUrl}`));
  }

  if (source.format === VRMA_MOTION_ASSET_FORMAT) {
    if (!options?.vrm) {
      return Promise.reject(new Error(`VRMA motion source requires a loaded VRM instance: ${source.sourceUrl}`));
    }

    return loadMotionClipsFromVrmaSource(source.sourceUrl, options.vrm);
  }

  if (source.format === 'motion3') {
    return Promise.reject(new Error(`Live2D motion3 source is not supported by the 3D runtime: ${source.sourceUrl}`));
  }

  const cacheKey = `${source.format}|${source.sourceUrl}`;
  const cachedRequest = avatar3DMotionAssetRequestCache.get(cacheKey);
  if (cachedRequest) {
    return cachedRequest;
  }

  const requestPromise = (
    source.format === 'fbx'
      ? loadMotionClipsFromFbxSource(source.sourceUrl)
      : loadMotionClipsFromGltfFamilySource(source.sourceUrl, source.format)
  );

  avatar3DMotionAssetRequestCache.set(cacheKey, requestPromise);
  return requestPromise;
}

function mergeLoadedAvatar3DExternalMotionClipsResults(
  ...results: Array<LoadedAvatar3DExternalMotionClipsResult | null | undefined>
): LoadedAvatar3DExternalMotionClipsResult {
  const clipMap = new Map<string, THREE.AnimationClip>();
  const failedSourceUrlSet = new Set<string>();
  const sourceUrlSet = new Set<string>();

  results.forEach((result) => {
    if (!result) {
      return;
    }

    result.sourceUrls.forEach((sourceUrl) => {
      sourceUrlSet.add(sourceUrl);
    });
    result.failedSourceUrls.forEach((sourceUrl) => {
      failedSourceUrlSet.add(sourceUrl);
    });
    result.clips.forEach((clip, index) => {
      const normalizedClipName = normalizeAnimationClipName(clip.name) || `__unnamed_clip_${index}`;
      if (!clipMap.has(normalizedClipName)) {
        clipMap.set(normalizedClipName, clip);
      }
    });
  });

  return {
    clips: Array.from(clipMap.values()),
    failedSourceUrls: Array.from(failedSourceUrlSet),
    loadedAssetCount: sourceUrlSet.size,
    sourceUrls: Array.from(sourceUrlSet),
  };
}

export async function loadAvatar3DExternalMotionClips({
  contentManifest,
  contentManifestSourceUrl,
  modelUrl,
  supportedFormats = null,
  vrm = null,
}: {
  contentManifest?: PetContentManifest | null;
  contentManifestSourceUrl?: string | null;
  modelUrl: string;
  supportedFormats?: PetContentMotionAssetFormat[] | null;
  vrm?: VRM | null;
}): Promise<LoadedAvatar3DExternalMotionClipsResult> {
  if (!contentManifest) {
    return {
      clips: [],
      failedSourceUrls: [],
      loadedAssetCount: 0,
      sourceUrls: [],
    };
  }

  const resolvedBaseSourceUrl = contentManifestSourceUrl ?? modelUrl;
  const collectedClips = new Map<string, THREE.AnimationClip>();
  const sourceUrlSet = new Set<string>();
  const failedSourceUrlSet = new Set<string>();
  const supportedFormatSet = supportedFormats?.length
    ? new Set<PetContentMotionAssetFormat>(supportedFormats)
    : null;

  for (const motionKey of SUPPORTED_PET_CONTENT_MOTION_KEYS) {
    const motionNames = resolvePetContentMotionNames(contentManifest, motionKey);
    const motionSources = resolvePetContentMotionAssetSources(
      contentManifest,
      motionKey,
      resolvedBaseSourceUrl,
    );

    for (const motionSource of motionSources) {
      if (supportedFormatSet && (!motionSource.format || !supportedFormatSet.has(motionSource.format))) {
        continue;
      }

      if (motionSource.format === VRMA_MOTION_ASSET_FORMAT && !vrm) {
        continue;
      }

      try {
        const loadedAsset = await loadAvatar3DMotionAssetClips(motionSource, { vrm });
        const selectedClips = filterAnimationClipsByNames(
          loadedAsset.clips,
          motionSource.clipNames,
        );
        const preferredMotionNames = motionSource.motionNames.length
          ? motionSource.motionNames
          : motionNames;
        const aliasedClips = applyMotionNameAliases(selectedClips, preferredMotionNames)
          .map((clip) => prepareExternalMotionClipForRuntime(clip, motionKey));

        if (!aliasedClips.length) {
          continue;
        }

        registerResolvedExternalMotionClipDurations({
          aliasedClips,
          motionSource,
          preferredMotionNames,
          selectedClips,
        });
        sourceUrlSet.add(loadedAsset.sourceUrl);
        aliasedClips.forEach((clip) => {
          const normalizedClipName = normalizeAnimationClipName(clip.name);
          if (!normalizedClipName || collectedClips.has(normalizedClipName)) {
            return;
          }

          collectedClips.set(normalizedClipName, clip);
        });
      } catch {
        failedSourceUrlSet.add(motionSource.sourceUrl);
      }
    }
  }

  return {
    clips: Array.from(collectedClips.values()),
    failedSourceUrls: Array.from(failedSourceUrlSet),
    loadedAssetCount: sourceUrlSet.size,
    sourceUrls: Array.from(sourceUrlSet),
  };
}

function yieldToMainThread() {
  return new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    globalThis.setTimeout(() => resolve(), 0);
  });
}

type LoadVRMAssetInstanceOptions = {
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  externalMotionClipsResult?: LoadedAvatar3DExternalMotionClipsResult | null;
  sourceUrl: string;
};

async function resolveVRMContentManifestOptions({
  contentManifest,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  sourceUrl,
}: LoadVRMAssetInstanceOptions) {
  if (contentManifestResolved) {
    return {
      manifest: contentManifest ?? null,
      sourceUrl: contentManifestSourceUrl,
    };
  }

  return loadPetContentManifestForModel(sourceUrl);
}

export function loadVRMAssetInstance({
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  externalMotionClipsResult = null,
  sourceUrl,
}: LoadVRMAssetInstanceOptions) {
  return new Promise<LoadedVRMAssetInstance>((resolve, reject) => {
    const loadingManager = new THREE.LoadingManager();
    const loader = new GLTFLoader(loadingManager);
    configureVRMLoader(loader, sourceUrl);

    loader.load(
      sourceUrl,
      (gltf) => {
        void (async () => {
          const vrm = (gltf as VRMEnabledGLTF).userData.vrm;
          if (!vrm) {
            throw new Error(`VRM loader did not expose gltf.userData.vrm for ${sourceUrl}`);
          }

          const contentManifestResult = await resolveVRMContentManifestOptions({
            contentManifest,
            contentManifestResolved,
            contentManifestSourceUrl,
            sourceUrl,
          });
          const resolvedContentManifest = contentManifestResult.manifest;
          const resolvedContentManifestSourceUrl = contentManifestResult.sourceUrl;

          VRMUtils.rotateVRM0(vrm);
          await yieldToMainThread();
          VRMUtils.combineSkeletons(vrm.scene);
          const scene = prepareObjectForDisplay(vrm.scene);
          scene.updateMatrixWorld(true);
          await yieldToMainThread();
          const reactionDebug = createVRMReactionDebugSummary(vrm, resolvedContentManifest, sourceUrl);
          const lookAtDebug = createVRMLookAtDebugSummary(vrm);
          const resolvedExternalMotionClipsResult = externalMotionClipsResult ?? await loadAvatar3DExternalMotionClips({
            contentManifest: resolvedContentManifest,
            contentManifestSourceUrl: resolvedContentManifestSourceUrl,
            modelUrl: sourceUrl,
            vrm,
          });
          const resolvedVrmaMotionClipsResult = externalMotionClipsResult
            ? await loadAvatar3DExternalMotionClips({
              contentManifest: resolvedContentManifest,
              contentManifestSourceUrl: resolvedContentManifestSourceUrl,
              modelUrl: sourceUrl,
              supportedFormats: [VRMA_MOTION_ASSET_FORMAT],
              vrm,
            })
            : null;
          const mergedExternalMotionClipsResult = externalMotionClipsResult
            ? mergeLoadedAvatar3DExternalMotionClipsResults(
              externalMotionClipsResult,
              resolvedVrmaMotionClipsResult,
            )
            : resolvedExternalMotionClipsResult;
          removeVRMLookAtQuaternionProxyNodes(vrm);
          scene.updateMatrixWorld(true);
          const preparedAnimations = gltf.animations.filter((clip): clip is THREE.AnimationClip => (
            clip instanceof THREE.AnimationClip
          ));
          const mergedAnimations = dedupeAnimationClipsByName([
            ...mergedExternalMotionClipsResult.clips,
            ...preparedAnimations,
          ]);
          await yieldToMainThread();

          resolve({
            ...createAnimatedAvatar3DRuntimeInstance({
              clips: mergedAnimations,
              dispose: () => {
                VRMUtils.deepDispose(scene);
              },
              object: scene,
              sourceLabel: 'vrm',
              update: createVRMRuntimeFrameUpdater(vrm, resolvedContentManifest, sourceUrl),
            }),
            debug: {
              animationClipCount: mergedAnimations.length,
              animationClipNames: mergedAnimations.map((clip, index) => clip.name.trim() || `clip-${index + 1}`),
              contentManifestId: resolvedContentManifest?.id ?? null,
              contentManifestSourceUrl: resolvedContentManifestSourceUrl,
              expressionNamesByAction: reactionDebug.expressionNamesByAction,
              externalMotionClipNames: mergedExternalMotionClipsResult.clips.map((clip) => clip.name.trim()).filter(Boolean),
              externalMotionSourceUrls: mergedExternalMotionClipsResult.sourceUrls,
              lookAtAvailable: lookAtDebug.hasLookAt,
              metaVersion: vrm.meta?.metaVersion ?? null,
              mouthExpressionNames: reactionDebug.mouthExpressionNames,
            },
          });
        })().catch((error) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function loadGltfAsset(sourceUrl: string) {
  const cachedRequest = gltfAssetRequestCache.get(sourceUrl);
  if (cachedRequest) {
    return cachedRequest;
  }

  const requestPromise = new Promise<GLTF>((resolve, reject) => {
    const loader = new GLTFLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (gltf) => {
        resolve(gltf as GLTF);
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

  gltfAssetRequestCache.set(sourceUrl, requestPromise);
  return requestPromise;
}

function loadFbxAsset(sourceUrl: string) {
  const cachedRequest = fbxAssetRequestCache.get(sourceUrl);
  if (cachedRequest) {
    return cachedRequest;
  }

  const requestPromise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new FBXLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (fbx) => {
        resolve(fbx);
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

  fbxAssetRequestCache.set(sourceUrl, requestPromise);
  return requestPromise;
}

function loadObjAsset(sourceUrl: string) {
  const cachedRequest = objAssetRequestCache.get(sourceUrl);
  if (cachedRequest) {
    return cachedRequest;
  }

  const requestPromise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new OBJLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (obj) => {
        resolve(obj);
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

  objAssetRequestCache.set(sourceUrl, requestPromise);
  return requestPromise;
}

function loadStlAsset(sourceUrl: string) {
  const cachedRequest = stlAssetRequestCache.get(sourceUrl);
  if (cachedRequest) {
    return cachedRequest;
  }

  const requestPromise = new Promise<THREE.BufferGeometry>((resolve, reject) => {
    const loader = new STLLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (geometry) => {
        resolve(geometry);
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

  stlAssetRequestCache.set(sourceUrl, requestPromise);
  return requestPromise;
}

function loadPmxAsset(sourceUrl: string) {
  const cachedRequest = pmxAssetRequestCache.get(sourceUrl);
  if (cachedRequest) {
    return cachedRequest;
  }

  const requestPromise = new Promise<THREE.SkinnedMesh>((resolve, reject) => {
    const loader = new MMDLoader(new THREE.LoadingManager());
    configure3DAssetLoader(loader, sourceUrl);
    loader.load(
      sourceUrl,
      (mesh) => {
        resolve(mesh as THREE.SkinnedMesh);
      },
      undefined,
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

  pmxAssetRequestCache.set(sourceUrl, requestPromise);
  return requestPromise;
}

async function loadGltfFamilyRuntimeInstance(
  sourceUrl: string,
  contentManifest: PetContentManifest | null,
  externalMotionClips: THREE.AnimationClip[],
) {
  const gltf = await loadGltfAsset(sourceUrl);
  const combinedClips = dedupeAnimationClipsByName([
    ...externalMotionClips,
    ...gltf.animations,
  ]);
  const object = createPreparedSkeletonClone(gltf.scene);

  return createAnimatedAvatar3DRuntimeInstance({
    clips: combinedClips,
    object,
    sourceLabel: 'gltf',
    update: composeAvatar3DFrameUpdaters(
      createMorphTargetRuntimeFrameUpdater(object, contentManifest),
      createGenericAvatar3DLookAtFrameUpdater(object),
    ),
  });
}

async function loadFbxRuntimeInstance(
  sourceUrl: string,
  contentManifest: PetContentManifest | null,
  externalMotionClips: THREE.AnimationClip[],
) {
  const fbx = await loadFbxAsset(sourceUrl);
  const combinedClips = dedupeAnimationClipsByName([
    ...externalMotionClips,
    ...fbx.animations,
  ]);
  const object = createPreparedSkeletonClone(fbx);

  return createAnimatedAvatar3DRuntimeInstance({
    clips: combinedClips,
    object,
    sourceLabel: 'fbx',
    update: composeAvatar3DFrameUpdaters(
      createMorphTargetRuntimeFrameUpdater(object, contentManifest),
      createGenericAvatar3DLookAtFrameUpdater(object),
    ),
  });
}

async function loadObjRuntimeInstance(sourceUrl: string) {
  const obj = await loadObjAsset(sourceUrl);
  const object = createPreparedDeepClone(obj);
  return createAvatar3DRuntimeInstance({
    object,
    sourceLabel: 'obj',
    update: createGenericAvatar3DLookAtFrameUpdater(object),
  });
}

async function loadStlRuntimeInstance(sourceUrl: string) {
  const geometry = await loadStlAsset(sourceUrl);
  const object = createPreparedStlMesh(geometry);
  return createAvatar3DRuntimeInstance({
    object,
    sourceLabel: 'stl',
    update: createGenericAvatar3DLookAtFrameUpdater(object),
  });
}

async function loadPmxRuntimeInstance(
  sourceUrl: string,
  contentManifest: PetContentManifest | null,
  externalMotionClips: THREE.AnimationClip[],
) {
  const mesh = await loadPmxAsset(sourceUrl);
  const combinedClips = dedupeAnimationClipsByName([
    ...externalMotionClips,
    ...mesh.animations,
  ]);
  const object = createPreparedSkeletonClone(mesh);

  return createAnimatedAvatar3DRuntimeInstance({
    clips: combinedClips,
    object,
    sourceLabel: 'pmx',
    update: composeAvatar3DFrameUpdaters(
      createMorphTargetRuntimeFrameUpdater(object, contentManifest),
      createGenericAvatar3DLookAtFrameUpdater(object),
    ),
  });
}

export async function loadAvatar3DRuntimeInstanceByFormat({
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  externalMotionClipsResult = null,
  format,
  sourceUrl,
}: {
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  externalMotionClipsResult?: LoadedAvatar3DExternalMotionClipsResult | null;
  format: Supported3DModelFormat;
  sourceUrl: string;
}) {
  const externalMotionClips = externalMotionClipsResult?.clips ?? [];

  switch (format) {
    case 'glb':
    case 'gltf':
      return loadGltfFamilyRuntimeInstance(sourceUrl, contentManifest, externalMotionClips);
    case 'vrm':
      return loadVRMAssetInstance({
        contentManifest,
        contentManifestResolved,
        contentManifestSourceUrl,
        externalMotionClipsResult,
        sourceUrl,
      });
    case 'fbx':
      return loadFbxRuntimeInstance(sourceUrl, contentManifest, externalMotionClips);
    case 'obj':
      return loadObjRuntimeInstance(sourceUrl);
    case 'stl':
      return loadStlRuntimeInstance(sourceUrl);
    case 'pmx':
      return loadPmxRuntimeInstance(sourceUrl, contentManifest, externalMotionClips);
    default:
      throw new Error(`Unsupported 3D model format: ${format satisfies never}`);
  }
}

export {
  FBXLoader,
  GLTFLoader,
  MMDLoader,
  OBJLoader,
  STLLoader,
};
