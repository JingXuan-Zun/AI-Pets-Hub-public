import { resolveModelUrlForRuntime } from '../../constants';
import {
  type ModelType,
  type PetAction,
  type PetModelMotionBinding,
  type PetModelMotionKey,
  type PetModelPreset,
} from '../../types';
import {
  isPetModelExpressionBinding,
  isPetModelMotionBinding,
} from './petModelMotionBindingKinds';
import {
  normalizePetContentManifest,
  type PetContentManifest,
  type PetContentExpressionManifest,
  type PetContentMotionDefinition,
  type PetContentMotionKey,
  type PetContentMotionManifest,
} from './petContentManifest';
import { resolvePetContentExpressionKeyForMotionKey } from './petModelExpressionBindings';
import { filterPetModelMotionBindingsForModelType } from './petModelMotionBindingCompatibility';

export const QUICK_SELECT_PET_ACTIONS: PetAction[] = [
  'IDLE',
  'WALKING',
  'RUNNING',
  'SWIMMING',
  'HAPPY',
  'SAD',
  'SLEEPING',
  'EATING',
];

export const PET_ACTION_LABELS: Record<PetAction, string> = {
  IDLE: '待机',
  WALKING: '走路',
  RUNNING: '跑步',
  SWIMMING: '游动',
  HAPPY: '开心',
  SAD: '难过',
  SLEEPING: '睡觉',
  EATING: '吃东西',
};

const MOTION_KEY_BY_ACTION: Record<PetAction, PetContentMotionKey> = {
  IDLE: 'idle',
  WALKING: 'walking',
  RUNNING: 'running',
  SWIMMING: 'swimming',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleeping',
  EATING: 'eating',
};

const ACTION_BY_MOTION_KEY: Partial<Record<PetModelMotionKey, PetAction>> = {
  idle: 'IDLE',
  walking: 'WALKING',
  running: 'RUNNING',
  swimming: 'SWIMMING',
  happy: 'HAPPY',
  sad: 'SAD',
  sleeping: 'SLEEPING',
  eating: 'EATING',
};

const MOTION_KEY_GUESS_RULES: Array<{ motionKey: PetModelMotionKey; patterns: RegExp[] }> = [
  { motionKey: 'sleeping', patterns: [/sleep/iu, /rest/iu, /doze/iu, /idle_sleep/iu] },
  { motionKey: 'walking', patterns: [/walk/iu, /stroll/iu, /locomotion/iu, /move/iu] },
  { motionKey: 'running', patterns: [/run/iu, /dash/iu, /sprint/iu] },
  { motionKey: 'swimming', patterns: [/swim/iu, /float/iu] },
  { motionKey: 'happy', patterns: [/happy/iu, /smile/iu, /joy/iu, /cheer/iu] },
  { motionKey: 'sad', patterns: [/sad/iu, /cry/iu, /down/iu, /upset/iu] },
  { motionKey: 'eating', patterns: [/eat/iu, /chew/iu, /food/iu, /mogu/iu] },
  { motionKey: 'idle', patterns: [/idle/iu, /stand/iu, /wait/iu, /default/iu] },
];

function normalizeClipNames(clipNames: string[] | undefined) {
  return Array.isArray(clipNames)
    ? Array.from(new Set(
      clipNames
        .filter((clipName): clipName is string => typeof clipName === 'string')
        .map((clipName) => clipName.trim())
        .filter(Boolean),
    ))
    : [];
}

function normalizeMotionCandidateName(value: string | undefined | null) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function resolveBindingMotionCandidateNames(binding: PetModelMotionBinding) {
  return Array.from(new Set([
    binding.motionKey,
    ...(
      normalizeMotionCandidateName(binding.name)
        ? [normalizeMotionCandidateName(binding.name)!]
        : []
    ),
  ]));
}

function resolveBindingSourceMotionNames(binding: PetModelMotionBinding) {
  const normalizedBindingName = normalizeMotionCandidateName(binding.name);
  return normalizedBindingName
    ? [normalizedBindingName]
    : [binding.motionKey];
}

function appendExpressionBindingNames(
  expressions: PetContentExpressionManifest,
  binding: PetModelMotionBinding,
) {
  const expressionKey = resolvePetContentExpressionKeyForMotionKey(binding.motionKey);
  const expressionNames = Array.from(new Set([
    ...(expressions[expressionKey] ?? []),
    binding.name,
    binding.id,
    ...normalizeClipNames(binding.clipNames),
  ].map((value) => value.trim()).filter(Boolean)));

  expressions[expressionKey] = expressionNames;
  return expressions;
}

