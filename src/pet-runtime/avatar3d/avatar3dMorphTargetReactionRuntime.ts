import * as THREE from 'three';
import { type PetMessageExpressionAction } from '../interactions/petMessageExpressionSignals';
import {
  type Avatar3DFrameUpdater,
  type Avatar3DRuntimeFrameState,
} from './avatar3dRuntimeInstance';
import {
  resolvePetContentExpressionNames,
  resolvePetContentVisemeName,
  type PetContentExpressionKey,
  type PetContentManifest,
  type PetContentVisemeKey,
} from '../content/petContentManifest';

type MorphTargetBinding = {
  index: number;
  key: string;
  mesh: THREE.Mesh;
  name: string;
};

type MorphTargetReactionBindingSet = {
  expressionBindingsByAction: Partial<Record<PetMessageExpressionAction, MorphTargetBinding[]>>;
  expressionBindingsByContentKey: Partial<Record<PetContentExpressionKey, MorphTargetBinding[]>>;
  mouthBindingsByViseme: Partial<Record<string, MorphTargetBinding[]>>;
};

type MorphTargetReactionDebugSummary = {
  expressionNamesByAction: Partial<Record<PetMessageExpressionAction, string[]>>;
  expressionNamesByContentKey: Partial<Record<PetContentExpressionKey, string[]>>;
  mouthExpressionNamesByViseme: Partial<Record<string, string[]>>;
};

const EXPRESSION_NAME_CANDIDATES: Record<PetMessageExpressionAction, string[]> = {
  EATING: ['eating', 'eat', 'chew', 'chewing', 'mogu', 'munch', 'nom', 'food'],
  HAPPY: ['happy', 'smile', 'joy', 'laugh', 'grin', 'cheer'],
  SAD: ['sad', 'cry', 'sorrow', 'upset', 'frown', 'troubled'],
  SLEEPING: ['sleeping', 'sleepy', 'sleep', 'drowsy', 'blink', 'relaxed'],
};

const EXPRESSION_WEIGHT_BY_ACTION: Record<PetMessageExpressionAction, number> = {
  EATING: 0.72,
  HAPPY: 0.86,
  SAD: 0.82,
  SLEEPING: 1,
};

const LIP_SYNC_VISEME_FALLBACKS: Record<string, string[]> = {
  aa: ['aa', 'a', 'mouthOpen', 'open'],
  ee: ['ee', 'e'],
  ih: ['ih', 'i'],
  oh: ['oh', 'o'],
  ou: ['ou', 'u'],
};

const MANIFEST_EXPRESSION_KEY_BY_ACTION: Record<PetMessageExpressionAction, PetContentExpressionKey> = {
  EATING: 'eating',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleeping',
};

const MANIFEST_HOVER_EXPRESSION_KEYS: PetContentExpressionKey[] = [
  'hover-head',
  'hover-body',
  'hover-hand-left',
  'hover-hand-right',
];

function normalizeMorphTargetName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()[\]{}]+/gu, '');
}

function isMorphTargetMesh(object: THREE.Object3D): object is THREE.Mesh {
  return object instanceof THREE.Mesh
    && Array.isArray(object.morphTargetInfluences)
    && Boolean(object.morphTargetDictionary);
}

function collectMorphTargetBindingMap(object: THREE.Object3D) {
  const bindingMap = new Map<string, MorphTargetBinding[]>();

  object.traverse((child) => {
    if (!isMorphTargetMesh(child) || !child.morphTargetDictionary) {
      return;
    }

    Object.entries(child.morphTargetDictionary).forEach(([name, index]) => {
      if (!Number.isInteger(index) || index < 0 || index >= child.morphTargetInfluences!.length) {
        return;
      }

      const normalizedName = normalizeMorphTargetName(name);
      if (!normalizedName) {
        return;
      }

      const binding: MorphTargetBinding = {
        index,
        key: `${child.uuid}:${index}`,
        mesh: child,
        name,
      };
      const currentBindings = bindingMap.get(normalizedName);
      if (currentBindings) {
        currentBindings.push(binding);
      } else {
        bindingMap.set(normalizedName, [binding]);
      }
    });
  });

  return bindingMap;
}

function resolveAvailableMorphTargetBindings(
  bindingMap: Map<string, MorphTargetBinding[]>,
  candidates: string[],
) {
  const normalizedCandidates = candidates
    .map(normalizeMorphTargetName)
    .filter(Boolean);

  for (const normalizedCandidate of normalizedCandidates) {
    const exactBindings = bindingMap.get(normalizedCandidate);
    if (exactBindings?.length) {
      return exactBindings;
    }
  }

  for (const normalizedCandidate of normalizedCandidates) {
    const fuzzyBindings = Array.from(bindingMap.entries()).find(([normalizedName]) => (
      normalizedName.includes(normalizedCandidate)
      || normalizedCandidate.includes(normalizedName)
    ))?.[1];
    if (fuzzyBindings?.length) {
      return fuzzyBindings;
    }
  }

  return null;
}

