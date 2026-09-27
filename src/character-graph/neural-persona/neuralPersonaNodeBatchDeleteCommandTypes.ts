import type {
  NeuralPersonaPersistedRecord,
  NeuralPersonaWriteResult,
} from './neuralPersonaPersistenceTypes';

export interface DeleteNeuralPersonaNodesCommand {
  commandId: string;
  confirmProtectedNodes?: boolean;
  expectedRevision: number;
  nodeIds: string[];
  roleId: string;
}

export interface NeuralPersonaNodeBatchDeleteReceipt {
  appliedRevision: number;
  commandId: string;
  commandType: 'delete-nodes';
  deletedEdgeIds: string[];
  deletedNodeIds: string[];
  graphVersion: string;
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaNodeBatchDeleteResult =
  | {
    receipt: NeuralPersonaNodeBatchDeleteReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;
