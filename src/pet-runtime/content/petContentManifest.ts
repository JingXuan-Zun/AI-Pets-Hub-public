import {
  resolve3DModelDependencyUrl,
} from '../../model3dFormatSupport';
import { type ModelType, type PetAction } from '../../types';

export type PetContentExpressionKey =
  | 'idle'
  | 'talking'
  | 'happy'
  | 'sad'
  | 'sleeping'
  | 'eating'
  | 'dragging'
  | 'hover-head'
  | 'hover-body'
  | 'hover-hand-left'
  | 'hover-hand-right';

export type PetContentModelManifest = {
  defaultScale?: number;
  type: ModelType;
  url: string;
};

export type PetContentMotionKey =
  | Lowercase<PetAction>
  | 'moving'
  | 'hover-head'
  | 'hover-body'
  | 'hover-hand-left'
  | 'hover-hand-right';

export const SUPPORTED_PET_CONTENT_MOTION_ASSET_FORMATS = ['fbx', 'glb', 'gltf', 'motion3', 'vrma'] as const;
export type PetContentMotionAssetFormat = (typeof SUPPORTED_PET_CONTENT_MOTION_ASSET_FORMATS)[number];

export type PetContentMotionAssetSource = {
  clipNames?: string[];
  format?: PetContentMotionAssetFormat;
  motionNames?: string[];
  url: string;
};

export type PetContentMotionAutoSourceDefinition = {
  directories?: string[];
  formats?: PetContentMotionAssetFormat[];
  includeMotionNames?: boolean;
};

export type PetContentMotionDefinition = string[] | {
  allowInterruption?: boolean;
  autoSources?: boolean | PetContentMotionAutoSourceDefinition;
  clips?: string[];
  completionMode?: 'fallback' | 'freeze' | 'motion-key' | 'resume-base';
  completionMotionKey?: PetContentMotionKey;
  fallbackKeys?: PetContentMotionKey[];
  lockMs?: number;
  loopMode?: 'once' | 'repeat';
  playbackRate?: number;
  priority?: number;
  sources?: PetContentMotionAssetSource[];
};

export type PetContentMotionManifest = Partial<Record<PetContentMotionKey, PetContentMotionDefinition>>;
export type PetContentMotionOverrideMode = 'preserve' | 'soft-stop' | 'replace';
export type PetContentReactionActionKey = 'eating' | 'happy' | 'sad' | 'sleeping';
export type PetContentMotionPolicySource = 'fallback' | 'hover' | 'message' | 'speaking';

export type PetContentMotionOverrideRule = {
  lockMsMin?: number;
  mode?: PetContentMotionOverrideMode;
  overrideMotionKey?: PetContentMotionKey;
  playbackRateMultiplier?: number;
  priorityBoost?: number;
};

export type PetContentMotionOverrideProfile = PetContentMotionOverrideRule | {
  default?: PetContentMotionOverrideRule;
  whileIdle?: PetContentMotionOverrideRule;
  whileMoving?: PetContentMotionOverrideRule;
};

export type PetContentMotionPolicyManifest = {
  fallback?: Partial<Record<PetContentReactionActionKey, PetContentMotionOverrideProfile>>;
  hover?: PetContentMotionOverrideProfile;
  message?: Partial<Record<PetContentReactionActionKey, PetContentMotionOverrideProfile>>;
  speaking?: PetContentMotionOverrideProfile;
};

export type PetContentExpressionManifest = Partial<Record<PetContentExpressionKey, string[]>>;
export type PetContentSequenceAssetDefinition = string[] | string[][];
export type PetContentSequenceAssetManifest = Partial<Record<string, PetContentSequenceAssetDefinition>>;

export type PetContentVisemeManifest = Partial<Record<'aa' | 'ih' | 'ou' | 'ee' | 'oh', string>>;
export type PetContentVisemeKey = keyof PetContentVisemeManifest;

export type PetContentInteractionManifest = {
  hoverRegions?: string[];
};

