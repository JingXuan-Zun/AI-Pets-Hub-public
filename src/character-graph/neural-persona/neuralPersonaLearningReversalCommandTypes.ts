import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';
import type {
  NeuralPersonaLearningProposalDeltas,
  NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';

export interface ReverseNeuralPersonaLearningProposalCommand {
  commandId: string;
  confirmProtectedNode?: boolean;
  expectedGraphRevision: number;
  expectedProposalRevision: number;
  proposalId: string;
  reversedBy: string;
  roleId: string;
}

export interface NeuralPersonaLearningReversalReceipt {
  applicationCommandId: string;
  commandId: string;
  deltas: NeuralPersonaLearningProposalDeltas;
  nodeId: string;
  proposalId: string;
  proposalRevision: number;
  reversalCommandId: string;
  reversedAt: number;
  reversedBy: string;
  reversedGraphRevision: number;
  roleId: string;
}

export type NeuralPersonaLearningReversalResult =
  | {
    graphRecord: NeuralPersonaPersistedRecord;
    proposalRecord: NeuralPersonaLearningProposalRecord;
    receipt: NeuralPersonaLearningReversalReceipt;
    status: 'idempotent' | 'ok';
  }
  | {
    actualRevision: number | null;
    conflictScope: 'graph' | 'proposal';
    status: 'conflict';
  }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };
