import { normalizeNeuralPersonaTagId } from './neuralPersonaTagIndex';
import {
  canShareNeuralPersonaScopeWithProvider,
  DEFAULT_NEURAL_PERSONA_PROVIDER_DATA_POLICY,
  type NeuralPersonaProviderDataPolicy,
} from './neuralPersonaProviderDataPolicy';
import type {
  NeuralPersonaApprovedTag,
  NeuralPersonaReviewedTagSuggestion,
  NeuralPersonaTagSuggestionBatch,
  NeuralPersonaTagSuggestionDraft,
  NeuralPersonaTagSuggestionProvider,
  NeuralPersonaTagSuggestionRequest,
  NeuralPersonaTagSuggestionRequestResult,
  NeuralPersonaTagSuggestionReviewResult,
} from './neuralPersonaTagSuggestionReviewTypes';

const MAX_SUGGESTIONS = 12;
const MAX_ALIASES = 8;
const MAX_EVIDENCE = 4;
const MAX_PROVIDER_SUGGESTIONS = 24;

function isStringArray(value: unknown) {
  return value === undefined || (Array.isArray(value)
    && value.length <= 32 && value.every((entry) => typeof entry === 'string'
      && entry.length <= 1_000));
}

function isSuggestionDraft(value: unknown): value is NeuralPersonaTagSuggestionDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<NeuralPersonaTagSuggestionDraft>;
  return typeof draft.canonicalId === 'string' && typeof draft.label === 'string'
    && typeof draft.confidence === 'number' && isStringArray(draft.aliases)
    && isStringArray(draft.evidence);
}

function cleanList(values: string[] | undefined, maxItems: number) {
  return [...new Set((values ?? []).map((value) => value.normalize('NFKC').trim())
    .filter(Boolean))].slice(0, maxItems);
}

function normalizeDraft(draft: NeuralPersonaTagSuggestionDraft) {
  return {
    aliases: cleanList(draft.aliases, MAX_ALIASES),
    canonicalId: normalizeNeuralPersonaTagId(draft.canonicalId),
    confidence: draft.confidence,
    evidence: cleanList(draft.evidence, MAX_EVIDENCE),
    label: draft.label.normalize('NFKC').replace(/\s+/gu, ' ').trim(),
  };
}

function validateDrafts(drafts: ReturnType<typeof normalizeDraft>[]) {
  if (drafts.length > MAX_SUGGESTIONS) return 'tag-suggestion-limit-exceeded';
  if (drafts.some((draft) => !draft.canonicalId || !draft.label)) return 'tag-suggestion-empty';
  if (drafts.some((draft) => draft.label.length > 64)) return 'tag-suggestion-label-too-long';
  if (drafts.some((draft) => !Number.isFinite(draft.confidence)
    || draft.confidence < 0 || draft.confidence > 1)) return 'tag-suggestion-confidence-invalid';
  if (drafts.some((draft) => draft.evidence.some((value) => value.length > 160))) {
    return 'tag-suggestion-evidence-too-long';
  }
  const ids = drafts.map((draft) => draft.canonicalId);
  if (new Set(ids).size !== ids.length) return 'tag-suggestion-duplicate';
  return null;
}

function createBatch(
  request: NeuralPersonaTagSuggestionRequest,
  providerId: string,
  drafts: ReturnType<typeof normalizeDraft>[],
  now: number,
): NeuralPersonaTagSuggestionBatch {
  const suggestions: NeuralPersonaReviewedTagSuggestion[] = drafts.map((draft) => ({
    ...draft,
    status: 'pending-review',
    suggestionId: `${request.requestId}:${draft.canonicalId}`,
  }));
  return {
    batchId: `tag-suggestions:${request.requestId}`,
    createdAt: now,
    generatorId: providerId,
    nodeId: request.nodeId,
    requestId: request.requestId,
    roleId: request.roleId,
    suggestions,
  };
}

