import { type PetAction, type PetModelMotionBinding } from '../../types';
import {
  isPetModelExpressionBinding,
  isPetModelMotionBinding,
} from '../content/petModelMotionBindingKinds';
import { type PetContentManifest, type PetContentMotionKey } from '../content/petContentManifest';
import {
  resolvePetContentExpressionNames,
  resolvePetContentMotionNames,
} from '../content/petContentManifest';
import { resolveLive2DModelRuntimeUrl } from './live2dModelSupport';

const MOTION_KEY_BY_ACTION: Record<PetAction, PetContentMotionKey> = {
  EATING: 'eating',
  HAPPY: 'happy',
  IDLE: 'idle',
  RUNNING: 'running',
  SAD: 'sad',
  SLEEPING: 'sleeping',
  SWIMMING: 'swimming',
  WALKING: 'walking',
};

const DEFAULT_LIVE2D_MOTION_GROUP_CANDIDATES: Record<PetContentMotionKey, string[]> = {
  eating: ['eating', 'eat', 'Eating', 'Eat'],
  happy: ['happy', 'Happy', 'smile', 'Smile'],
  idle: ['idle', 'Idle', 'IDLE'],
  moving: ['moving', 'Moving', 'move', 'Move', 'walking', 'Walking'],
  running: ['running', 'Running', 'run', 'Run', 'walking', 'Walking'],
  sad: ['sad', 'Sad', 'cry', 'Cry'],
  sleeping: ['sleeping', 'Sleeping', 'sleep', 'Sleep'],
  swimming: ['swimming', 'Swimming', 'swim', 'Swim', 'idle', 'Idle'],
  walking: ['walking', 'Walking', 'walk', 'Walk', 'moving', 'Moving'],
  'hover-body': ['hover-body', 'tap_body', 'TapBody', 'body', 'Body'],
  'hover-hand-left': ['hover-hand-left', 'tap_hand_l', 'TapHandL', 'hand_left', 'HandLeft'],
  'hover-hand-right': ['hover-hand-right', 'tap_hand_r', 'TapHandR', 'hand_right', 'HandRight'],
  'hover-head': ['hover-head', 'tap_head', 'TapHead', 'head', 'Head'],
};

const LIVE2D_MOTION_FALLBACK_KEYS: Record<PetContentMotionKey, PetContentMotionKey[]> = {
  eating: ['happy', 'idle'],
  happy: ['idle'],
  idle: [],
  moving: ['walking', 'idle'],
  running: ['walking', 'moving', 'idle'],
  sad: ['idle'],
  sleeping: ['idle'],
  swimming: ['moving', 'idle'],
  walking: ['moving', 'idle'],
  'hover-body': ['happy', 'idle'],
  'hover-hand-left': ['happy', 'idle'],
  'hover-hand-right': ['happy', 'idle'],
  'hover-head': ['happy', 'idle'],
};

const EXPRESSION_KEY_BY_ACTION: Partial<Record<PetAction, string>> = {
  EATING: 'eating',
  HAPPY: 'happy',
  IDLE: 'idle',
  SAD: 'sad',
  SLEEPING: 'sleeping',
};

