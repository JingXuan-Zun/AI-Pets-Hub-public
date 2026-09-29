import type { NeuralPersonaScope } from './neuralPersonaTypes';

export interface NeuralPersonaProviderDataPolicy {
  allowedScopes: readonly NeuralPersonaScope[];
}

export const DEFAULT_NEURAL_PERSONA_PROVIDER_DATA_POLICY: NeuralPersonaProviderDataPolicy = Object.freeze({
  allowedScopes: Object.freeze(['runtime', 'world'] as const),
});

export function canShareNeuralPersonaScopeWithProvider(
  scope: NeuralPersonaScope,
  policy: NeuralPersonaProviderDataPolicy = DEFAULT_NEURAL_PERSONA_PROVIDER_DATA_POLICY,
) {
  return policy.allowedScopes.includes(scope);
}