export type PetContentManifest = {
  expressions?: PetContentExpressionManifest;
  id: string;
  interaction?: PetContentInteractionManifest;
  model: PetContentModelManifest;
  motions?: PetContentMotionManifest;
  motionPolicy?: PetContentMotionPolicyManifest;
  name: string;
  sequenceAssets?: PetContentSequenceAssetManifest;
  visemes?: PetContentVisemeManifest;
};

export function isPetContentManifest(value: unknown): value is PetContentManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const nextValue = value as Partial<PetContentManifest>;
  return typeof nextValue.id === 'string'
    && typeof nextValue.name === 'string'
    && Boolean(nextValue.model)
    && typeof nextValue.model?.url === 'string'
    && (nextValue.model?.type === '2d' || nextValue.model?.type === '3d' || nextValue.model?.type === 'live2d');
}

function normalizePetContentSequenceAssetName(value: string) {
  return value.trim().toLowerCase();
}

function normalizePetContentSequenceAssetDefinition(
  value: unknown,
  baseSourceUrl?: string | null,
) {
  if (!Array.isArray(value)) {
    return null;
  }

  const rawVariants = value.every((entry) => typeof entry === 'string')
    ? [value]
    : value.every((entry) => (
      Array.isArray(entry) && entry.every((frameUrl) => typeof frameUrl === 'string')
    ))
      ? value
      : null;

  if (!rawVariants) {
    return null;
  }

  const variants = rawVariants
    .map((rawVariant) => rawVariant
      .map((frameUrl) => (
        baseSourceUrl
          ? resolve3DModelDependencyUrl(frameUrl, baseSourceUrl)
          : frameUrl.trim()
      ))
      .filter((frameUrl): frameUrl is string => typeof frameUrl === 'string' && Boolean(frameUrl.trim())))
    .filter((variant) => variant.length > 0);

  return variants.length > 0 ? variants : null;
}

function normalizePetContentSequenceAssets(
  value: unknown,
  baseSourceUrl?: string | null,
): PetContentSequenceAssetManifest {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value).reduce<PetContentSequenceAssetManifest>((sequenceAssets, [rawAssetName, rawAssetDefinition]) => {
    if (typeof rawAssetName !== 'string') {
      return sequenceAssets;
    }

    const assetName = normalizePetContentSequenceAssetName(rawAssetName);
    if (!assetName) {
      return sequenceAssets;
    }

    const normalizedDefinition = normalizePetContentSequenceAssetDefinition(
      rawAssetDefinition,
      baseSourceUrl,
    );
    if (!normalizedDefinition) {
      return sequenceAssets;
    }

    sequenceAssets[assetName] = normalizedDefinition;
    return sequenceAssets;
  }, {});
}

export function normalizePetContentManifest(
  value: unknown,
  baseSourceUrl?: string | null,
): PetContentManifest | null {
  if (!isPetContentManifest(value)) {
    return null;
  }

  return {
    ...value,
    expressions: value.expressions ?? {},
    interaction: value.interaction ?? {},
    model: {
      ...value.model,
      defaultScale: Number.isFinite(value.model.defaultScale) && value.model.defaultScale! > 0
        ? value.model.defaultScale
        : 1,
    },
    motions: value.motions ?? {},
    motionPolicy: value.motionPolicy ?? {},
    sequenceAssets: normalizePetContentSequenceAssets(value.sequenceAssets, baseSourceUrl),
    visemes: value.visemes ?? {},
  };
}

