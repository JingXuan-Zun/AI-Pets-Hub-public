type Live2DMotionAvailabilityModel = {
  internalModel?: {
    motionManager?: {
      definitions?: Record<string, Array<Record<string, unknown>>>;
    };
  };
};

export function resolveLive2DAvailableMotionGroups(model: Live2DMotionAvailabilityModel) {
  return new Set(Object.keys(model.internalModel?.motionManager?.definitions ?? {}));
}

export function resolveLive2DAvailableMotionCandidateGroups(
  model: Live2DMotionAvailabilityModel,
  candidates: readonly string[],
) {
  const definitions = model.internalModel?.motionManager?.definitions ?? {};
  const availableGroups = resolveLive2DAvailableMotionGroups(model);
  const seenGroups = new Set<string>();
  const seenDefinitionSignatures = new Set<string>();
  const resolvedGroups: string[] = [];

  candidates.forEach((candidate) => {
    if (!availableGroups.has(candidate) || seenGroups.has(candidate)) {
      return;
    }

    const definitionSignature = resolveMotionDefinitionSignature(candidate, definitions[candidate] ?? []);
    if (seenDefinitionSignatures.has(definitionSignature)) {
      return;
    }

    seenGroups.add(candidate);
    seenDefinitionSignatures.add(definitionSignature);
    resolvedGroups.push(candidate);
  });

  return resolvedGroups;
}

function resolveMotionDefinitionSignature(group: string, definitions: Array<Record<string, unknown>>) {
  const fileSignature = definitions
    .map((definition) => String(definition.File ?? definition.file ?? '').trim())
    .filter(Boolean)
    .sort()
    .join('|');

  return fileSignature || `group:${group}`;
}
