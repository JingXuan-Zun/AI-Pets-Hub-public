import type {
  NeuralPersonaNodeType,
  NeuralPersonaScope,
  NeuralPersonaTag,
} from './neuralPersonaTypes';

export interface NeuralPersonaTagSuggestionRequest {
  existingTagIds: string[];
  nodeId: string;
  nodeType: NeuralPersonaNodeType;
  requestId: string;
  roleId: string;
  scope: NeuralPersonaScope;
  summary: string;
  signal?: AbortSignal;
}

export interface NeuralPersonaTagSuggestionDraft {
  aliases?: string[];
  canonicalId: string;
  confidence: number;
  evidence?: string[];
  label: string;
}

export type NeuralPersonaTagSuggestionProviderResult =
  | { status: 'ok'; suggestions: NeuralPersonaTagSuggestionDraft[] }
  | { reason: string; status: 'unavailable' };

export interface NeuralPersonaTagSuggestionProvider {
  providerId: string;
  suggest: (
    request: NeuralPersonaTagSuggestionRequest,
  ) => Promise<NeuralPersonaTagSuggestionProviderResult>;
}

export interface NeuralPersonaReviewedTagSuggestion extends NeuralPersonaTagSuggestionDraft {
  reviewedAt?: number;
  reviewerId?: string;
  status: 'accepted' | 'pending-review' | 'rejected';
  suggestionId: string;
}

export interface NeuralPersonaTagSuggestionBatch {
  batchId: string;
  createdAt: number;
  generatorId: string;
  nodeId: string;
  requestId: string;
  roleId: string;
  suggestions: NeuralPersonaReviewedTagSuggestion[];
}

export type NeuralPersonaTagSuggestionRequestResult =
  | { batch: NeuralPersonaTagSuggestionBatch; status: 'ok' }
  | { reason: string; status: 'invalid' | 'unavailable' };

export type NeuralPersonaTagSuggestionReviewResult =
  | { batch: NeuralPersonaTagSuggestionBatch; status: 'ok' }
  | { reason: string; status: 'invalid' | 'missing' };

export type NeuralPersonaApprovedTag = NeuralPersonaTag;
