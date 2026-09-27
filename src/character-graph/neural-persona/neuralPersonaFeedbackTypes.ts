import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';

export const NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION = 1 as const;
export const MAX_NEURAL_PERSONA_FEEDBACK_EVENTS = 300;
export const MAX_NEURAL_PERSONA_FEEDBACK_RECOVERY_SNAPSHOTS = 5;

export type NeuralPersonaFeedbackKind =
  | 'correction'
  | 'dismissal'
  | 'negative'
  | 'positive';

export type NeuralPersonaFeedbackSourceType =
  | 'manual-review'
  | 'system-test'
  | 'user-explicit';

export interface NeuralPersonaFeedbackEvidence {
  sourceId: string;
  sourceType: NeuralPersonaFeedbackSourceType;
  summary: string;
}

export interface NeuralPersonaFeedbackEvent {
  eventId: string;
  evidence: NeuralPersonaFeedbackEvidence;
  kind: NeuralPersonaFeedbackKind;
  magnitude: number;
  nodeId: string;
  observedGraphRevision?: number;
  occurredAt: number;
  roleId: string;
}

export interface NeuralPersonaFeedbackRecoverySnapshot {
  createdAt: number;
  reason: 'before-update';
  serializedEvents: string;
  snapshotId: string;
}

export interface NeuralPersonaReinforcementLedgerRecord {
  events: NeuralPersonaFeedbackEvent[];
  formatVersion: typeof NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION;
  recoverySnapshots: NeuralPersonaFeedbackRecoverySnapshot[];
  revision: number;
  roleId: string;
  updatedAt: number;
}

export interface NeuralPersonaFeedbackRepositoryOptions {
  now?: () => number;
  storage: NeuralPersonaAtomicStorage;
}

export interface NeuralPersonaFeedbackAppendInput {
  event: NeuralPersonaFeedbackEvent;
  expectedRevision: number;
  nodeId: string;
  roleId: string;
}

export type NeuralPersonaFeedbackLoadResult =
  | { record: NeuralPersonaReinforcementLedgerRecord; status: 'ok' }
  | { reason: string; status: 'corrupt' }
  | { status: 'missing' };

export type NeuralPersonaFeedbackWriteResult =
  | { record: NeuralPersonaReinforcementLedgerRecord; status: 'ok' }
  | { eventId: string; record: NeuralPersonaReinforcementLedgerRecord; status: 'idempotent' }
  | { actualRevision: number | null; status: 'conflict' }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };

export interface NeuralPersonaReinforcementProjection {
  correctionCount: number;
  dismissalCount: number;
  eventCount: number;
  negativeCount: number;
  negativeScore: number;
  netScore: number;
  nodeId: string;
  positiveCount: number;
  positiveScore: number;
  projectedAt: number;
  roleId: string;
  sourceEventIds: string[];
}
