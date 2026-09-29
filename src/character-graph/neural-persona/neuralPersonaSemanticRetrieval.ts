import { canReadNeuralPersonaNode } from './neuralPersonaAccessPolicy';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import {
  canShareNeuralPersonaScopeWithProvider,
  DEFAULT_NEURAL_PERSONA_PROVIDER_DATA_POLICY,
  type NeuralPersonaProviderDataPolicy,
} from './neuralPersonaProviderDataPolicy';
import type {
  NeuralPersonaSemanticDocument,
  NeuralPersonaSemanticMatch,
  NeuralPersonaSemanticRetrievalProvider,
  NeuralPersonaSemanticRetrievalRequest,
} from './neuralPersonaSemanticRetrievalTypes';
import type { NeuralPersonaContextInput } from './neuralPersonaTypes';
import { isNeuralPersonaAnchorNode } from './neuralPersonaAnchor';
import { isNeuralPersonaStructuralNode } from './neuralPersonaGeneratedHierarchy';

function parseProviderResult(value: unknown) {
  if (!value || typeof value !== 'object') return { reason: 'semantic-result-invalid', status: 'invalid' as const };
  const result = value as { matches?: unknown; reason?: unknown; status?: unknown };
  if (result.status === 'unavailable' && typeof result.reason === 'string') {
    return { reason: result.reason || 'semantic-provider-unavailable', status: 'unavailable' as const };
  }
  if (result.status !== 'ok' || !Array.isArray(result.matches)) {
    return { reason: 'semantic-result-invalid', status: 'invalid' as const };
  }
  if (result.matches.some((match) => !match || typeof match !== 'object'
    || typeof match.nodeId !== 'string' || typeof match.score !== 'number')) {
    return { reason: 'semantic-result-match-invalid', status: 'invalid' as const };
  }
  return { matches: result.matches as NeuralPersonaSemanticMatch[], status: 'ok' as const };
}

export function createNeuralPersonaSemanticDocuments(
  store: ReadonlyNeuralPersonaGraphStore,
  input: NeuralPersonaContextInput,
  dataPolicy: NeuralPersonaProviderDataPolicy = DEFAULT_NEURAL_PERSONA_PROVIDER_DATA_POLICY,
): NeuralPersonaSemanticDocument[] {
  return store.listNodes().filter((node) => !isNeuralPersonaAnchorNode(node)
    && !isNeuralPersonaStructuralNode(node)
    && canReadNeuralPersonaNode(node, input)
    && canShareNeuralPersonaScopeWithProvider(node.scope, dataPolicy)).map((node) => ({
    nodeId: node.nodeId,
    scope: node.scope,
    summary: node.influenceSummary,
    tagLabels: node.tags.filter((tag) => tag.status === 'active').map((tag) => tag.label),
    type: node.type,
  }));
}

export function validateNeuralPersonaSemanticMatches(
  matches: NeuralPersonaSemanticMatch[],
  documents: NeuralPersonaSemanticDocument[],
) {
  if (matches.length > documents.length) return 'semantic-result-limit-exceeded';
  const knownIds = new Set(documents.map((document) => document.nodeId));
  const ids = matches.map((match) => match.nodeId);
  if (ids.some((id) => !knownIds.has(id))) return 'semantic-result-node-not-readable';
  if (new Set(ids).size !== ids.length) return 'semantic-result-duplicate-node';
  if (matches.some((match) => !Number.isFinite(match.score)
    || match.score < 0 || match.score > 1)) return 'semantic-result-score-invalid';
  return null;
}

export async function callNeuralPersonaSemanticProvider(
  provider: NeuralPersonaSemanticRetrievalProvider,
  request: NeuralPersonaSemanticRetrievalRequest,
) {
  if (!provider.providerId.trim()) {
    return { reason: 'semantic-provider-id-missing', status: 'invalid' as const };
  }
  try {
    const parsed = parseProviderResult(await provider.retrieve(request));
    if (parsed.status !== 'ok') return parsed;
    const issue = validateNeuralPersonaSemanticMatches(parsed.matches, request.documents);
    if (issue) return { reason: issue, status: 'invalid' as const };
    return { matches: parsed.matches, status: 'ok' as const };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : 'semantic-provider-error',
      status: 'unavailable' as const,
    };
  }
}
