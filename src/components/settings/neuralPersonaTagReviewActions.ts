import {
  DEFAULT_NEURAL_PERSONA_TAG_VOCABULARY,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaTagReviewCommandService,
  DEFAULT_NEURAL_PERSONA_CONFIG,
  requestNeuralPersonaTagSuggestions,
  suggestNeuralPersonaTags,
  type NeuralPersonaNode,
  type NeuralPersonaPersistedRecord,
  type NeuralPersonaTag,
  type NeuralPersonaTagReviewCommandResult,
} from '../../character-graph/neural-persona';
import { createNeuralPersonaConfiguredModelDataPolicy,
  createNeuralPersonaConfiguredModelProviders } from '../../services/neuralPersonaConfiguredModelProvider';
import type { PetConfig } from '../../types';

function repository() {
  return createNeuralPersonaGraphRepository({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    storage: createNeuralPersonaDesktopStorage(),
  });
}

function commandId(type: string) {
  return `${type}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

interface TagReviewActionInput {
  onResult: (result: NeuralPersonaTagReviewCommandResult) => Promise<NeuralPersonaTagReviewCommandResult>;
  record?: NeuralPersonaPersistedRecord;
  roleId: string;
  settings: PetConfig['settings'];
}

async function resolveTagSuggestions(
  input: TagReviewActionInput,
  node: NeuralPersonaNode,
): Promise<NeuralPersonaTag[]> {
  const fallback = suggestNeuralPersonaTags(node, DEFAULT_NEURAL_PERSONA_TAG_VOCABULARY);
  if (!input.settings.neuralPersonaModelTagSuggestionsEnabled) return fallback;
  const providers = createNeuralPersonaConfiguredModelProviders({
    dataEgressConsent: input.settings.neuralPersonaProviderDataEgressConsent,
    settings: input.settings, timeoutMs: input.settings.neuralPersonaProviderTimeoutMs,
  });
  const model = await requestNeuralPersonaTagSuggestions({
    dataPolicy: createNeuralPersonaConfiguredModelDataPolicy(
      input.settings.neuralPersonaPrivateProviderDataConsent,
    ),
    now: Date.now(), provider: providers.tagSuggestionProvider,
    request: {
      existingTagIds: node.tags.map((tag) => tag.canonicalId),
      nodeId: node.nodeId, nodeType: node.type,
      requestId: commandId('model-tag-suggestions'), roleId: input.roleId,
      scope: node.scope, summary: node.influenceSummary,
    },
  });
  if (model.status !== 'ok' || !model.batch.suggestions.length) return fallback;
  return model.batch.suggestions.map((item) => ({
    aliases: item.aliases, canonicalId: item.canonicalId,
    confidence: item.confidence, label: item.label,
    source: 'system' as const, status: 'pending-review' as const,
  }));
}

export function createNeuralPersonaTagReviewActions(input: TagReviewActionInput) {
  const stageTagSuggestions = async (nodeId: string, confirmProtectedNode: boolean) => {
    if (!input.record) return { reason: 'graph-not-ready', status: 'missing' as const };
    const node = input.record.graph.nodes.find((item) => item.nodeId === nodeId);
    if (!node) return { reason: 'node-missing', status: 'missing' as const };
    const suggestions = await resolveTagSuggestions(input, node);
    const service = createNeuralPersonaTagReviewCommandService({ repository: repository() });
    return input.onResult(await service.stageSuggestions({
      commandId: commandId('stage-tag-suggestions'), confirmProtectedNode,
      expectedRevision: input.record.revision, nodeId, roleId: input.roleId, suggestions,
    }));
  };
  const reviewTagSuggestion = async (
    nodeId: string, tagId: string, decision: 'accept' | 'reject', confirmProtectedNode: boolean,
  ) => {
    if (!input.record) return { reason: 'graph-not-ready', status: 'missing' as const };
    const service = createNeuralPersonaTagReviewCommandService({ repository: repository() });
    return input.onResult(await service.reviewSuggestion({
      commandId: commandId('review-tag-suggestion'), confirmProtectedNode, decision,
      expectedRevision: input.record.revision, nodeId, reviewerId: 'local-user',
      roleId: input.roleId, tagId,
    }));
  };
  return { reviewTagSuggestion, stageTagSuggestions };
}
