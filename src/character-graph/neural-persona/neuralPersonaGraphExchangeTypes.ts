import type { NeuralPersonaGraphSnapshot } from './neuralPersonaTypes';
import type {
  NeuralPersonaPersistedRecord,
  NeuralPersonaWriteResult,
} from './neuralPersonaPersistenceTypes';

export const NEURAL_PERSONA_GRAPH_EXPORT_FORMAT = 'ai-desktop-pet.neural-persona.graph' as const;
export const NEURAL_PERSONA_GRAPH_EXPORT_VERSION = 1 as const;
export const NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES = 4 * 1024 * 1024;

export interface NeuralPersonaGraphExportPayload {
  exportedAt: number;
  format: typeof NEURAL_PERSONA_GRAPH_EXPORT_FORMAT;
  formatVersion: typeof NEURAL_PERSONA_GRAPH_EXPORT_VERSION;
  graph: NeuralPersonaGraphSnapshot;
  source: {
    graphVersion: string;
    revision: number;
    roleId: string;
  };
}

export interface NeuralPersonaGraphDiff {
  addedEdgeIds: string[];
  addedNodeIds: string[];
  changedEdgeIds: string[];
  changedNodeIds: string[];
  hasChanges: boolean;
  protectedNodeChangeIds: string[];
  protectedRelationshipEdgeChangeIds: string[];
  removedEdgeIds: string[];
  removedNodeIds: string[];
  requiresProtectedConfirmation: boolean;
}

export type NeuralPersonaGraphImportPreview =
  | {
    diff: NeuralPersonaGraphDiff;
    expectedRevision: number;
    graph: NeuralPersonaGraphSnapshot;
    migrated: boolean;
    sourceRevision: number;
    sourceRoleId: string;
    status: 'ready';
  }
  | { expectedRevision: number; reason: string; status: 'invalid' }
  | { actualRevision: number; expectedRevision: number; reason: 'revision-conflict'; status: 'conflict' };

export interface ImportNeuralPersonaGraphCommand {
  commandId: string;
  confirmProtectedChanges?: boolean;
  expectedRevision: number;
  graph: NeuralPersonaGraphSnapshot;
  roleId: string;
  sourceRevision: number;
}

export interface NeuralPersonaGraphExchangeReceipt {
  appliedRevision: number;
  commandId: string;
  commandType: 'import-graph';
  graphVersion: string;
  roleId: string;
  sourceRevision: number;
  timestamp: number;
}

export type NeuralPersonaGraphExchangeResult =
  | {
    receipt: NeuralPersonaGraphExchangeReceipt;
    record: NeuralPersonaPersistedRecord;
    status: 'ok';
  }
  | Exclude<NeuralPersonaWriteResult, { status: 'ok' }>;