function mergeMotionDefinitions(
  baseDefinition: PetContentMotionDefinition | undefined,
  overrideDefinition: PetContentMotionDefinition | undefined,
) {
  if (!baseDefinition) {
    return overrideDefinition;
  }

  if (!overrideDefinition) {
    return baseDefinition;
  }

  if (Array.isArray(baseDefinition) && Array.isArray(overrideDefinition)) {
    return Array.from(new Set([...baseDefinition, ...overrideDefinition]));
  }

  if (Array.isArray(baseDefinition) && !Array.isArray(overrideDefinition)) {
    return {
      ...overrideDefinition,
      clips: Array.from(new Set([...baseDefinition, ...(overrideDefinition.clips ?? [])])),
    } satisfies PetContentMotionDefinition;
  }

  if (!Array.isArray(baseDefinition) && Array.isArray(overrideDefinition)) {
    return {
      ...baseDefinition,
      clips: Array.from(new Set([...(baseDefinition.clips ?? []), ...overrideDefinition])),
    } satisfies PetContentMotionDefinition;
  }

  const baseObjectDefinition = baseDefinition as Exclude<PetContentMotionDefinition, string[]>;
  const overrideObjectDefinition = overrideDefinition as Exclude<PetContentMotionDefinition, string[]>;

  const mergedSources = Array.from(new Map(
    [
      ...(baseObjectDefinition.sources ?? []),
      ...(overrideObjectDefinition.sources ?? []),
    ].map((source) => [
      `${source.url}|${source.format ?? ''}|${(source.clipNames ?? []).join('|')}|${(source.motionNames ?? []).join('|')}`,
      source,
    ]),
  ).values());

  return {
    ...baseObjectDefinition,
    ...overrideObjectDefinition,
    clips: Array.from(new Set([...(baseObjectDefinition.clips ?? []), ...(overrideObjectDefinition.clips ?? [])])),
    fallbackKeys: Array.from(new Set([...(baseObjectDefinition.fallbackKeys ?? []), ...(overrideObjectDefinition.fallbackKeys ?? [])])),
    sources: mergedSources,
  } satisfies PetContentMotionDefinition;
}

export function guessPetModelMotionKeyFromFileName(fileName: string) {
  const normalizedFileName = fileName
    .trim()
    .replace(/\.[^.]+$/u, '')
    .toLowerCase();

  for (const rule of MOTION_KEY_GUESS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedFileName))) {
      return rule.motionKey;
    }
  }

  return 'idle' satisfies PetModelMotionKey;
}

export function resolvePetModelPresetForModel(
  modelType: ModelType,
  modelUrl: string,
  customModelPresets: PetModelPreset[] = [],
) {
  const runtimeUrl = resolveModelUrlForRuntime(modelUrl, modelType, customModelPresets);
  return customModelPresets.find((preset) => (
    preset.type === modelType
    && resolveModelUrlForRuntime(preset.url, preset.type, customModelPresets) === runtimeUrl
  )) ?? null;
}

export function resolvePetModelMotionBindingsForModel(
  modelType: ModelType,
  modelUrl: string,
  customModelPresets: PetModelPreset[] = [],
) {
  return resolvePetModelPresetForModel(modelType, modelUrl, customModelPresets)?.motionBindings ?? [];
}

export function resolveImportedPetActionsForModel(
  modelType: ModelType,
  modelUrl: string,
  customModelPresets: PetModelPreset[] = [],
) {
  const motionBindings = filterPetModelMotionBindingsForModelType(
    modelType,
    resolvePetModelMotionBindingsForModel(modelType, modelUrl, customModelPresets),
  );
  const importedMotionKeySet = new Set(
    motionBindings
      .filter(isPetModelMotionBinding)
      .map((binding) => binding.motionKey),
  );
  return QUICK_SELECT_PET_ACTIONS.filter((action) => importedMotionKeySet.has(MOTION_KEY_BY_ACTION[action]));
}

export function resolvePetMotionKeyForAction(action: PetAction) {
  return MOTION_KEY_BY_ACTION[action] as PetModelMotionKey;
}

export function resolvePetActionForMotionKey(motionKey: PetModelMotionKey) {
  return ACTION_BY_MOTION_KEY[motionKey] ?? null;
}

