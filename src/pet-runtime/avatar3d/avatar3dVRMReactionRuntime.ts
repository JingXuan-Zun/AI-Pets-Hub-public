import * as THREE from 'three';
import { VRMExpressionPresetName, type VRM } from '@pixiv/three-vrm';
import { type PetMessageExpressionAction } from '../interactions/petMessageExpressionSignals';
import {
  type Avatar3DFrameUpdater,
  type Avatar3DRuntimeFrameState,
} from './avatar3dRuntimeInstance';
import { createVRMLookAtFrameApplier } from './avatar3dLookAtController';
import { createGenericAvatar3DLookAtFrameUpdater } from './avatar3dGenericLookAtController';
import {
  resolvePetContentExpressionNames,
  resolvePetContentVisemeName,
  type PetContentExpressionKey,
  type PetContentManifest,
  type PetContentVisemeKey,
} from '../content/petContentManifest';

type VRMReactionBindingSet = {
  expressionNamesByAction: Partial<Record<PetMessageExpressionAction, string>>;
  expressionNamesByContentKey: Partial<Record<PetContentExpressionKey, string>>;
  mouthExpressionNameByViseme: Partial<Record<string, string>>;
  mouthExpressionNames: string[];
};

type MorphTargetBinding = {
  index: number;
  key: string;
  mesh: THREE.Mesh;
  name: string;
};

type DirectMorphTargetOverrideBindingSet = {
  expressionBindingsByAction: Partial<Record<PetMessageExpressionAction, MorphTargetBinding[]>>;
};

type VRMReactionDebugSummary = {
  expressionNamesByAction: Partial<Record<PetMessageExpressionAction, string>>;
  expressionNamesByContentKey: Partial<Record<PetContentExpressionKey, string>>;
  mouthExpressionNames: string[];
};

const EXPRESSION_NAME_CANDIDATES: Record<PetMessageExpressionAction, string[]> = {
  EATING: ['eating', 'eat', 'chew', 'chewing', 'mogu', 'happy'],
  HAPPY: [VRMExpressionPresetName.Happy, 'smile', 'joy', 'laugh', 'happy01'],
  SAD: [VRMExpressionPresetName.Sad, 'cry', 'sorrow', 'upset', 'sad01'],
  SLEEPING: ['sleeping', 'sleepy', 'sleep', VRMExpressionPresetName.Relaxed, VRMExpressionPresetName.Blink],
};

const EXPRESSION_WEIGHT_BY_ACTION: Record<PetMessageExpressionAction, number> = {
  EATING: 0.74,
  HAPPY: 0.88,
  SAD: 0.84,
  SLEEPING: 1,
};