export async function requestNeuralPersonaTagSuggestions(options: {
  dataPolicy?: NeuralPersonaProviderDataPolicy;
  now: number;
  provider: NeuralPersonaTagSuggestionProvider;
  request: NeuralPersonaTagSuggestionRequest;
}): Promise<NeuralPersonaTagSuggestionRequestResult> {
  const { provider, request } = options;
  if (!provider.providerId.trim()) return { reason: 'tag-suggestion-provider-id-missing', status: 'invalid' };
  if (!canShareNeuralPersonaScopeWithProvider(
    request.scope, options.dataPolicy ?? DEFAULT_NEURAL_PERSONA_PROVIDER_DATA_POLICY,
  )) return { reason: 'tag-suggestion-scope-not-allowed', status: 'unavailable' };
  if (![request.requestId, request.roleId, request.nodeId, request.summary]
    .every((value) => value.trim())) return { reason: 'tag-suggestion-request-invalid', status: 'invalid' };
  try {
    const result: unknown = await provider.suggest(request);
    if (!result || typeof result !== 'object') {
      return { reason: 'tag-suggestion-result-invalid', status: 'invalid' };
    }
    const payload = result as { reason?: unknown; status?: unknown; suggestions?: unknown };
    if (payload.status === 'unavailable' && typeof payload.reason === 'string') {
      return { reason: payload.reason, status: 'unavailable' };
    }
    if (payload.status !== 'ok' || !Array.isArray(payload.suggestions)
      || payload.suggestions.length > MAX_PROVIDER_SUGGESTIONS
      || !payload.suggestions.every(isSuggestionDraft)) {
      return { reason: 'tag-suggestion-result-invalid', status: 'invalid' };
    }
    const existingIds = new Set(request.existingTagIds.map(normalizeNeuralPersonaTagId));
    const drafts = payload.suggestions.map(normalizeDraft)
      .filter((draft) => !existingIds.has(draft.canonicalId));
    const issue = validateDrafts(drafts);
    if (issue) return { reason: issue, status: 'invalid' };
    return { batch: createBatch(request, provider.providerId, drafts, options.now), status: 'ok' };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : 'tag-suggestion-provider-error', status: 'unavailable' };
  }
}

export function reviewNeuralPersonaTagSuggestion(options: {
  batch: NeuralPersonaTagSuggestionBatch;
  decision: 'accept' | 'reject';
  reviewedAt: number;
  reviewerId: string;
  suggestionId: string;
}): NeuralPersonaTagSuggestionReviewResult {
  if (!options.reviewerId.trim() || !Number.isFinite(options.reviewedAt)) {
    return { reason: 'tag-suggestion-review-invalid', status: 'invalid' };
  }
  const target = options.batch.suggestions.find((item) => item.suggestionId === options.suggestionId);
  if (!target) return { reason: 'tag-suggestion-missing', status: 'missing' };
  if (target.status !== 'pending-review') return { reason: 'tag-suggestion-already-reviewed', status: 'invalid' };
  return {
    batch: {
      ...options.batch,
      suggestions: options.batch.suggestions.map((item) => item.suggestionId === options.suggestionId
        ? { ...item, reviewedAt: options.reviewedAt, reviewerId: options.reviewerId, status: options.decision === 'accept' ? 'accepted' : 'rejected' }
        : item),
    },
    status: 'ok',
  };
}

export function materializeApprovedNeuralPersonaTags(
  batch: NeuralPersonaTagSuggestionBatch,
): NeuralPersonaApprovedTag[] {
  return batch.suggestions.filter((suggestion) => suggestion.status === 'accepted'
    && Boolean(suggestion.reviewerId?.trim())
    && Number.isFinite(suggestion.reviewedAt)).map((suggestion) => ({
    aliases: suggestion.aliases,
    canonicalId: suggestion.canonicalId,
    confidence: suggestion.confidence,
    label: suggestion.label,
    reviewedAt: suggestion.reviewedAt,
    reviewerId: suggestion.reviewerId,
    source: 'system',
    status: 'active',
  }));
}