function buildMotionManifestFromBindings(
  preset: PetModelPreset,
  motionBindings: PetModelMotionBinding[],
) {
  if ((preset.type !== '3d' && preset.type !== 'live2d') || motionBindings.length === 0) {
    return null;
  }

  const motions = motionBindings
    .filter(isPetModelMotionBinding)
    .reduce<PetContentMotionManifest>((manifest, binding) => {
    const motionKey = binding.motionKey as PetContentMotionKey;
    const existingDefinition = manifest[motionKey];
    const motionCandidateNames = resolveBindingMotionCandidateNames(binding);
    const nextDefinition: PetContentMotionDefinition = {
      ...(existingDefinition && !Array.isArray(existingDefinition) ? existingDefinition : {}),
      clips: Array.from(new Set([
        ...(
          existingDefinition && !Array.isArray(existingDefinition)
            ? (existingDefinition.clips ?? [])
            : (Array.isArray(existingDefinition) ? existingDefinition : [])
        ),
        // Keep runtime motion names stable per slot; raw source clip names stay in sources[].clipNames.
        // Many VRMA files reuse generic names like "animation", which would otherwise collapse distinct motions.
        ...motionCandidateNames,
      ])),
      sources: [
        ...(
          existingDefinition && !Array.isArray(existingDefinition)
            ? (existingDefinition.sources ?? [])
            : []
        ),
        {
          clipNames: normalizeClipNames(binding.clipNames),
          format: binding.format,
          motionNames: resolveBindingSourceMotionNames(binding),
          url: binding.sourceUrl,
        },
      ],
    };

    manifest[motionKey] = nextDefinition;
    return manifest;
    }, {});
  const expressions = motionBindings
    .filter(isPetModelExpressionBinding)
    .reduce<PetContentExpressionManifest>(appendExpressionBindingNames, {});

  return normalizePetContentManifest({
    id: `${preset.id}:motion-library`,
    model: {
      type: preset.type,
      url: preset.url,
    },
    expressions,
    motions,
    name: `${preset.name} 动作库`,
  }, preset.url);
}

export function buildPetModelPresetContentManifest(
  preset: PetModelPreset | null | undefined,
) {
  if (
    !preset
    || (preset.type !== '3d' && preset.type !== 'live2d')
    || !Array.isArray(preset.motionBindings)
    || preset.motionBindings.length === 0
  ) {
    return null;
  }

  return buildMotionManifestFromBindings(preset, preset.motionBindings);
}

export function buildPetModelBindingContentManifest(
  preset: PetModelPreset | null | undefined,
  binding: PetModelMotionBinding | null | undefined,
) {
  if (!preset || !binding) {
    return null;
  }

  return buildMotionManifestFromBindings(preset, [binding]);
}
export function mergePetContentManifests(
  baseManifest: PetContentManifest | null | undefined,
  overrideManifest: PetContentManifest | null | undefined,
) {
  if (!baseManifest && !overrideManifest) {
    return null;
  }

  if (!baseManifest) {
    return overrideManifest ?? null;
  }

  if (!overrideManifest) {
    return baseManifest;
  }

  const mergedMotions = {
    ...(baseManifest.motions ?? {}),
  } satisfies PetContentMotionManifest;

  Object.entries(overrideManifest.motions ?? {}).forEach(([rawMotionKey, overrideDefinition]) => {
    const motionKey = rawMotionKey as PetContentMotionKey;
    mergedMotions[motionKey] = mergeMotionDefinitions(
      mergedMotions[motionKey],
      overrideDefinition,
    );
  });

  return normalizePetContentManifest({
    ...baseManifest,
    ...overrideManifest,
    expressions: {
      ...(baseManifest.expressions ?? {}),
      ...(overrideManifest.expressions ?? {}),
    },
    interaction: {
      ...(baseManifest.interaction ?? {}),
      ...(overrideManifest.interaction ?? {}),
    },
    model: {
      ...baseManifest.model,
      ...overrideManifest.model,
      url: overrideManifest.model?.url ?? baseManifest.model.url,
      type: overrideManifest.model?.type ?? baseManifest.model.type,
    },
    motionPolicy: {
      ...(baseManifest.motionPolicy ?? {}),
      ...(overrideManifest.motionPolicy ?? {}),
    },
    motions: mergedMotions,
    sequenceAssets: {
      ...(baseManifest.sequenceAssets ?? {}),
      ...(overrideManifest.sequenceAssets ?? {}),
    },
    visemes: {
      ...(baseManifest.visemes ?? {}),
      ...(overrideManifest.visemes ?? {}),
    },
  }, overrideManifest.model?.url ?? baseManifest.model.url);
}
