import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import {
  NEURAL_PERSONA_RECORD_VERSION,
  type NeuralPersonaPersistedRecord,
} from './neuralPersonaPersistenceTypes';
import { createImmutableNeuralPersonaSnapshot } from './neuralPersonaSnapshot';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaGraphSnapshot,
} from './neuralPersonaTypes';
import { validateNeuralPersonaGraph } from './neuralPersonaValidation';

type JsonObject = Record<string, unknown>;

export type NeuralPersonaParseResult =
  | { migrated: boolean; record: NeuralPersonaPersistedRecord; status: 'ok' }
  | { reason: string; status: 'corrupt' };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGraphShape(value: unknown): value is JsonObject {
  if (!isObject(value)) return false;
  return typeof value.roleId === 'string'
    && typeof value.graphVersion === 'string'
    && typeof value.createdAt === 'number'
    && Array.isArray(value.nodes)
    && Array.isArray(value.edges);
}

function migrateGraph(value: JsonObject): NeuralPersonaGraphSnapshot | null {
  const version = value.schemaVersion;
  if (version !== 0 && version !== NEURAL_PERSONA_SCHEMA_VERSION) return null;
  const nodes = (value.nodes as unknown[]).map((node) => (
    isObject(node) ? { ...node, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION } : node
  ));
  const edges = (value.edges as unknown[]).map((edge) => (
    isObject(edge) ? { ...edge, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION } : edge
  ));
  return {
    ...value,
    edges,
    nodes,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  } as unknown as NeuralPersonaGraphSnapshot;
}

function normalizeRecord(value: unknown, now: number) {
  if (isGraphShape(value)) {
    const graph = migrateGraph(value);
    if (!graph) return null;
    return {
      migrated: true,
      record: {
        graph,
        recordVersion: NEURAL_PERSONA_RECORD_VERSION,
        recoverySnapshots: [],
        revision: 0,
        roleId: graph.roleId,
        updatedAt: now,
      },
    };
  }
  if (!isObject(value) || value.recordVersion !== NEURAL_PERSONA_RECORD_VERSION
    || !isGraphShape(value.graph) || !Array.isArray(value.recoverySnapshots)) return null;
  const graph = migrateGraph(value.graph);
  if (!graph || typeof value.revision !== 'number' || typeof value.roleId !== 'string'
    || typeof value.updatedAt !== 'number') return null;
  return {
    migrated: value.graph.schemaVersion !== NEURAL_PERSONA_SCHEMA_VERSION,
    record: { ...value, graph } as unknown as NeuralPersonaPersistedRecord,
  };
}

export function serializeNeuralPersonaRecord(record: NeuralPersonaPersistedRecord) {
  return JSON.stringify(record);
}

export function parseNeuralPersonaRecord(
  serialized: string,
  config: NeuralPersonaConfig,
  now: number,
): NeuralPersonaParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(serialized);
  } catch {
    return { reason: 'invalid-json', status: 'corrupt' };
  }
  const normalized = normalizeRecord(raw, now);
  if (!normalized) return { reason: 'unsupported-record-shape', status: 'corrupt' };
  const { record } = normalized;
  if (record.roleId !== record.graph.roleId) {
    return { reason: 'record-role-mismatch', status: 'corrupt' };
  }
  let validation;
  try {
    validation = validateNeuralPersonaGraph(record.graph, config);
  } catch {
    return { reason: 'malformed-graph-fields', status: 'corrupt' };
  }
  if (!validation.valid) {
    return { reason: `invalid-graph:${validation.issues[0]?.code ?? 'unknown'}`, status: 'corrupt' };
  }
  return {
    migrated: normalized.migrated,
    record: { ...record, graph: createImmutableNeuralPersonaSnapshot(record.graph) },
    status: 'ok',
  };
}
