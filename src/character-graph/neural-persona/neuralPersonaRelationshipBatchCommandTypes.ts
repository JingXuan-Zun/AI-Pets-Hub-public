import type {
  NeuralPersonaPersistedRecord,
  NeuralPersonaWriteResult,
} from './neuralPersonaPersistenceTypes';
import type {
  NeuralPersonaRelationshipCandidateBatch,
} from './neuralPersonaRelationshipCandidateTypes';

export interface CommitNeuralPersonaRelationshipCandidatesCommand {
  batch: NeuralPersonaRelationshipCandidateBatch;
  commandId: string;
  expectedRevision: number;
  reviewerId: string;
  roleId: string;
}

export interface NeuralPersonaRelationshipBatchCommandReceipt {
  appliedRevision: number;
  batchId: string;
  commandId: string;
  generatedEdgeIds: string[];
  reviewerId: string;
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaRelationshipBatchCommandResult =
  | {
    receipt: NeuralPersonaRelationshipBatchCommandReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;