function resolveActionMorphTargetCandidates(
  action: PetMessageExpressionAction,
  contentManifest?: PetContentManifest | null,
) {
  return Array.from(new Set([
    ...resolvePetContentExpressionNames(contentManifest, MANIFEST_EXPRESSION_KEY_BY_ACTION[action]),
    ...EXPRESSION_NAME_CANDIDATES[action],
  ]));
}

function resolveVisemeMorphTargetCandidates(
  viseme: PetContentVisemeKey,
  contentManifest?: PetContentManifest | null,
) {
  const contentManifestVisemeName = resolvePetContentVisemeName(contentManifest, viseme);
  return Array.from(new Set([
    ...(contentManifestVisemeName ? [contentManifestVisemeName] : []),
    ...(LIP_SYNC_VISEME_FALLBACKS[viseme] ?? []),
  ]));
}

function resolveContentMorphTargetCandidates(
  expressionKey: PetContentExpressionKey,
  contentManifest?: PetContentManifest | null,
) {
  return resolvePetContentExpressionNames(contentManifest, expressionKey);
}

function resolveMorphTargetReactionBindingSet(
  object: THREE.Object3D,
  contentManifest?: PetContentManifest | null,
): MorphTargetReactionBindingSet {
  const bindingMap = collectMorphTargetBindingMap(object);

  const expressionBindingsByAction = Object.keys(EXPRESSION_NAME_CANDIDATES).reduce<MorphTargetReactionBindingSet['expressionBindingsByAction']>((bindings, action) => {
    const resolvedBindings = resolveAvailableMorphTargetBindings(
      bindingMap,
      resolveActionMorphTargetCandidates(action as PetMessageExpressionAction, contentManifest),
    );
    if (resolvedBindings?.length) {
      bindings[action as PetMessageExpressionAction] = resolvedBindings;
    }
    return bindings;
  }, {});

  const expressionBindingsByContentKey = MANIFEST_HOVER_EXPRESSION_KEYS.reduce<MorphTargetReactionBindingSet['expressionBindingsByContentKey']>((bindings, expressionKey) => {
    const resolvedBindings = resolveAvailableMorphTargetBindings(
      bindingMap,
      resolveContentMorphTargetCandidates(expressionKey, contentManifest),
    );
    if (resolvedBindings?.length) {
      bindings[expressionKey] = resolvedBindings;
    }
    return bindings;
  }, {});

  const mouthBindingsByViseme = Object.keys(LIP_SYNC_VISEME_FALLBACKS).reduce<MorphTargetReactionBindingSet['mouthBindingsByViseme']>((bindings, viseme) => {
    const resolvedBindings = resolveAvailableMorphTargetBindings(
      bindingMap,
      resolveVisemeMorphTargetCandidates(viseme as PetContentVisemeKey, contentManifest),
    );
    if (resolvedBindings?.length) {
      bindings[viseme] = resolvedBindings;
    }
    return bindings;
  }, {});

  return {
    expressionBindingsByAction,
    expressionBindingsByContentKey,
    mouthBindingsByViseme,
  };
}

function queueMorphTargetWeight(
  pendingWeights: Map<string, { binding: MorphTargetBinding; weight: number }>,
  bindings: MorphTargetBinding[] | undefined,
  weight: number,
) {
  if (!bindings?.length || !(weight > 0)) {
    return;
  }

  bindings.forEach((binding) => {
    const currentEntry = pendingWeights.get(binding.key);
    if (!currentEntry || weight > currentEntry.weight) {
      pendingWeights.set(binding.key, {
        binding,
        weight,
      });
    }
  });
}

function applyExpressionReaction(
  bindingMap: Map<string, MorphTargetBinding[]>,
  bindings: MorphTargetReactionBindingSet,
  pendingWeights: Map<string, { binding: MorphTargetBinding; weight: number }>,
  frameState?: Avatar3DRuntimeFrameState,
) {
  const cue = frameState?.reactionState?.expressionState.activeCue;
  if (!cue) {
    return;
  }

  const resolvedBindings = (
    cue.candidateExpressionNames?.length
      ? resolveAvailableMorphTargetBindings(bindingMap, cue.candidateExpressionNames)
      : undefined
  ) ?? (
    cue.expressionKey
      ? bindings.expressionBindingsByContentKey[cue.expressionKey]
      : undefined
  ) ?? (
    cue.action
      ? bindings.expressionBindingsByAction[cue.action]
      : undefined
  );
  if (!resolvedBindings?.length) {
    return;
  }

  const baseWeight = cue.action
    ? EXPRESSION_WEIGHT_BY_ACTION[cue.action]
    : 0.76;
  queueMorphTargetWeight(
    pendingWeights,
    resolvedBindings,
    Math.min(1, Math.max(0, baseWeight * (cue.weightMultiplier ?? 1))),
  );
}

