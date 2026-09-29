import type { NeuralPersonaPersistedRecord, NeuralPersonaWriteResult } from './neuralPersonaPersistenceTypes';
import type {
  NeuralPersonaNode,
  NeuralPersonaNodeStatus,
  NeuralPersonaNodeType,
  NeuralPersonaScope,
  NeuralPersonaTag,
} from './neuralPersonaTypes';

export interface NeuralPersonaNodeDraft {
  baseWeight: number;
  confidence: number;
  cooldownUntil?: number;
  decayRate: number;
  expiresAt?: number;
  groupId?: string;
  influenceSummary: string;
  nodeId: string;
  parentNodeId?: string;
  plasticity: number;
  protected: boolean;
  scope: NeuralPersonaScope;
  sourceRef?: string;
  stability: number;
  status: NeuralPersonaNodeStatus;
  subgroupId?: string;
  tags: NeuralPersonaTag[];
  type: NeuralPersonaNodeType;
}

export type NeuralPersonaNodePatch = Partial<Omit<NeuralPersonaNodeDraft, 'nodeId'>>;

export interface CreateNeuralPersonaNodeCommand {
  commandId: string;
  expectedRevision: number;
  node: NeuralPersonaNodeDraft;
  roleId: string;
}

export interface InitializeNeuralPersonaGraphCommand {
  commandId: string;
  roleId: string;
}

export interface UpdateNeuralPersonaNodeCommand {
  commandId: string;
  expectedRevision: number;
  nodeId: string;
  patch: NeuralPersonaNodePatch;
  roleId: string;
}

export interface DeleteNeuralPersonaNodeCommand {
  commandId: string;
  confirmProtectedNode?: boolean;
  expectedRevision: number;
  nodeId: string;
  roleId: string;
}

export interface NeuralPersonaNodeCommandReceipt {
  appliedRevision: number;
  commandId: string;
  commandType: 'create-node' | 'delete-node' | 'initialize-graph' | 'update-node';
  graphVersion: string;
  nodeId?: string;
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaNodeCommandResult =
  | {
    receipt: NeuralPersonaNodeCommandReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;

export type EditableNeuralPersonaNode = Pick<
  NeuralPersonaNode,
  keyof NeuralPersonaNodeDraft
>;
