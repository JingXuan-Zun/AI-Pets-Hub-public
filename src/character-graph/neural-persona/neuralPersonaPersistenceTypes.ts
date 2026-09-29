import type { NeuralPersonaGraphSnapshot } from './neuralPersonaTypes';

export const NEURAL_PERSONA_RECORD_VERSION = 1 as const;

export interface NeuralPersonaRecoverySnapshot {
  createdAt: number;
  reason: 'before-migration' | 'before-update';
  snapshotId: string;
  serializedGraph: string;
}

export interface NeuralPersonaPersistedRecord {
  graph: NeuralPersonaGraphSnapshot;
  recordVersion: typeof NEURAL_PERSONA_RECORD_VERSION;
  recoverySnapshots: NeuralPersonaRecoverySnapshot[];
  revision: number;
  roleId: string;
  updatedAt: number;
}

export interface NeuralPersonaAtomicStorage {
  compareAndSwap: (
    roleId: string,
    expectedValue: string | null,
    nextValue: string,
  ) => Promise<boolean>;
  read: (roleId: string) => Promise<string | null>;
}

export type NeuralPersonaLoadResult =
  | { record: NeuralPersonaPersistedRecord; status: 'ok' }
  | { reason: string; status: 'corrupt' }
  | { status: 'missing' };

export type NeuralPersonaWriteResult =
  | { record: NeuralPersonaPersistedRecord; status: 'ok' }
  | { actualRevision: number | null; status: 'conflict' }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };

export interface NeuralPersonaTransactionInput {
  expectedRevision: number;
  roleId: string;
  update: (graph: NeuralPersonaGraphSnapshot) => NeuralPersonaGraphSnapshot;
}