function applyLipSyncReaction(
  bindings: MorphTargetReactionBindingSet,
  pendingWeights: Map<string, { binding: MorphTargetBinding; weight: number }>,
  frameState?: Avatar3DRuntimeFrameState,
) {
  const lipSyncState = frameState?.reactionState?.lipSyncState;
  if (!lipSyncState?.isActive || !lipSyncState.viseme) {
    return;
  }

  queueMorphTargetWeight(
    pendingWeights,
    bindings.mouthBindingsByViseme[lipSyncState.viseme],
    Math.min(1, Math.max(0, lipSyncState.mouthOpen)),
  );
}

function flushMorphTargetWeights(
  pendingWeights: Map<string, { binding: MorphTargetBinding; weight: number }>,
) {
  pendingWeights.forEach(({ binding, weight }) => {
    if (!binding.mesh.morphTargetInfluences) {
      return;
    }

    binding.mesh.morphTargetInfluences[binding.index] = weight;
  });
}

export function createMorphTargetReactionDebugSummary(
  object: THREE.Object3D,
  contentManifest?: PetContentManifest | null,
): MorphTargetReactionDebugSummary {
  const bindings = resolveMorphTargetReactionBindingSet(object, contentManifest);

  const mapBindingsToNames = <T extends string>(
    source: Partial<Record<T, MorphTargetBinding[]>>,
  ) => (Object.entries(source) as Array<[string, MorphTargetBinding[] | undefined]>).reduce<Partial<Record<T, string[]>>>((summary, [key, value]) => {
    if (!value?.length) {
      return summary;
    }

    summary[key as T] = Array.from(new Set(value.map((binding) => binding.name)));
    return summary;
  }, {});

  return {
    expressionNamesByAction: mapBindingsToNames(bindings.expressionBindingsByAction),
    expressionNamesByContentKey: mapBindingsToNames(bindings.expressionBindingsByContentKey),
    mouthExpressionNamesByViseme: mapBindingsToNames(bindings.mouthBindingsByViseme),
  };
}

export function createMorphTargetRuntimeFrameUpdater(
  object: THREE.Object3D,
  contentManifest?: PetContentManifest | null,
): Avatar3DFrameUpdater | null {
  const bindingMap = collectMorphTargetBindingMap(object);
  const bindings = resolveMorphTargetReactionBindingSet(object, contentManifest);
  const hasAnyBindings = Object.keys(bindings.expressionBindingsByAction).length > 0
    || Object.keys(bindings.expressionBindingsByContentKey).length > 0
    || Object.keys(bindings.mouthBindingsByViseme).length > 0
    || bindingMap.size > 0;
  if (!hasAnyBindings) {
    return null;
  }

  const bindingByKey = new Map<string, MorphTargetBinding>();
  bindingMap.forEach((entries) => {
    entries.forEach((entry) => bindingByKey.set(entry.key, entry));
  });
  Object.values(bindings.expressionBindingsByAction).forEach((entries) => {
    entries?.forEach((entry) => bindingByKey.set(entry.key, entry));
  });
  Object.values(bindings.expressionBindingsByContentKey).forEach((entries) => {
    entries?.forEach((entry) => bindingByKey.set(entry.key, entry));
  });
  Object.values(bindings.mouthBindingsByViseme).forEach((entries) => {
    entries?.forEach((entry) => bindingByKey.set(entry.key, entry));
  });

  let previousAppliedKeys = new Set<string>();

  return (_delta, frameState) => {
    const pendingWeights = new Map<string, { binding: MorphTargetBinding; weight: number }>();
    applyExpressionReaction(bindingMap, bindings, pendingWeights, frameState);
    applyLipSyncReaction(bindings, pendingWeights, frameState);

    previousAppliedKeys.forEach((bindingKey) => {
      if (pendingWeights.has(bindingKey)) {
        return;
      }

      const binding = bindingByKey.get(bindingKey);
      if (!binding?.mesh.morphTargetInfluences) {
        return;
      }

      binding.mesh.morphTargetInfluences[binding.index] = 0;
    });

    flushMorphTargetWeights(pendingWeights);
    previousAppliedKeys = new Set(pendingWeights.keys());
  };
}
