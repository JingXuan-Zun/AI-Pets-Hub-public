import type {
  NeuralPersonaPersistedRecord,
  NeuralPersonaWriteResult,
} from './neuralPersonaPersistenceTypes';
import type { NeuralPersonaTag } from './neuralPersonaTypes';

export interface StageNeuralPersonaTagSuggestionsCommand {
  commandId: string;
  confirmProtectedNode?: boolean;
  expectedRevision: number;
  nodeId: string;
  roleId: string;
  suggestions: NeuralPersonaTag[];
}

export interface ReviewNeuralPersonaTagSuggestionCommand {
  commandId: string;
  confirmProtectedNode?: boolean;
  decision: 'accept' | 'reject';
  expectedRevision: number;
  nodeId: string;
  reviewerId: string;
  roleId: string;
  tagId: string;
}

export interface NeuralPersonaTagReviewCommandReceipt {
  appliedRevision: number;
  commandId: string;
  commandType: 'review-tag-suggestion' | 'stage-tag-suggestions';
  decision?: 'accept' | 'reject';
  graphVersion: string;
  nodeId: string;
  roleId: string;
  tagIds: string[];
  timestamp: number;
}

export type NeuralPersonaTagReviewCommandResult =
  | {
    receipt: NeuralPersonaTagReviewCommandReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;
