export type GroupSocialAutomationMode = 'disabled' | 'candidate-only' | 'automatic';

export type GroupSocialAutomationSettings = {
  automaticMemoryWriteEnabled: boolean;
  automaticRelationshipEvolutionEnabled: boolean;
  automaticSubgroupEvolutionEnabled: boolean;
};

export function resolveGroupSocialAutomationModes(
  settings: GroupSocialAutomationSettings,
) {
  return {
    memory: settings.automaticMemoryWriteEnabled ? 'candidate-only' : 'disabled',
    relationship: settings.automaticRelationshipEvolutionEnabled ? 'candidate-only' : 'disabled',
    subgroup: settings.automaticSubgroupEvolutionEnabled ? 'candidate-only' : 'disabled',
  } satisfies Record<'memory' | 'relationship' | 'subgroup', GroupSocialAutomationMode>;
}
