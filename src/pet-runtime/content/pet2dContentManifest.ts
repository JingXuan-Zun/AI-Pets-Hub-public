import {
  resolveExpressionSequenceVariant,
  resolvePetSequenceFramesByAssetNames,
  resolvePetSequenceManifestSummary,
  resolveWalkSequenceFrames,
} from '../../petAnimationSequences';
import { type PetAction } from '../../types';
import {
  resolvePetContentExpressionNames,
  resolvePetContentMotionNames,
  resolvePetContentSequenceAssetFrames,
  type PetContentManifest,
  type PetContentMotionKey,
} from './petContentManifest';

type Pet2DExpressionAction = Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'>;

const PET2D_EXPRESSION_KEY_BY_ACTION = {
  EATING: 'eating',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleeping',
} as const;

function resolveDefaultPet2DDisplayName(petId: string) {
  return petId.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function resolveBuiltInPet2DMotionManifest(availableAssetKeys: string[]) {
  const availableAssetKeySet = new Set(availableAssetKeys);

  return {
    eating: availableAssetKeySet.has('eating') ? ['eating'] : [],
    happy: availableAssetKeySet.has('happy') ? ['happy'] : [],
    moving: availableAssetKeySet.has('walk') ? ['walk'] : [],
    running: availableAssetKeySet.has('walk') ? ['walk'] : [],
    sad: availableAssetKeySet.has('sad') ? ['sad'] : [],
    sleeping: availableAssetKeySet.has('sleeping') ? ['sleeping'] : [],
    swimming: availableAssetKeySet.has('walk') ? ['walk'] : [],
    walking: availableAssetKeySet.has('walk') ? ['walk'] : [],
  } satisfies Partial<Record<PetContentMotionKey, string[]>>;
}

function resolveBuiltInPet2DExpressionManifest(availableAssetKeys: string[]) {
  const availableAssetKeySet = new Set(availableAssetKeys);

  return {
    eating: availableAssetKeySet.has('eating') ? ['eating'] : [],
    happy: availableAssetKeySet.has('happy') ? ['happy'] : [],
    sad: availableAssetKeySet.has('sad') ? ['sad'] : [],
    sleeping: availableAssetKeySet.has('sleeping') ? ['sleeping'] : [],
  } satisfies PetContentManifest['expressions'];
}

export function resolveBuiltInPet2DContentManifest(
  modelUrl: string,
): PetContentManifest | null {
  const sequenceSummary = resolvePetSequenceManifestSummary(modelUrl);
  if (!sequenceSummary) {
    return null;
  }

  return {
    expressions: resolveBuiltInPet2DExpressionManifest(sequenceSummary.availableAssetKeys),
    id: `${sequenceSummary.petId}-2d-sequence`,
    interaction: {},
    model: {
      defaultScale: 1,
      type: '2d',
      url: modelUrl,
    },
    motions: resolveBuiltInPet2DMotionManifest(sequenceSummary.availableAssetKeys),
    motionPolicy: {
      message: {
        eating: {
          default: {
            lockMsMin: 320,
            mode: 'replace',
            overrideMotionKey: 'eating',
          },
        },
        happy: {
          whileIdle: {
            mode: 'soft-stop',
            overrideMotionKey: 'happy',
          },
          whileMoving: {
            mode: 'preserve',
            overrideMotionKey: 'happy',
          },
        },
        sad: {
          whileIdle: {
            mode: 'soft-stop',
            overrideMotionKey: 'sad',
          },
          whileMoving: {
            mode: 'preserve',
            overrideMotionKey: 'sad',
          },
        },
        sleeping: {
          default: {
            lockMsMin: 720,
            mode: 'replace',
            overrideMotionKey: 'sleeping',
          },
        },
      },
    },
    name: resolveDefaultPet2DDisplayName(sequenceSummary.petId),
    visemes: {},
  } satisfies PetContentManifest;
}

export function resolvePet2DMotionSequenceFrames(
  manifest: PetContentManifest | null | undefined,
  modelUrl: string,
  motionKey: PetContentMotionKey,
) {
  const configuredMotionNames = resolvePetContentMotionNames(manifest, motionKey);
  const fallbackMotionNames = motionKey === 'walking'
    || motionKey === 'running'
    || motionKey === 'swimming'
    ? resolvePetContentMotionNames(manifest, 'moving')
    : [];
  const externalSequenceFrames = resolvePetContentSequenceAssetFrames(
    manifest,
    [
      ...configuredMotionNames,
      ...fallbackMotionNames,
      motionKey,
      ...(motionKey === 'walking' || motionKey === 'running' || motionKey === 'swimming'
        ? ['moving']
        : []),
    ],
  );
  if (externalSequenceFrames) {
    return externalSequenceFrames;
  }

  const resolvedSequenceFrames = resolvePetSequenceFramesByAssetNames(
    modelUrl,
    [...configuredMotionNames, ...fallbackMotionNames],
  );

  return resolvedSequenceFrames ?? resolveWalkSequenceFrames(modelUrl);
}

export function resolvePet2DExpressionSequenceFrames(
  manifest: PetContentManifest | null | undefined,
  modelUrl: string,
  expressionAction: Pet2DExpressionAction | null | undefined,
) {
  if (!expressionAction) {
    return null;
  }

  const expressionKey = PET2D_EXPRESSION_KEY_BY_ACTION[expressionAction];
  const configuredExpressionNames = resolvePetContentExpressionNames(manifest, expressionKey);
  const externalSequenceFrames = resolvePetContentSequenceAssetFrames(
    manifest,
    [...configuredExpressionNames, expressionKey],
    { pickRandomVariant: true },
  );
  if (externalSequenceFrames) {
    return externalSequenceFrames;
  }

  const resolvedSequenceFrames = resolvePetSequenceFramesByAssetNames(
    modelUrl,
    configuredExpressionNames,
    { pickRandomVariant: true },
  );

  return resolvedSequenceFrames ?? resolveExpressionSequenceVariant(modelUrl, expressionAction);
}
