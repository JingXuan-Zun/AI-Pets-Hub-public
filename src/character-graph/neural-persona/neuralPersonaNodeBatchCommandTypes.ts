import type { NeuralPersonaPersistedRecord, NeuralPersonaWriteResult } from './neuralPersonaPersistenceTypes';
import type { NeuralPersonaNodeGenerationBatch } from './neuralPersonaNodeGenerationTypes';

export interface CommitNeuralPersonaGeneratedNodesCommand {
  batch: NeuralPersonaNodeGenerationBatch;
  commandId: string;
  expectedRevision: number | null;
  reviewerId: string;
  roleId: string;
}

export interface NeuralPersonaNodeBatchCommandReceipt {
  appliedRevision: number;
  batchId: string;
  commandId: string;
  generatedEdgeIds: string[];
  generatedSemanticEdgeIds: string[];
  generatedBranchNodeIds: string[];
  generatedNodeIds: string[];
  personaAnchorNodeId: string;
  reusedNodeIds: string[];
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaNodeBatchCommandResult =
  | {
    receipt: NeuralPersonaNodeBatchCommandReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;
