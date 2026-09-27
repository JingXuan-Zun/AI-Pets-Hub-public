import { retrieveNeuralPersonaCandidatesWithSemantic } from './neuralPersonaCandidateFusion';
import {
  buildNeuralContextContribution,
  type NeuralPersonaContextAdapterResult,
} from './neuralPersonaContextAdapter';
import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import type { NeuralPersonaProviderDataPolicy } from './neuralPersonaProviderDataPolicy';
import type {
  NeuralPersonaSemanticRetrievalDiagnostic,
  NeuralPersonaSemanticRetrievalProvider,
} from './neuralPersonaSemanticRetrievalTypes';
import { createNeuralPersonaTagIndex } from './neuralPersonaTagIndex';
import type { NeuralPersonaContextInput } from './neuralPersonaTypes';

export interface NeuralPersonaAsyncContextAdapterResult
  extends NeuralPersonaContextAdapterResult {
  semantic: NeuralPersonaSemanticRetrievalDiagnostic;
}

export async function buildNeuralContextContributionWithSemantic(options: {
  config: NeuralPersonaConfig;
  dataPolicy?: NeuralPersonaProviderDataPolicy;
  input: NeuralPersonaContextInput;
  semanticProvider: NeuralPersonaSemanticRetrievalProvider;
  signal?: AbortSignal;
  store: ReadonlyNeuralPersonaGraphStore;
}): Promise<NeuralPersonaAsyncContextAdapterResult> {
  const retrieval = await retrieveNeuralPersonaCandidatesWithSemantic({
    ...options,
    tagIndex: createNeuralPersonaTagIndex(options.store),
  });
  return {
    ...buildNeuralContextContribution({
      config: options.config,
      input: options.input,
      seedCandidates: retrieval.candidates,
      store: options.store,
    }),
    semantic: retrieval.semantic,
  };
}