const DEFAULT_LIVE2D_EXPRESSION_CANDIDATES: Record<string, string[]> = {
  eating: ['eating', 'eat', 'Eating', 'Eat'],
  happy: ['happy', 'smile', 'Happy', 'Smile'],
  idle: ['idle', 'Idle'],
  sad: ['sad', 'cry', 'Sad', 'Cry'],
  sleeping: ['sleeping', 'sleep', 'Sleep', 'Sleeping'],
};

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(
    values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

function resolvePathBasename(value: string) {
  const sourceWithoutQuery = value.trim().replace(/[?#].*$/u, '');
  if (!sourceWithoutQuery || sourceWithoutQuery.startsWith('data:')) {
    return '';
  }

  return sourceWithoutQuery.replace(/\\/gu, '/').split('/').filter(Boolean).pop() ?? '';
}

function resolveLive2DExpressionBindingCandidateNames(binding: PetModelMotionBinding) {
  const sourceName = resolvePathBasename(binding.sourceUrl)
    .replace(/\.exp3\.json$/iu, '')
    .trim();

  return uniqueNonEmpty([
    binding.name,
    binding.id,
    sourceName,
    ...(binding.clipNames ?? []),
    ...(binding.semanticAliases ?? []),
    ...(binding.semanticTags ?? []),
  ]);
}

export function resolveLive2DMotionKeyForAction(action: PetAction, isMoving: boolean): PetContentMotionKey {
  if (isMoving && action === 'IDLE') {
    return 'moving';
  }

  return MOTION_KEY_BY_ACTION[action] ?? 'idle';
}

export function resolveLive2DMotionGroupCandidates(options: {
  action: PetAction;
  contentManifest?: PetContentManifest | null;
  isMoving: boolean;
  manualMotionBinding?: PetModelMotionBinding | null;
}) {
  const {
    action,
    contentManifest = null,
    isMoving,
    manualMotionBinding = null,
  } = options;
  const manualMotionBindingForMotion = manualMotionBinding && isPetModelMotionBinding(manualMotionBinding)
    ? manualMotionBinding
    : null;
  const motionKey = manualMotionBindingForMotion?.motionKey ?? resolveLive2DMotionKeyForAction(action, isMoving);
  const fallbackKeys = LIVE2D_MOTION_FALLBACK_KEYS[motionKey] ?? ['idle'];
  const manifestMotionNames = resolvePetContentMotionNames(contentManifest, motionKey);
  const manualMotionNames = manualMotionBindingForMotion
    ? uniqueNonEmpty([
        manualMotionBindingForMotion.name,
        manualMotionBindingForMotion.motionKey,
        ...(manualMotionBindingForMotion.clipNames ?? []),
      ])
    : [];

  return {
    candidates: uniqueNonEmpty([
      ...manualMotionNames,
      ...manifestMotionNames,
      ...(DEFAULT_LIVE2D_MOTION_GROUP_CANDIDATES[motionKey] ?? []),
      ...fallbackKeys.flatMap((fallbackKey) => [
        ...resolvePetContentMotionNames(contentManifest, fallbackKey),
        ...(DEFAULT_LIVE2D_MOTION_GROUP_CANDIDATES[fallbackKey] ?? []),
      ]),
    ]),
    motionKey,
  };
}

export function resolveLive2DExpressionCandidates(options: {
  contentManifest?: PetContentManifest | null;
  expressionAction?: PetAction | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
}) {
  const manualExpressionBinding = options.manualExpressionBinding
    ?? (options.manualMotionBinding && isPetModelExpressionBinding(options.manualMotionBinding)
      ? options.manualMotionBinding
      : null);
  if (manualExpressionBinding) {
    return {
      candidates: resolveLive2DExpressionBindingCandidateNames(manualExpressionBinding),
      expressionKey: manualExpressionBinding.name || manualExpressionBinding.id,
    };
  }

  const expressionKey = options.expressionAction
    ? EXPRESSION_KEY_BY_ACTION[options.expressionAction] ?? null
    : null;
  if (!expressionKey) {
    return {
      candidates: [] as string[],
      expressionKey: null as string | null,
    };
  }

  return {
    candidates: uniqueNonEmpty([
      ...resolvePetContentExpressionNames(options.contentManifest, expressionKey as never),
      ...(DEFAULT_LIVE2D_EXPRESSION_CANDIDATES[expressionKey] ?? []),
    ]),
    expressionKey,
  };
}

function appendLive2DMotionGroupDefinitions(
  groups: Record<string, Array<{ File: string }>>,
  motionNames: string[],
  sourceUrl: string,
) {
  const resolvedSourceUrl = resolveLive2DModelRuntimeUrl(sourceUrl);
  if (!resolvedSourceUrl.trim()) {
    return groups;
  }

  uniqueNonEmpty(motionNames).forEach((motionName) => {
    groups[motionName] = [
      ...(groups[motionName] ?? []),
      { File: resolvedSourceUrl },
    ];
  });

  return groups;
}

function appendLive2DExternalMotionBindings(
  groups: Record<string, Array<{ File: string }>>,
  motionBindings: PetModelMotionBinding[] | null | undefined,
) {
  if (!Array.isArray(motionBindings)) {
    return groups;
  }

  return motionBindings.reduce<Record<string, Array<{ File: string }>>>((nextGroups, binding) => {
    if (!isPetModelMotionBinding(binding) || binding.format !== 'motion3' || !binding.sourceUrl.trim()) {
      return nextGroups;
    }

    return appendLive2DMotionGroupDefinitions(nextGroups, [
      binding.name,
      binding.motionKey,
      ...(binding.clipNames ?? []),
    ], binding.sourceUrl.trim());
  }, groups);
}

function appendLive2DExternalMotionManifestSources(
  groups: Record<string, Array<{ File: string }>>,
  contentManifest: PetContentManifest | null | undefined,
) {
  const motions = contentManifest?.motions;
  if (!motions) {
    return groups;
  }

  return Object.entries(motions).reduce<Record<string, Array<{ File: string }>>>((nextGroups, [motionKey, definition]) => {
    if (!definition || Array.isArray(definition) || !Array.isArray(definition.sources)) {
      return nextGroups;
    }

    definition.sources.forEach((source) => {
      if (source.format !== 'motion3' || !source.url.trim()) {
        return;
      }

      appendLive2DMotionGroupDefinitions(nextGroups, [
        motionKey,
        ...(definition.clips ?? []),
        ...(source.motionNames ?? []),
        ...(source.clipNames ?? []),
      ], source.url.trim());
    });

    return nextGroups;
  }, groups);
}

export function resolveLive2DExternalMotionGroups(options: {
  contentManifest?: PetContentManifest | null;
  motionBindings?: PetModelMotionBinding[] | null;
}) {
  const groups: Record<string, Array<{ File: string }>> = {};
  appendLive2DExternalMotionManifestSources(groups, options.contentManifest);
  appendLive2DExternalMotionBindings(groups, options.motionBindings);
  return groups;
}

export type Live2DExternalExpressionDefinition = {
  File: string;
  Name: string;
};

function appendLive2DExternalExpressionDefinitions(
  definitions: Live2DExternalExpressionDefinition[],
  binding: PetModelMotionBinding,
) {
  const resolvedSourceUrl = resolveLive2DModelRuntimeUrl(binding.sourceUrl);
  if (!resolvedSourceUrl.trim()) {
    return definitions;
  }

  resolveLive2DExpressionBindingCandidateNames(binding).forEach((expressionName) => {
    definitions.push({
      File: resolvedSourceUrl,
      Name: expressionName,
    });
  });

  return definitions;
}

export function resolveLive2DExternalExpressionDefinitions(options: {
  motionBindings?: PetModelMotionBinding[] | null;
}) {
  if (!Array.isArray(options.motionBindings)) {
    return [] as Live2DExternalExpressionDefinition[];
  }

  return options.motionBindings
    .filter(isPetModelExpressionBinding)
    .reduce<Live2DExternalExpressionDefinition[]>(appendLive2DExternalExpressionDefinitions, []);
}
