import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';
import {
  NEURAL_PERSONA_GRAPH_EXPORT_FORMAT,
  NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES,
  NEURAL_PERSONA_GRAPH_EXPORT_VERSION,
  type NeuralPersonaGraphDiff,
  type NeuralPersonaGraphExportPayload,
  type NeuralPersonaGraphImportPreview,
} from './neuralPersonaGraphExchangeTypes';
import { parseNeuralPersonaRecord } from './neuralPersonaSerialization';
import type { NeuralPersonaGraphSnapshot } from './neuralPersonaTypes';

type JsonObject = Record<string, unknown>;
type GraphItem = { edgeId: string } | { nodeId: string };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function itemId(item: GraphItem) {
  return 'nodeId' in item ? item.nodeId : item.edgeId;
}

function changedIds(current: GraphItem[], incoming: GraphItem[]) {
  const currentById = new Map(current.map((item) => [itemId(item), item]));
  const incomingById = new Map(incoming.map((item) => [itemId(item), item]));
  return {
    added: [...incomingById.keys()].filter((id) => !currentById.has(id)),
    changed: [...incomingById.keys()].filter((id) => currentById.has(id)
      && JSON.stringify(currentById.get(id)) !== JSON.stringify(incomingById.get(id))),
    removed: [...currentById.keys()].filter((id) => !incomingById.has(id)),
  };
}

export function createNeuralPersonaGraphExportPayload(
  record: NeuralPersonaPersistedRecord,
  exportedAt = Date.now(),
): NeuralPersonaGraphExportPayload {
  return {
    exportedAt,
    format: NEURAL_PERSONA_GRAPH_EXPORT_FORMAT,
    formatVersion: NEURAL_PERSONA_GRAPH_EXPORT_VERSION,
    graph: record.graph,
    source: {
      graphVersion: record.graph.graphVersion,
      revision: record.revision,
      roleId: record.roleId,
    },
  };
}

export function serializeNeuralPersonaGraphExport(
  record: NeuralPersonaPersistedRecord,
  exportedAt?: number,
) {
  return `${JSON.stringify(createNeuralPersonaGraphExportPayload(record, exportedAt), null, 2)}\n`;
}

function parseEnvelope(value: unknown) {
  if (!isObject(value)) return 'export-envelope-invalid';
  if (value.format !== NEURAL_PERSONA_GRAPH_EXPORT_FORMAT) return 'export-format-unsupported';
  if (value.formatVersion !== NEURAL_PERSONA_GRAPH_EXPORT_VERSION) return 'export-version-unsupported';
  if (!isObject(value.source) || !isObject(value.graph)) return 'export-payload-missing';
  const source = value.source;
  if (typeof source.roleId !== 'string' || typeof source.graphVersion !== 'string'
    || typeof source.revision !== 'number' || !Number.isInteger(source.revision)
    || source.revision < 0) return 'export-source-invalid';
  if (typeof value.exportedAt !== 'number' || !Number.isFinite(value.exportedAt)) return 'export-time-invalid';
  return null;
}

export function parseNeuralPersonaGraphExport(
  serialized: string,
  config: NeuralPersonaConfig,
  now: number,
  expectedRoleId?: string,
) {
  if (new TextEncoder().encode(serialized).byteLength > NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES) {
    return { reason: 'import-file-too-large', status: 'invalid' as const };
  }
  let raw: unknown;
  try { raw = JSON.parse(serialized); } catch { return { reason: 'invalid-json', status: 'invalid' as const }; }
  const envelopeIssue = parseEnvelope(raw);
  if (envelopeIssue) return { reason: envelopeIssue, status: 'invalid' as const };
  const envelope = raw as NeuralPersonaGraphExportPayload;
  const parsed = parseNeuralPersonaRecord(JSON.stringify(envelope.graph), config, now);
  if (parsed.status === 'corrupt') return { reason: parsed.reason, status: 'invalid' as const };
  if (parsed.record.roleId !== envelope.source.roleId || parsed.record.graph.roleId !== envelope.source.roleId) {
    return { reason: 'export-role-mismatch', status: 'invalid' as const };
  }
  if (parsed.record.graph.graphVersion !== envelope.source.graphVersion) {
    return { reason: 'export-source-version-mismatch', status: 'invalid' as const };
  }
  if (expectedRoleId && parsed.record.roleId !== expectedRoleId) {
    return { reason: 'import-role-mismatch', status: 'invalid' as const };
  }
  return {
    graph: parsed.record.graph,
    migrated: envelope.graph.schemaVersion !== parsed.record.graph.schemaVersion,
    sourceRevision: envelope.source.revision,
    sourceRoleId: envelope.source.roleId,
    status: 'ok' as const,
  };
}

export function diffNeuralPersonaGraphs(
  current: NeuralPersonaGraphSnapshot,
  incoming: NeuralPersonaGraphSnapshot,
): NeuralPersonaGraphDiff {
  const nodes = changedIds(current.nodes, incoming.nodes);
  const edges = changedIds(current.edges, incoming.edges);
  const protectedNodeIds = new Set(
    current.nodes.filter((node) => node.protected).map((node) => node.nodeId),
  );
  const protectedEdgeIds = new Set(current.edges.filter((edge) => (
    protectedNodeIds.has(edge.sourceNodeId) || protectedNodeIds.has(edge.targetNodeId)
  )).map((edge) => edge.edgeId));
  const protectedNodeChangeIds = [...nodes.changed, ...nodes.removed]
    .filter((id) => protectedNodeIds.has(id));
  const protectedRelationshipEdgeChangeIds = [...edges.changed, ...edges.removed]
    .filter((id) => protectedEdgeIds.has(id));
  return {
    addedEdgeIds: edges.added,
    addedNodeIds: nodes.added,
    changedEdgeIds: edges.changed,
    changedNodeIds: nodes.changed,
    hasChanges: Boolean(nodes.added.length || nodes.changed.length || nodes.removed.length
      || edges.added.length || edges.changed.length || edges.removed.length),
    protectedNodeChangeIds,
    protectedRelationshipEdgeChangeIds,
    removedEdgeIds: edges.removed,
    removedNodeIds: nodes.removed,
    requiresProtectedConfirmation: Boolean(
      protectedNodeChangeIds.length || protectedRelationshipEdgeChangeIds.length,
    ),
  };
}

export function createNeuralPersonaGraphImportPreview(input: {
  config: NeuralPersonaConfig;
  currentRecord: NeuralPersonaPersistedRecord;
  expectedRevision: number;
  now: number;
  serialized: string;
}): NeuralPersonaGraphImportPreview {
  const parsed = parseNeuralPersonaGraphExport(
    input.serialized, input.config, input.now, input.currentRecord.roleId,
  );
  if (parsed.status !== 'ok') return { expectedRevision: input.expectedRevision, reason: parsed.reason, status: 'invalid' };
  if (input.currentRecord.revision !== input.expectedRevision) {
    return { actualRevision: input.currentRecord.revision, expectedRevision: input.expectedRevision, reason: 'revision-conflict', status: 'conflict' };
  }
  return {
    diff: diffNeuralPersonaGraphs(input.currentRecord.graph, parsed.graph),
    expectedRevision: input.expectedRevision,
    graph: parsed.graph,
    migrated: parsed.migrated,
    sourceRevision: parsed.sourceRevision,
    sourceRoleId: parsed.sourceRoleId,
    status: 'ready',
  };
}
