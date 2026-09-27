import type { NeuralPersonaMode } from './neuralPersonaTypes';

export interface NeuralPersonaFeatureFlags {
  enabled: boolean;
  feedbackEnabled: boolean;
  groupHintsEnabled: boolean;
  hybridInputEnabled: boolean;
  learningApplicationEnabled: boolean;
  modelTagSuggestionsEnabled: boolean;
  semanticRetrievalEnabled: boolean;
  stageHintsEnabled: boolean;
  taskProposalHintsEnabled: boolean;
}

export const DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS: Readonly<NeuralPersonaFeatureFlags> = Object.freeze({
  enabled: false,
  feedbackEnabled: false,
  groupHintsEnabled: false,
  hybridInputEnabled: false,
  learningApplicationEnabled: false,
  modelTagSuggestionsEnabled: false,
  semanticRetrievalEnabled: false,
  stageHintsEnabled: false,
  taskProposalHintsEnabled: false,
});

export function resolveNeuralPersonaMode(
  requestedMode: NeuralPersonaMode,
  flags: NeuralPersonaFeatureFlags = DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS,
): NeuralPersonaMode {
  if (!flags.enabled) return 'classic';
  if (requestedMode === 'hybrid' && !flags.hybridInputEnabled) return 'classic';
  return requestedMode;
}
