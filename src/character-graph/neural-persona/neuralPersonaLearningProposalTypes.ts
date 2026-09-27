import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';

export const NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION = 1 as const;
export const MAX_NEURAL_PERSONA_LEARNING_PROPOSALS = 100;
export const MAX_NEURAL_PERSONA_PROPOSAL_SOURCE_EVENTS = 50;
export const MAX_NEURAL_PERSONA_BASE_WEIGHT_DELTA = 0.05;
export const MAX_NEURAL_PERSONA_CONFIDENCE_DELTA = 0.02;
export const MAX_NEURAL_PERSONA_STABILITY_DELTA = 0.01;

export type NeuralPersonaLearningProposalStatus =
  | 'accepted'
  | 'applied'
  | 'applying'
  | 'pending-review'
  | 'rejected'
  | 'reversed'
  | 'reversing';

export interface NeuralPersonaLearningProposalDeltas {
  baseWeight: number;
  confidence: number;
  stability: number;
}

export interface NeuralPersonaLearningProposalSignal {
  eventCount: number;
  negativeScore: number;
  netScore: number;
  positiveScore: number;
}

export interface NeuralPersonaLearningProposal {
  appliedAt?: number;
  appliedBy?: string;
  appliedGraphRevision?: number;
  applicationCommandId?: string;
  applicationStartedAt?: number;
  createdAt: number;
  deltas: NeuralPersonaLearningProposalDeltas;
  nodeId: string;
  observedGraphRevision: number;
  observedLedgerRevision: number;
  projectedAt: number;
  proposalId: string;
  protectedNode: boolean;
  protectedReviewConfirmed?: boolean;
  reasonSummary: string;
  reversalCommandId?: string;
  reversalStartedAt?: number;
  reversedAt?: number;
  reversedBy?: string;
  reversedGraphRevision?: number;
  reviewedAt?: number;
  reviewerId?: string;
  roleId: string;
  signal: NeuralPersonaLearningProposalSignal;
  sourceEventIds: string[];
  status: NeuralPersonaLearningProposalStatus;
}

export interface NeuralPersonaLearningProposalRecoverySnapshot {
  createdAt: number;
  reason: 'before-update';
  serializedProposals: string;
  snapshotId: string;
}

export interface NeuralPersonaLearningProposalRecord {
  formatVersion: typeof NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION;
  proposals: NeuralPersonaLearningProposal[];
  recoverySnapshots: NeuralPersonaLearningProposalRecoverySnapshot[];
  revision: number;
  roleId: string;
  updatedAt: number;
}

export interface NeuralPersonaLearningProposalRepositoryOptions {
  now?: () => number;
  storage: NeuralPersonaAtomicStorage;
}

export interface NeuralPersonaLearningProposalTransactionInput {
  expectedRevision: number;
  roleId: string;
  update: (
    proposals: NeuralPersonaLearningProposal[],
  ) => NeuralPersonaLearningProposal[];
}

export type NeuralPersonaLearningProposalLoadResult =
  | { record: NeuralPersonaLearningProposalRecord; status: 'ok' }
  | { reason: string; status: 'corrupt' }
  | { status: 'missing' };

export type NeuralPersonaLearningProposalWriteResult =
  | { record: NeuralPersonaLearningProposalRecord; status: 'ok' }
  | { actualRevision: number | null; status: 'conflict' }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };
