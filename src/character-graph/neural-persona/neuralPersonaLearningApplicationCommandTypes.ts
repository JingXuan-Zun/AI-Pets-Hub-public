import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';
import type {
  NeuralPersonaLearningProposalDeltas,
  NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';

export interface ApplyNeuralPersonaLearningProposalCommand {
  appliedBy: string;
  commandId: string;
  confirmProtectedNode?: boolean;
  expectedGraphRevision: number;
  expectedLedgerRevision: number;
  expectedProposalRevision: number;
  proposalId: string;
  roleId: string;
}

export interface NeuralPersonaLearningApplicationReceipt {
  appliedAt: number;
  appliedBy: string;
  appliedGraphRevision: number;
  applicationCommandId: string;
  commandId: string;
  deltas: NeuralPersonaLearningProposalDeltas;
  nodeId: string;
  proposalId: string;
  proposalRevision: number;
  roleId: string;
  sourceGraphRevision: number;
  sourceLedgerRevision: number;
}

export type NeuralPersonaLearningApplicationResult =
  | {
    graphRecord: NeuralPersonaPersistedRecord;
    proposalRecord: NeuralPersonaLearningProposalRecord;
    receipt: NeuralPersonaLearningApplicationReceipt;
    status: 'idempotent' | 'ok';
  }
  | {
    actualRevision: number | null;
    conflictScope: 'graph' | 'ledger' | 'proposal';
    status: 'conflict';
  }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };
