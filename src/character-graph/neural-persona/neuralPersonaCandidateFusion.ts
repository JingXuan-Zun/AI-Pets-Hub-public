import {
  hasNeuralPersonaCandidateRetrievalSignal,
  retrieveNeuralPersonaCandidates,
} from './neuralPersonaCandidateRetriever';
import type { NeuralPersonaCandidate } from './neuralPersonaCandidateTypes';
import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import type { NeuralPersonaProviderDataPolicy } from './neuralPersonaProviderDataPolicy';
import {
  callNeuralPersonaSemanticProvider,
  createNeuralPersonaSemanticDocuments,
} from './neuralPersonaSemanticRetrieval';
import type {
  NeuralPersonaSemanticRetrievalDiagnostic,
  NeuralPersonaSemanticRetrievalProvider,
} from './neuralPersonaSemanticRetrievalTypes';
import type { NeuralPersonaTagIndex } from './neuralPersonaTagIndex';
import type { NeuralPersonaContextInput } from './neuralPersonaTypes';

function keywordFallback(options: RetrievalOptions, reason: string) {
  return {
    candidates: retrieveNeuralPersonaCandidates(options),
    semantic: {
      providerId: options.semanticProvider?.providerId,
      reason,
      status: 'keyword-fallback',
    } satisfies NeuralPersonaSemanticRetrievalDiagnostic,
  };
}

function fuseCandidate(candidate: NeuralPersonaCandidate, semanticScore: number) {
  const semanticBoost = (1 - candidate.score.total) * semanticScore * 0.35;
  const total = Math.min(1, candidate.score.total + semanticBoost);
  return {
    ...candidate,
    reason: semanticScore > 0 ? [...candidate.reason, 'semantic-match'] : candidate.reason,
    score: { ...candidate.score, semanticRelevance: semanticScore, total },
  };
}

interface RetrievalOptions {
  config: NeuralPersonaConfig;
  dataPolicy?: NeuralPersonaProviderDataPolicy;
  input: NeuralPersonaContextInput;
  semanticProvider?: NeuralPersonaSemanticRetrievalProvider;
  signal?: AbortSignal;
  store: ReadonlyNeuralPersonaGraphStore;
  tagIndex: NeuralPersonaTagIndex;
}

export async function retrieveNeuralPersonaCandidatesWithSemantic(options: RetrievalOptions) {
  if (!options.semanticProvider) return keywordFallback(options, 'semantic-provider-missing');
  if (!options.input.query.trim()) return keywordFallback(options, 'semantic-query-empty');
  const documents = createNeuralPersonaSemanticDocuments(
    options.store, options.input, options.dataPolicy,
  );
  if (!documents.length) return keywordFallback(options, 'semantic-documents-empty');
  const result = await callNeuralPersonaSemanticProvider(options.semanticProvider, {
    documents,
    maxResults: options.config.maxCandidateNodes,
    query: options.input.query,
    requestId: options.input.requestId,
    roleId: options.input.roleId,
    signal: options.signal,
  });
  if (result.status !== 'ok') return keywordFallback(options, result.reason);
  const baseline = retrieveNeuralPersonaCandidates({
    ...options,
    allowUnmatched: true,
    config: {
      ...options.config,
      candidateThreshold: 0,
      maxCandidateNodes: options.store.listNodes().length,
    },
  });
  const semanticById = new Map(result.matches.map((match) => [match.nodeId, match.score]));
  const candidates = baseline.map((candidate) => fuseCandidate(
    candidate, semanticById.get(candidate.node.nodeId) ?? 0,
  )).filter((candidate) => hasNeuralPersonaCandidateRetrievalSignal(candidate)
    && candidate.score.total >= options.config.candidateThreshold)
    .sort((left, right) => right.score.total - left.score.total
      || left.node.nodeId.localeCompare(right.node.nodeId))
    .slice(0, options.config.maxCandidateNodes);
  return {
    candidates,
    semantic: {
      providerId: options.semanticProvider.providerId,
      status: 'semantic',
    } satisfies NeuralPersonaSemanticRetrievalDiagnostic,
  };
}