const LIP_SYNC_VISEME_FALLBACKS: Record<string, string[]> = {
  aa: [VRMExpressionPresetName.Aa, 'a', 'mouthOpen', 'open'],
  ee: [VRMExpressionPresetName.Ee, 'e'],
  ih: [VRMExpressionPresetName.Ih, 'i'],
  oh: [VRMExpressionPresetName.Oh, 'o'],
  ou: [VRMExpressionPresetName.Ou, 'u'],
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

const MODEL_SPECIFIC_DIRECT_MORPH_TARGET_CANDIDATES: Partial<Record<string, Partial<Record<PetMessageExpressionAction, string[]>>>> = {
  '172.vrm': {
    HAPPY: ['\u306b\u3053\u308a'],
  },
};

function resolveModelFileName(modelUrl?: string | null) {
  if (!modelUrl) {
    return '';
  }

  const sanitizedModelUrl = modelUrl
    .split('#', 1)[0]!
    .split('?', 1)[0]!;
  const pathSegments = sanitizedModelUrl.split(/[\\/]/u);
  return pathSegments[pathSegments.length - 1]?.trim().toLowerCase() ?? '';
}

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

function resolveExpressionMapKeys(vrm: VRM) {
  return Object.keys(vrm.expressionManager?.expressionMap ?? {});
}

function resolveAvailableExpressionName(vrm: VRM, candidates: string[]) {
  const availableNameSet = new Set(resolveExpressionMapKeys(vrm));
  return candidates.find((candidate) => availableNameSet.has(candidate)) ?? null;
}

function resolveActionExpressionCandidates(
  action: PetMessageExpressionAction,
  contentManifest?: PetContentManifest | null,
) {
  return Array.from(new Set([
    ...resolvePetContentExpressionNames(contentManifest, MANIFEST_EXPRESSION_KEY_BY_ACTION[action]),
    ...EXPRESSION_NAME_CANDIDATES[action],
  ]));
}

function resolveVisemeExpressionCandidates(
  viseme: PetContentVisemeKey,
  contentManifest?: PetContentManifest | null,
) {
  const contentManifestVisemeName = resolvePetContentVisemeName(contentManifest, viseme);
  return Array.from(new Set([
    ...(contentManifestVisemeName ? [contentManifestVisemeName] : []),
    ...(LIP_SYNC_VISEME_FALLBACKS[viseme] ?? []),
  ]));
}

function resolveContentExpressionCandidates(
  expressionKey: PetContentExpressionKey,
  contentManifest?: PetContentManifest | null,
) {
  return resolvePetContentExpressionNames(contentManifest, expressionKey);
}

function resolveVRMReactionBindingSet(vrm: VRM, contentManifest?: PetContentManifest | null): VRMReactionBindingSet {
  const expressionNamesByAction = Object.entries(EXPRESSION_NAME_CANDIDATES).reduce<VRMReactionBindingSet['expressionNamesByAction']>((bindings, [action, candidates]) => {
    void candidates;
    const expressionName = resolveAvailableExpressionName(
      vrm,
      resolveActionExpressionCandidates(action as PetMessageExpressionAction, contentManifest),
    );
    if (expressionName) {
      bindings[action as PetMessageExpressionAction] = expressionName;
    }

    return bindings;
  }, {});
  const expressionNamesByContentKey = MANIFEST_HOVER_EXPRESSION_KEYS.reduce<VRMReactionBindingSet['expressionNamesByContentKey']>((bindings, expressionKey) => {
    const expressionName = resolveAvailableExpressionName(
      vrm,
      resolveContentExpressionCandidates(expressionKey, contentManifest),
    );
    if (expressionName) {
      bindings[expressionKey] = expressionName;
    }

    return bindings;
  }, {});

  const mouthExpressionNameByViseme = Object.entries(LIP_SYNC_VISEME_FALLBACKS).reduce<VRMReactionBindingSet['mouthExpressionNameByViseme']>((bindings, [viseme, candidates]) => {
    void candidates;
    const expressionName = resolveAvailableExpressionName(
      vrm,
      resolveVisemeExpressionCandidates(viseme as PetContentVisemeKey, contentManifest),
    );
    if (expressionName) {
      bindings[viseme] = expressionName;
    }

    return bindings;
  }, {});
  const mouthExpressionNames = Object.values(mouthExpressionNameByViseme);

  return {
    expressionNamesByAction,
    expressionNamesByContentKey,
    mouthExpressionNameByViseme,
    mouthExpressionNames: Array.from(new Set(mouthExpressionNames)),
  };
}

function resolveDirectMorphTargetOverrideBindingSet(
  vrm: VRM,
  modelUrl?: string | null,
): DirectMorphTargetOverrideBindingSet {
  const modelSpecificCandidates = MODEL_SPECIFIC_DIRECT_MORPH_TARGET_CANDIDATES[resolveModelFileName(modelUrl)];
  if (!modelSpecificCandidates) {
    return {
      expressionBindingsByAction: {},
    };
  }

  const bindingMap = collectMorphTargetBindingMap(vrm.scene);
  const expressionBindingsByAction = Object.entries(modelSpecificCandidates).reduce<DirectMorphTargetOverrideBindingSet['expressionBindingsByAction']>((bindings, [action, candidates]) => {
    if (!candidates?.length) {
      return bindings;
    }

    const resolvedBindings = resolveAvailableMorphTargetBindings(bindingMap, candidates);
    if (resolvedBindings?.length) {
      bindings[action as PetMessageExpressionAction] = resolvedBindings;
    }

    return bindings;
  }, {});

  return {
    expressionBindingsByAction,
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

function clearReactionExpressions(vrm: VRM, bindings: VRMReactionBindingSet) {
  const manager = vrm.expressionManager;
  if (!manager) {
    return;
  }

  Object.values(bindings.expressionNamesByAction).forEach((expressionName) => {
    if (expressionName) {
      manager.setValue(expressionName, 0);
    }
  });
  Object.values(bindings.expressionNamesByContentKey).forEach((expressionName) => {
    if (expressionName) {
      manager.setValue(expressionName, 0);
    }
  });
  bindings.mouthExpressionNames.forEach((expressionName) => {
    manager.setValue(expressionName, 0);
  });
}

function applyExpressionReaction(
  vrm: VRM,
  bindings: VRMReactionBindingSet,
  directMorphTargetOverrides: DirectMorphTargetOverrideBindingSet,
  pendingDirectMorphTargetWeights: Map<string, { binding: MorphTargetBinding; weight: number }>,
  frameState?: Avatar3DRuntimeFrameState,
) {
  const manager = vrm.expressionManager;
  const expressionState = frameState?.reactionState?.expressionState;
  const cue = expressionState?.activeCue;
  if (!cue) {
    return;
  }

  const resolvedBaseWeight = cue.action
    ? EXPRESSION_WEIGHT_BY_ACTION[cue.action]
    : 0.76;
  const weightMultiplier = cue.weightMultiplier ?? 1;
  const resolvedWeight = Math.min(1, Math.max(0, resolvedBaseWeight * weightMultiplier));

  if (cue.action) {
    const directMorphTargetBindings = directMorphTargetOverrides.expressionBindingsByAction[cue.action];
    if (directMorphTargetBindings?.length) {
      queueMorphTargetWeight(
        pendingDirectMorphTargetWeights,
        directMorphTargetBindings,
        resolvedWeight,
      );
      return;
    }
  }

  if (!manager) {
    return;
  }

  const boundExpressionName = (
    cue.candidateExpressionNames?.length
      ? resolveAvailableExpressionName(vrm, cue.candidateExpressionNames)
      : null
  ) ?? (
    cue.expressionKey
      ? bindings.expressionNamesByContentKey[cue.expressionKey]
      : null
  ) ?? (
    cue.action
      ? bindings.expressionNamesByAction[cue.action]
      : null
  );
  if (!boundExpressionName) {
    return;
  }

  manager.setValue(
    boundExpressionName,
    resolvedWeight,
  );
}

function applyLipSyncReaction(
  vrm: VRM,
  bindings: VRMReactionBindingSet,
  frameState?: Avatar3DRuntimeFrameState,
) {
  const manager = vrm.expressionManager;
  const lipSyncState = frameState?.reactionState?.lipSyncState;
  if (!manager || !lipSyncState?.isActive || !lipSyncState.viseme) {
    return;
  }

  const visemeExpressionName = bindings.mouthExpressionNameByViseme[lipSyncState.viseme];
  if (!visemeExpressionName) {
    return;
  }

  manager.setValue(visemeExpressionName, lipSyncState.mouthOpen);
}

export function createVRMReactionDebugSummary(
  vrm: VRM,
  contentManifest?: PetContentManifest | null,
  modelUrl?: string | null,
): VRMReactionDebugSummary {
  const bindings = resolveVRMReactionBindingSet(vrm, contentManifest);
  const directMorphTargetOverrides = resolveDirectMorphTargetOverrideBindingSet(vrm, modelUrl);
  const expressionNamesByAction = {
    ...bindings.expressionNamesByAction,
  };

  Object.entries(directMorphTargetOverrides.expressionBindingsByAction).forEach(([action, resolvedBindings]) => {
    const preferredBinding = resolvedBindings?.[0];
    if (preferredBinding) {
      expressionNamesByAction[action as PetMessageExpressionAction] = preferredBinding.name;
    }
  });

  return {
    expressionNamesByAction,
    expressionNamesByContentKey: bindings.expressionNamesByContentKey,
    mouthExpressionNames: bindings.mouthExpressionNames,
  };
}

export function createVRMRuntimeFrameUpdater(
  vrm: VRM,
  contentManifest?: PetContentManifest | null,
  modelUrl?: string | null,
): Avatar3DFrameUpdater {
  const bindings = resolveVRMReactionBindingSet(vrm, contentManifest);
  const directMorphTargetOverrides = resolveDirectMorphTargetOverrideBindingSet(vrm, modelUrl);
  const applyLookAt = createVRMLookAtFrameApplier(vrm);
  const applyGenericLookAtOverlay = createGenericAvatar3DLookAtFrameUpdater(vrm.scene);
  const directMorphTargetBindingByKey = new Map<string, MorphTargetBinding>();

  Object.values(directMorphTargetOverrides.expressionBindingsByAction).forEach((entries) => {
    entries?.forEach((entry) => directMorphTargetBindingByKey.set(entry.key, entry));
  });

  let previousDirectMorphTargetKeys = new Set<string>();

  return (delta, frameState) => {
    const pendingDirectMorphTargetWeights = new Map<string, { binding: MorphTargetBinding; weight: number }>();

    applyLookAt(frameState);
    clearReactionExpressions(vrm, bindings);
    applyExpressionReaction(
      vrm,
      bindings,
      directMorphTargetOverrides,
      pendingDirectMorphTargetWeights,
      frameState,
    );
    applyLipSyncReaction(vrm, bindings, frameState);
    vrm.update(delta);
    applyGenericLookAtOverlay(delta, frameState);

    previousDirectMorphTargetKeys.forEach((bindingKey) => {
      if (pendingDirectMorphTargetWeights.has(bindingKey)) {
        return;
      }

      const binding = directMorphTargetBindingByKey.get(bindingKey);
      if (!binding?.mesh.morphTargetInfluences) {
        return;
      }

      binding.mesh.morphTargetInfluences[binding.index] = 0;
    });

    flushMorphTargetWeights(pendingDirectMorphTargetWeights);
    previousDirectMorphTargetKeys = new Set(pendingDirectMorphTargetWeights.keys());
  };
}
