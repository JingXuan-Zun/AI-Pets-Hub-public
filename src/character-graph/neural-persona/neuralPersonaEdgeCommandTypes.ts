import type { NeuralPersonaPersistedRecord, NeuralPersonaWriteResult } from './neuralPersonaPersistenceTypes';
import type { NeuralPersonaEdge, NeuralPersonaEdgeType } from './neuralPersonaTypes';

export interface NeuralPersonaEdgeDraft {
  confidence: number;
  edgeId: string;
  relationType: NeuralPersonaEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
}

export type NeuralPersonaEdgePatch = Partial<Pick<
  NeuralPersonaEdgeDraft,
  'confidence' | 'relationType' | 'weight'
>>;

export interface CreateNeuralPersonaEdgeCommand {
  commandId: string;
  edge: NeuralPersonaEdgeDraft;
  expectedRevision: number;
  roleId: string;
}

export interface UpdateNeuralPersonaEdgeCommand {
  commandId: string;
  confirmProtectedRelationship?: boolean;
  edgeId: string;
  expectedRevision: number;
  patch: NeuralPersonaEdgePatch;
  roleId: string;
}

export interface DeleteNeuralPersonaEdgeCommand {
  commandId: string;
  confirmProtectedRelationship?: boolean;
  edgeId: string;
  expectedRevision: number;
  roleId: string;
}

export interface NeuralPersonaEdgeCommandReceipt {
  appliedRevision: number;
  commandId: string;
  commandType: 'create-edge' | 'delete-edge' | 'update-edge';
  edgeId: string;
  graphVersion: string;
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaEdgeCommandResult =
  | {
    receipt: NeuralPersonaEdgeCommandReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;

export type EditableNeuralPersonaEdge = Pick<
  NeuralPersonaEdge,
  keyof NeuralPersonaEdgeDraft
>;
