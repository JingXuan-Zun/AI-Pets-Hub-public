import { type PetAction } from './types';

type ExpressionSequenceAction = Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'>;
type AssetActionKey = 'walk' | 'happy' | 'sad' | 'sleeping' | 'eating';
export type PetSequenceAssetKey = AssetActionKey;

type SequenceVariantCollection = {
  allFrames: string[];
  variants: string[][];
};

type PetSequenceRegistryEntry = {
  allFrames: string[];
  expressions: Partial<Record<ExpressionSequenceAction, SequenceVariantCollection>>;
  walk: SequenceVariantCollection;
};

const walkFrameModules = import.meta.glob('./assets/pet-*/walk/**/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const happyFrameModules = import.meta.glob('./assets/pet-*/happy/**/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const sadFrameModules = import.meta.glob('./assets/pet-*/sad/**/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const sleepingFrameModules = import.meta.glob('./assets/pet-*/sleeping/**/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const eatingFrameModules = import.meta.glob('./assets/pet-*/eating/**/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const BUILTIN_PET2_WALK_ALIAS = 'builtin:pet-2-walk-2d';
const PET2_WALK_PATH_PATTERN = /(?:^|\/)pet-2\/walk\/.+\.png(?:[?#].*)?$/i;
const PET_ASSET_PATH_PATTERN = /(?:^|\/)(pet-\d+)\/(?:walk|happy|sad|sleeping|eating)\//i;

const EXPRESSION_ACTION_TO_ASSET_ACTION: Record<ExpressionSequenceAction, Exclude<AssetActionKey, 'walk'>> = {
  EATING: 'eating',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleeping',
};
const SEQUENCE_ASSET_ALIAS_MAP: Record<string, PetSequenceAssetKey> = {
  eat: 'eating',
  eating: 'eating',
  happy: 'happy',
  idle: 'walk',
  moving: 'walk',
  run: 'walk',
  running: 'walk',
  sad: 'sad',
  sleep: 'sleeping',
  sleeping: 'sleeping',
  swim: 'walk',
  swimming: 'walk',
  walk: 'walk',
  walking: 'walk',
};

function createEmptySequenceCollection(): SequenceVariantCollection {
  return {
    allFrames: [],
    variants: [],
  };
}

function normalizeAssetPath(path: string) {
  return path.replace(/\\/g, '/');
}

function extractFrameOrder(path: string) {
  const normalizedPath = normalizeAssetPath(path);
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
  const matched = fileName.match(/(\d+)(?=\.png$)/i);
  return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER;
}

function sortFrameEntries(leftEntry: [string, string], rightEntry: [string, string]) {
  const orderDelta = extractFrameOrder(leftEntry[0]) - extractFrameOrder(rightEntry[0]);
  if (orderDelta !== 0) {
    return orderDelta;
  }

  return leftEntry[0].localeCompare(rightEntry[0], undefined, { numeric: true });
}

function parseSequenceFramePath(modulePath: string, expectedAction: AssetActionKey) {
  const normalizedPath = normalizeAssetPath(modulePath);
  const matched = normalizedPath.match(/(?:^\.\/)?assets\/(pet-[^/]+)\/([^/]+)\/(.+)$/u);
  if (!matched) {
    return null;
  }

  const [, petId, actionKey, relativePath] = matched;
  if (actionKey !== expectedAction) {
    return null;
  }

  const lastSlashIndex = relativePath.lastIndexOf('/');
  const variantKey = lastSlashIndex >= 0 ? relativePath.slice(0, lastSlashIndex) : '__root__';

  return {
    petId,
    relativePath,
    variantKey,
  };
}

function buildSequenceCollectionsByPet(
  frameModules: Record<string, string>,
  expectedAction: AssetActionKey,
) {
  const groupedEntries = new Map<string, Map<string, Array<[string, string]>>>();

  Object.entries(frameModules).forEach(([modulePath, url]) => {
    const parsedPath = parseSequenceFramePath(modulePath, expectedAction);
    if (!parsedPath) {
      return;
    }

    const petVariants = groupedEntries.get(parsedPath.petId) ?? new Map<string, Array<[string, string]>>();
    const variantEntries = petVariants.get(parsedPath.variantKey) ?? [];
    variantEntries.push([parsedPath.relativePath, url]);
    petVariants.set(parsedPath.variantKey, variantEntries);
    groupedEntries.set(parsedPath.petId, petVariants);
  });

  const collectionsByPet = new Map<string, SequenceVariantCollection>();

  groupedEntries.forEach((variantsByKey, petId) => {
    const variants = Array.from(variantsByKey.entries())
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, undefined, { numeric: true }))
      .map(([, frameEntries]) => frameEntries.sort(sortFrameEntries).map(([, url]) => url))
      .filter((frames) => frames.length > 0);

    collectionsByPet.set(petId, {
      allFrames: variants.flat(),
      variants,
    });
  });

  return collectionsByPet;
}

function pickRandomVariant(variants: string[][]) {
  if (variants.length === 0) {
    return null;
  }

  const nextIndex = Math.floor(Math.random() * variants.length);
  return variants[nextIndex] ?? variants[0] ?? null;
}

const walkCollectionsByPet = buildSequenceCollectionsByPet(walkFrameModules, 'walk');
const happyCollectionsByPet = buildSequenceCollectionsByPet(happyFrameModules, 'happy');
const sadCollectionsByPet = buildSequenceCollectionsByPet(sadFrameModules, 'sad');
const sleepingCollectionsByPet = buildSequenceCollectionsByPet(sleepingFrameModules, 'sleeping');
const eatingCollectionsByPet = buildSequenceCollectionsByPet(eatingFrameModules, 'eating');

function createPetSequenceRegistry() {
  const petIds = new Set<string>([
    ...walkCollectionsByPet.keys(),
    ...happyCollectionsByPet.keys(),
    ...sadCollectionsByPet.keys(),
    ...sleepingCollectionsByPet.keys(),
    ...eatingCollectionsByPet.keys(),
  ]);
  const registry = new Map<string, PetSequenceRegistryEntry>();
  const frameUrlToPetId = new Map<string, string>();

  petIds.forEach((petId) => {
    const walk = walkCollectionsByPet.get(petId) ?? createEmptySequenceCollection();
    const expressions: PetSequenceRegistryEntry['expressions'] = {
      HAPPY: happyCollectionsByPet.get(petId),
      SAD: sadCollectionsByPet.get(petId),
      SLEEPING: sleepingCollectionsByPet.get(petId),
      EATING: eatingCollectionsByPet.get(petId),
    };
    const allFrames = [
      ...walk.allFrames,
      ...(expressions.HAPPY?.allFrames ?? []),
      ...(expressions.SAD?.allFrames ?? []),
      ...(expressions.SLEEPING?.allFrames ?? []),
      ...(expressions.EATING?.allFrames ?? []),
    ];

    registry.set(petId, {
      allFrames,
      expressions,
      walk,
    });

    allFrames.forEach((url) => {
      frameUrlToPetId.set(url, petId);
    });
  });

  return {
    frameUrlToPetId,
    registry,
  };
}

const { frameUrlToPetId, registry: petSequenceRegistry } = createPetSequenceRegistry();
const defaultWalkCollection = petSequenceRegistry.get('pet-1')?.walk ?? createEmptySequenceCollection();
const pet2WalkCollection = petSequenceRegistry.get('pet-2')?.walk ?? createEmptySequenceCollection();

export const DEFAULT_WALK_SEQUENCE_FRAMES = defaultWalkCollection.variants[0] ?? [];
export const PET2_WALK_SEQUENCE_FRAMES = pet2WalkCollection.variants[0] ?? [];

const defaultWalkFrameSet = new Set(DEFAULT_WALK_SEQUENCE_FRAMES);
const pet2WalkFrameSet = new Set(PET2_WALK_SEQUENCE_FRAMES);

function resolvePetSequenceIdFromUrl(url: string) {
  if (url === BUILTIN_PET2_WALK_ALIAS || PET2_WALK_PATH_PATTERN.test(url)) {
    return 'pet-2';
  }

  if (frameUrlToPetId.has(url)) {
    return frameUrlToPetId.get(url) ?? null;
  }

  const matchedPath = normalizeAssetPath(url).match(PET_ASSET_PATH_PATTERN);
  return matchedPath?.[1] ?? null;
}

function resolveSequenceCollectionByAssetKey(
  petId: string,
  assetKey: PetSequenceAssetKey,
) {
  const petEntry = petSequenceRegistry.get(petId);
  if (!petEntry) {
    return null;
  }

  switch (assetKey) {
    case 'walk':
      return petEntry.walk;
    case 'happy':
      return petEntry.expressions.HAPPY ?? null;
    case 'sad':
      return petEntry.expressions.SAD ?? null;
    case 'sleeping':
      return petEntry.expressions.SLEEPING ?? null;
    case 'eating':
      return petEntry.expressions.EATING ?? null;
    default:
      return null;
  }
}

function normalizePetSequenceAssetKey(
  value: string | null | undefined,
): PetSequenceAssetKey | null {
  if (!value) {
    return null;
  }

  return SEQUENCE_ASSET_ALIAS_MAP[value.trim().toLowerCase()] ?? null;
}

export type PetSequenceManifestSummary = {
  availableAssetKeys: PetSequenceAssetKey[];
  petId: string;
};

export function resolvePetSequenceManifestSummary(
  url: string,
): PetSequenceManifestSummary | null {
  const petId = resolvePetSequenceIdFromUrl(url);
  if (!petId) {
    return null;
  }

  const petEntry = petSequenceRegistry.get(petId);
  if (!petEntry) {
    return null;
  }

  const availableAssetKeys = ([
    petEntry.walk.allFrames.length > 0 ? 'walk' : null,
    petEntry.expressions.HAPPY?.allFrames.length ? 'happy' : null,
    petEntry.expressions.SAD?.allFrames.length ? 'sad' : null,
    petEntry.expressions.SLEEPING?.allFrames.length ? 'sleeping' : null,
    petEntry.expressions.EATING?.allFrames.length ? 'eating' : null,
  ].filter((value): value is PetSequenceAssetKey => Boolean(value)));

  if (availableAssetKeys.length === 0) {
    return null;
  }

  return {
    availableAssetKeys,
    petId,
  };
}

export function resolvePetSequenceFramesByAssetNames(
  url: string,
  assetNames: string[],
  options?: {
    pickRandomVariant?: boolean;
  },
) {
  const petId = resolvePetSequenceIdFromUrl(url);
  if (!petId) {
    return null;
  }

  const pickRandomVariantEnabled = options?.pickRandomVariant ?? false;

  for (const assetName of assetNames) {
    const assetKey = normalizePetSequenceAssetKey(assetName);
    if (!assetKey) {
      continue;
    }

    const collection = resolveSequenceCollectionByAssetKey(petId, assetKey);
    if (!collection || collection.variants.length === 0) {
      continue;
    }

    return pickRandomVariantEnabled
      ? (pickRandomVariant(collection.variants) ?? null)
      : (collection.variants[0] ?? null);
  }

  return null;
}

export function isDefaultWalkSequenceUrl(url: string) {
  return defaultWalkFrameSet.has(url);
}

export function isPet2WalkSequenceUrl(url: string) {
  return pet2WalkFrameSet.has(url) || url === BUILTIN_PET2_WALK_ALIAS || PET2_WALK_PATH_PATTERN.test(url);
}

export function resolveWalkSequenceFrames(url: string) {
  const petId = resolvePetSequenceIdFromUrl(url);
  if (!petId) {
    return null;
  }

  const walkCollection = petSequenceRegistry.get(petId)?.walk;
  return walkCollection?.variants[0] ?? null;
}

export function resolveExpressionSequenceVariant(
  url: string,
  action: PetAction | null | undefined,
) {
  if (!action || !(action in EXPRESSION_ACTION_TO_ASSET_ACTION)) {
    return null;
  }

  const petId = resolvePetSequenceIdFromUrl(url);
  if (!petId) {
    return null;
  }

  const expressionAction = action as ExpressionSequenceAction;
  const expressionCollection = petSequenceRegistry.get(petId)?.expressions[expressionAction];
  return pickRandomVariant(expressionCollection?.variants ?? []);
}
