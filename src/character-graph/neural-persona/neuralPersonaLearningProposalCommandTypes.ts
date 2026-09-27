import type {
  NeuralPersonaLearningProposalRecord,
  NeuralPersonaLearningProposalStatus,
} from './neuralPersonaLearningProposalTypes';

export interface GenerateNeuralPersonaLearningProposalCommand {
  commandId: string;
  createdAt: number;
  expectedGraphRevision: number;
  expectedLedgerRevision: number;
  expectedProposalRevision: number | null;
  nodeId: string;
  projectedAt: number;
  roleId: string;
}

export interface ReviewNeuralPersonaLearningProposalCommand {
  commandId: string;
  confirmProtectedNode?: boolean;
  decision: 'accept' | 'reject';
  expectedProposalRevision: number;
  proposalId: string;
  reviewerId: string;
  roleId: string;
}

export interface NeuralPersonaLearningProposalCommandReceipt {
  commandId: string;
  commandType: 'generate-learning-proposal' | 'review-learning-proposal';
  decision?: 'accept' | 'reject';
  proposalId: string;
  proposalRevision: number;
  resultingStatus: NeuralPersonaLearningProposalStatus;
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaLearningProposalCommandResult =
  | {
    receipt: NeuralPersonaLearningProposalCommandReceipt;
    record: NeuralPersonaLearningProposalRecord;
    status: 'ok';
  }
  | {
    receipt: NeuralPersonaLearningProposalCommandReceipt;
    record: NeuralPersonaLearningProposalRecord;
    status: 'idempotent';
  }
  | {
    actualRevision: number | null;
    conflictScope: 'graph' | 'ledger' | 'proposal';
    status: 'conflict';
  }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };
