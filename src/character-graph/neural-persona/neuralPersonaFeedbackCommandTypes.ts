import type {
  NeuralPersonaFeedbackEvidence,
  NeuralPersonaFeedbackKind,
  NeuralPersonaReinforcementLedgerRecord,
} from './neuralPersonaFeedbackTypes';

export interface RecordNeuralPersonaFeedbackCommand {
  commandId: string;
  evidence: NeuralPersonaFeedbackEvidence;
  expectedGraphRevision: number;
  expectedLedgerRevision: number | null;
  kind: NeuralPersonaFeedbackKind;
  magnitude: number;
  nodeId: string;
  occurredAt: number;
  roleId: string;
}

export interface NeuralPersonaFeedbackCommandReceipt {
  commandId: string;
  eventId: string;
  graphRevisionObserved: number;
  ledgerRevision: number;
  nodeId: string;
  roleId: string;
  timestamp: number;
}

export type NeuralPersonaFeedbackCommandResult =
  | {
    receipt: NeuralPersonaFeedbackCommandReceipt;
    record: NeuralPersonaReinforcementLedgerRecord;
    status: 'ok';
  }
  | {
    receipt: NeuralPersonaFeedbackCommandReceipt;
    record: NeuralPersonaReinforcementLedgerRecord;
    status: 'idempotent';
  }
  | {
    actualRevision: number | null;
    conflictScope: 'graph' | 'ledger';
    status: 'conflict';
  }
  | { reason: string; status: 'corrupt' | 'invalid' | 'missing' };