export function resolvePetContentExpressionNames(
  manifest: PetContentManifest | null | undefined,
  expressionKey: PetContentExpressionKey,
) {
  const rawExpressionNames = manifest?.expressions?.[expressionKey];
  if (!Array.isArray(rawExpressionNames)) {
    return [];
  }

  return Array.from(new Set(
    rawExpressionNames
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

export function resolvePetContentVisemeName(
  manifest: PetContentManifest | null | undefined,
  viseme: PetContentVisemeKey,
) {
  const rawVisemeName = manifest?.visemes?.[viseme];
  return typeof rawVisemeName === 'string' && rawVisemeName.trim()
    ? rawVisemeName.trim()
    : null;
}

function pickPetContentSequenceVariant(variants: string[][]) {
  if (variants.length === 0) {
    return null;
  }

  const nextIndex = Math.floor(Math.random() * variants.length);
  return variants[nextIndex] ?? variants[0] ?? null;
}

export function resolvePetContentSequenceAssetFrames(
  manifest: PetContentManifest | null | undefined,
  assetNames: string[],
  options?: {
    pickRandomVariant?: boolean;
  },
) {
  const sequenceAssets = manifest?.sequenceAssets;
  if (!sequenceAssets) {
    return null;
  }

  const pickRandomVariant = options?.pickRandomVariant ?? false;
  for (const rawAssetName of assetNames) {
    if (typeof rawAssetName !== 'string') {
      continue;
    }

    const assetName = normalizePetContentSequenceAssetName(rawAssetName);
    if (!assetName) {
      continue;
    }

    const rawSequenceAssetDefinition = sequenceAssets[assetName];
    if (!Array.isArray(rawSequenceAssetDefinition) || rawSequenceAssetDefinition.length === 0) {
      continue;
    }

    const rawVariants = rawSequenceAssetDefinition.every((entry) => typeof entry === 'string')
      ? [rawSequenceAssetDefinition]
      : rawSequenceAssetDefinition;
    const variants = rawVariants.filter((variant): variant is string[] => (
      Array.isArray(variant)
      && variant.length > 0
      && variant.every((frameUrl) => typeof frameUrl === 'string' && Boolean(frameUrl.trim()))
    ));
    if (variants.length === 0) {
      continue;
    }

    return pickRandomVariant
      ? (pickPetContentSequenceVariant(variants) ?? null)
      : (variants[0] ?? null);
  }

  return null;
}

export function resolvePetContentMotionNames(
  manifest: PetContentManifest | null | undefined,
  motionKey: PetContentMotionKey,
) {
  const rawMotionDefinition = manifest?.motions?.[motionKey];
  const rawMotionNames = Array.isArray(rawMotionDefinition)
    ? rawMotionDefinition
    : rawMotionDefinition?.clips;
  if (!Array.isArray(rawMotionNames)) {
    return [];
  }

  return Array.from(new Set(
    rawMotionNames
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

export type ResolvedPetContentMotionAssetSource = {
  clipNames: string[];
  format: PetContentMotionAssetFormat | null;
  motionNames: string[];
  sourceUrl: string;
};

export type ResolvedPetContentMotionBehavior = {
  allowInterruption: boolean | null;
  completionMode: 'fallback' | 'freeze' | 'motion-key' | 'resume-base' | null;
  completionMotionKey: PetContentMotionKey | null;
  fallbackKeys: PetContentMotionKey[];
  lockMs: number | null;
  loopMode: 'once' | 'repeat' | null;
  playbackRate: number | null;
  priority: number | null;
};

export type ResolvedPetContentMotionOverrideBehavior = {
  lockMsMin: number | null;
  mode: PetContentMotionOverrideMode | null;
  overrideMotionKey: PetContentMotionKey | null;
  playbackRateMultiplier: number | null;
  priorityBoost: number | null;
};

const SUPPORTED_PET_CONTENT_MOTION_ASSET_FORMAT_SET = new Set<PetContentMotionAssetFormat>([
  ...SUPPORTED_PET_CONTENT_MOTION_ASSET_FORMATS,
]);
const DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_DIRECTORIES = ['motions'] as const;
const DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_FORMATS: PetContentMotionAssetFormat[] = ['glb', 'gltf', 'fbx', 'motion3', 'vrma'];
const DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_FILE_NAMES = ['motion', 'index'] as const;

function normalizePetContentMotionAssetFormat(format: string | null | undefined) {
  if (!format) {
    return null;
  }

  return SUPPORTED_PET_CONTENT_MOTION_ASSET_FORMAT_SET.has(format as PetContentMotionAssetFormat)
    ? format as PetContentMotionAssetFormat
    : null;
}

function resolvePetContentMotionAssetFormatFromUrl(sourceUrl: string) {
  const normalizedUrl = sourceUrl
    .trim()
    .replace(/[?#].*$/u, '')
    .replace(/\\/g, '/')
    .toLowerCase();
  if (normalizedUrl.endsWith('.motion3.json')) {
    return 'motion3' satisfies PetContentMotionAssetFormat;
  }

  const matchedExtension = normalizedUrl.match(/\.([a-z0-9]+)$/iu)?.[1] ?? '';
  return normalizePetContentMotionAssetFormat(matchedExtension);
}

function normalizePetContentMotionPathSegment(value: string) {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/u, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/u, '');
}

function resolvePetContentMotionAutoSourceOptions(
  rawMotionDefinition: PetContentMotionDefinition | undefined,
) {
  if (!rawMotionDefinition || Array.isArray(rawMotionDefinition) || !rawMotionDefinition.autoSources) {
    return null;
  }

  if (rawMotionDefinition.autoSources === true) {
    return {
      directories: [...DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_DIRECTORIES],
      formats: [...DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_FORMATS],
      includeMotionNames: true,
    } satisfies Required<PetContentMotionAutoSourceDefinition>;
  }

  const directories = Array.isArray(rawMotionDefinition.autoSources.directories)
    ? Array.from(new Set(
      rawMotionDefinition.autoSources.directories
        .filter((value): value is string => typeof value === 'string')
        .map(normalizePetContentMotionPathSegment)
        .filter(Boolean),
    ))
    : [...DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_DIRECTORIES];
  const formats = Array.isArray(rawMotionDefinition.autoSources.formats)
    ? Array.from(new Set(
      rawMotionDefinition.autoSources.formats
        .map((value) => normalizePetContentMotionAssetFormat(value))
        .filter((value): value is PetContentMotionAssetFormat => value !== null),
    ))
    : [...DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_FORMATS];

  return {
    directories,
    formats,
    includeMotionNames: rawMotionDefinition.autoSources.includeMotionNames ?? true,
  } satisfies Required<PetContentMotionAutoSourceDefinition>;
}

function resolvePetContentMotionAutoSourcePaths(
  motionKey: PetContentMotionKey,
  motionNames: string[],
  options: Required<PetContentMotionAutoSourceDefinition>,
) {
  const baseNames = Array.from(new Set([
    normalizePetContentMotionPathSegment(motionKey),
    ...(options.includeMotionNames
      ? motionNames.map(normalizePetContentMotionPathSegment).filter(Boolean)
      : []),
  ]));

  return Array.from(new Set(
    options.directories.flatMap((directory) => baseNames.flatMap((baseName) => options.formats.flatMap((format) => ([
      `${directory}/${baseName}.${format}`,
      `${directory}/${baseName}/${baseName}.${format}`,
      ...DEFAULT_PET_CONTENT_MOTION_AUTO_SOURCE_FILE_NAMES.map((fileName) => `${directory}/${baseName}/${fileName}.${format}`),
    ])))),
  ));
}

export function resolvePetContentMotionAssetSources(
  manifest: PetContentManifest | null | undefined,
  motionKey: PetContentMotionKey,
  baseSourceUrl?: string | null,
) {
  const rawMotionDefinition = manifest?.motions?.[motionKey];
  if (!rawMotionDefinition || Array.isArray(rawMotionDefinition)) {
    return [];
  }

  const motionNames = resolvePetContentMotionNames(manifest, motionKey);
  const rawSources = Array.isArray(rawMotionDefinition.sources)
    ? rawMotionDefinition.sources
    : [];
  const autoSourceOptions = resolvePetContentMotionAutoSourceOptions(rawMotionDefinition);
  const autoSourceCandidates = autoSourceOptions
    ? resolvePetContentMotionAutoSourcePaths(motionKey, motionNames, autoSourceOptions)
    : [];

  const resolvedSources = rawSources.reduce<ResolvedPetContentMotionAssetSource[]>((sources, rawSource) => {
    if (!rawSource || typeof rawSource !== 'object' || typeof rawSource.url !== 'string') {
      return sources;
    }

    const sourceUrl = baseSourceUrl
      ? resolve3DModelDependencyUrl(rawSource.url, baseSourceUrl)
      : rawSource.url.trim();
    if (!sourceUrl) {
      return sources;
    }

    const resolvedFormat = normalizePetContentMotionAssetFormat(
      rawSource.format ?? resolvePetContentMotionAssetFormatFromUrl(sourceUrl),
    );

    const clipNames = Array.isArray(rawSource.clipNames)
      ? Array.from(new Set(
        rawSource.clipNames
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      ))
      : [];
    const sourceMotionNames = Array.isArray(rawSource.motionNames)
      ? Array.from(new Set(
        rawSource.motionNames
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      ))
      : [];

    sources.push({
      clipNames,
      format: resolvedFormat,
      motionNames: sourceMotionNames,
      sourceUrl,
    });
    return sources;
  }, []);

  autoSourceCandidates.forEach((candidatePath) => {
    const sourceUrl = baseSourceUrl
      ? resolve3DModelDependencyUrl(candidatePath, baseSourceUrl)
      : candidatePath;
    if (!sourceUrl || resolvedSources.some((source) => source.sourceUrl === sourceUrl)) {
      return;
    }

    resolvedSources.push({
      clipNames: motionNames,
      format: resolvePetContentMotionAssetFormatFromUrl(sourceUrl),
      motionNames,
      sourceUrl,
    });
  });

  return resolvedSources;
}

const SUPPORTED_PET_CONTENT_MOTION_KEY_SET = new Set<PetContentMotionKey>([
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
]);

function normalizePetContentMotionKey(value: string) {
  return SUPPORTED_PET_CONTENT_MOTION_KEY_SET.has(value as PetContentMotionKey)
    ? value as PetContentMotionKey
    : null;
}

function normalizePetContentMotionOverrideMode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value === 'preserve' || value === 'soft-stop' || value === 'replace'
    ? value
    : null;
}

function resolvePetContentMotionOverrideRule(
  value: unknown,
): ResolvedPetContentMotionOverrideBehavior | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const nextValue = value as PetContentMotionOverrideRule;
  const overrideMotionKey = typeof nextValue.overrideMotionKey === 'string'
    ? normalizePetContentMotionKey(nextValue.overrideMotionKey.trim())
    : null;
  const resolvedBehavior = {
    lockMsMin: Number.isFinite(nextValue.lockMsMin) && nextValue.lockMsMin! >= 0
      ? nextValue.lockMsMin!
      : null,
    mode: normalizePetContentMotionOverrideMode(nextValue.mode),
    overrideMotionKey,
    playbackRateMultiplier: Number.isFinite(nextValue.playbackRateMultiplier) && nextValue.playbackRateMultiplier! > 0
      ? nextValue.playbackRateMultiplier!
      : null,
    priorityBoost: Number.isFinite(nextValue.priorityBoost)
      ? nextValue.priorityBoost!
      : null,
  } satisfies ResolvedPetContentMotionOverrideBehavior;

  return resolvedBehavior.lockMsMin !== null
    || resolvedBehavior.mode !== null
    || resolvedBehavior.overrideMotionKey !== null
    || resolvedBehavior.playbackRateMultiplier !== null
    || resolvedBehavior.priorityBoost !== null
    ? resolvedBehavior
    : null;
}

function resolvePetContentMotionOverrideRuleSet(
  value: unknown,
  isMoving: boolean,
) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const nextValue = value as {
    default?: PetContentMotionOverrideRule;
    whileIdle?: PetContentMotionOverrideRule;
    whileMoving?: PetContentMotionOverrideRule;
  };
  const defaultRule = resolvePetContentMotionOverrideRule(nextValue.default);
  const stateRule = resolvePetContentMotionOverrideRule(
    isMoving ? nextValue.whileMoving : nextValue.whileIdle,
  );

  if (!defaultRule && !stateRule) {
    return null;
  }

  return {
    lockMsMin: stateRule?.lockMsMin ?? defaultRule?.lockMsMin ?? null,
    mode: stateRule?.mode ?? defaultRule?.mode ?? null,
    overrideMotionKey: stateRule?.overrideMotionKey ?? defaultRule?.overrideMotionKey ?? null,
    playbackRateMultiplier: stateRule?.playbackRateMultiplier ?? defaultRule?.playbackRateMultiplier ?? null,
    priorityBoost: stateRule?.priorityBoost ?? defaultRule?.priorityBoost ?? null,
  } satisfies ResolvedPetContentMotionOverrideBehavior;
}

function resolvePetContentMotionOverrideProfile(
  profile: PetContentMotionOverrideProfile | undefined,
  isMoving: boolean,
) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  if ('default' in profile || 'whileIdle' in profile || 'whileMoving' in profile) {
    return resolvePetContentMotionOverrideRuleSet(profile, isMoving);
  }

  return resolvePetContentMotionOverrideRule(profile);
}

function resolvePetContentMotionPolicyProfile(
  manifest: PetContentManifest | null | undefined,
  source: PetContentMotionPolicySource,
  actionKey: PetContentReactionActionKey | null,
) {
  switch (source) {
    case 'hover':
      return manifest?.motionPolicy?.hover;
    case 'speaking':
      return manifest?.motionPolicy?.speaking;
    case 'message':
      return actionKey ? manifest?.motionPolicy?.message?.[actionKey] : undefined;
    case 'fallback':
      return actionKey ? manifest?.motionPolicy?.fallback?.[actionKey] : undefined;
    default:
      return undefined;
  }
}

export function resolvePetContentMotionOverrideBehavior(
  manifest: PetContentManifest | null | undefined,
  source: PetContentMotionPolicySource,
  actionKey: PetContentReactionActionKey | null,
  isMoving: boolean,
) {
  return resolvePetContentMotionOverrideProfile(
    resolvePetContentMotionPolicyProfile(manifest, source, actionKey),
    isMoving,
  );
}

export function resolvePetContentMotionBehavior(
  manifest: PetContentManifest | null | undefined,
  motionKey: PetContentMotionKey,
): ResolvedPetContentMotionBehavior | null {
  const rawMotionDefinition = manifest?.motions?.[motionKey];
  if (!rawMotionDefinition || Array.isArray(rawMotionDefinition)) {
    return null;
  }

  const fallbackKeys = Array.isArray(rawMotionDefinition.fallbackKeys)
    ? Array.from(new Set(
      rawMotionDefinition.fallbackKeys
        .map((value) => value.trim())
        .map(normalizePetContentMotionKey)
        .filter((value): value is PetContentMotionKey => value !== null),
    ))
    : [];

  return {
    allowInterruption: typeof rawMotionDefinition.allowInterruption === 'boolean'
      ? rawMotionDefinition.allowInterruption
      : null,
    completionMode:
      rawMotionDefinition.completionMode === 'fallback'
      || rawMotionDefinition.completionMode === 'freeze'
      || rawMotionDefinition.completionMode === 'motion-key'
      || rawMotionDefinition.completionMode === 'resume-base'
        ? rawMotionDefinition.completionMode
        : null,
    completionMotionKey: typeof rawMotionDefinition.completionMotionKey === 'string'
      ? normalizePetContentMotionKey(rawMotionDefinition.completionMotionKey.trim())
      : null,
    fallbackKeys,
    lockMs: Number.isFinite(rawMotionDefinition.lockMs) && rawMotionDefinition.lockMs! >= 0
      ? rawMotionDefinition.lockMs!
      : null,
    loopMode: rawMotionDefinition.loopMode === 'once' || rawMotionDefinition.loopMode === 'repeat'
      ? rawMotionDefinition.loopMode
      : null,
    playbackRate: Number.isFinite(rawMotionDefinition.playbackRate) && rawMotionDefinition.playbackRate! > 0
      ? rawMotionDefinition.playbackRate!
      : null,
    priority: Number.isFinite(rawMotionDefinition.priority)
      ? rawMotionDefinition.priority!
      : null,
  };
}

const SUPPORTED_PET_CONTENT_HOVER_REGION_SET = new Set([
  'head',
  'body',
  'handL',
  'handR',
]);

export function resolvePetContentHoverRegions(
  manifest: PetContentManifest | null | undefined,
) {
  const rawHoverRegions = manifest?.interaction?.hoverRegions;
  if (!Array.isArray(rawHoverRegions)) {
    return [];
  }

  return Array.from(new Set(
    rawHoverRegions
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => SUPPORTED_PET_CONTENT_HOVER_REGION_SET.has(value)),
  ));
}
