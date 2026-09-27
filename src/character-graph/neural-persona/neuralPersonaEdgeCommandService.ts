import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import type {
  CreateNeuralPersonaEdgeCommand,
  DeleteNeuralPersonaEdgeCommand,
  NeuralPersonaEdgeCommandReceipt,
  NeuralPersonaEdgeCommandResult,
  NeuralPersonaEdgeDraft,
  UpdateNeuralPersonaEdgeCommand,
} from './neuralPersonaEdgeCommandTypes';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaEdge,
  type NeuralPersonaGraphSnapshot,
} from './neuralPersonaTypes';

interface CommandOptions {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}

export interface NeuralPersonaEdgeCommandService {
  createEdge: (command: CreateNeuralPersonaEdgeCommand) => Promise<NeuralPersonaEdgeCommandResult>;
  deleteEdge: (command: DeleteNeuralPersonaEdgeCommand) => Promise<NeuralPersonaEdgeCommandResult>;
  updateEdge: (command: UpdateNeuralPersonaEdgeCommand) => Promise<NeuralPersonaEdgeCommandResult>;
}

function graphVersion(revision: number) {
  return `neural-graph.r${revision}`;
}

function invalidEnvelope(command: { commandId: string; expectedRevision: number }) {
  if (!command.commandId.trim()) return 'command-id-missing';
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    return 'expected-revision-invalid';
  }
  return null;
}

function edgeFromDraft(
  draft: NeuralPersonaEdgeDraft,
  roleId: string,
  timestamp: number,
): NeuralPersonaEdge {
  return {
    ...draft,
    createdAt: timestamp,
    ownerRoleId: roleId,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    updatedAt: timestamp,
  };
}

function receipt(input: {
  commandId: string;
  commandType: NeuralPersonaEdgeCommandReceipt['commandType'];
  edgeId: string;
  revision: number;
  roleId: string;
  timestamp: number;
}): NeuralPersonaEdgeCommandReceipt {
  return {
    appliedRevision: input.revision,
    commandId: input.commandId,
    commandType: input.commandType,
    edgeId: input.edgeId,
    graphVersion: graphVersion(input.revision),
    roleId: input.roleId,
    timestamp: input.timestamp,
  };
}

function protectedRelationship(graph: NeuralPersonaGraphSnapshot, edge: NeuralPersonaEdge) {
  const protectedIds = new Set(
    graph.nodes.filter((node) => node.protected).map((node) => node.nodeId),
  );
  return protectedIds.has(edge.sourceNodeId) || protectedIds.has(edge.targetNodeId);
}

async function executeCreate(
  options: CommandOptions,
  command: CreateNeuralPersonaEdgeCommand,
): Promise<NeuralPersonaEdgeCommandResult> {
  const issue = invalidEnvelope(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  if (loaded.record.graph.edges.some((edge) => edge.edgeId === command.edge.edgeId)) {
    return { reason: 'edge-already-exists', status: 'invalid' };
  }
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const edge = edgeFromDraft(command.edge, command.roleId, timestamp);
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: (graph) => ({ ...graph, edges: [...graph.edges, edge], graphVersion: graphVersion(revision) }),
  });
  if (result.status !== 'ok') return result;
  return { receipt: receipt({ commandId: command.commandId, commandType: 'create-edge', edgeId: edge.edgeId, revision, roleId: command.roleId, timestamp }), record: result.record, status: 'ok' };
}

async function loadMutableEdge(
  options: CommandOptions,
  command: UpdateNeuralPersonaEdgeCommand | DeleteNeuralPersonaEdgeCommand,
) {
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status !== 'ok') return { loaded };
  if (loaded.record.revision !== command.expectedRevision) return {
    result: { actualRevision: loaded.record.revision, status: 'conflict' as const },
  };
  const edge = loaded.record.graph.edges.find((candidate) => candidate.edgeId === command.edgeId);
  if (!edge) return { result: { reason: 'edge-missing', status: 'missing' as const } };
  if (protectedRelationship(loaded.record.graph, edge) && !command.confirmProtectedRelationship) {
    return { result: { reason: 'protected-relationship-confirmation-required', status: 'invalid' as const } };
  }
  return { edge, loaded };
}

async function executeUpdate(
  options: CommandOptions,
  command: UpdateNeuralPersonaEdgeCommand,
): Promise<NeuralPersonaEdgeCommandResult> {
  const issue = invalidEnvelope(command);
  if (issue) return { reason: issue, status: 'invalid' };
  if (Object.keys(command.patch).length === 0) return { reason: 'empty-edge-patch', status: 'invalid' };
  const resolved = await loadMutableEdge(options, command);
  if ('result' in resolved) return resolved.result;
  if (resolved.loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (resolved.loaded.status === 'corrupt') return resolved.loaded;
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: (graph) => ({ ...graph, edges: graph.edges.map((edge) => edge.edgeId === command.edgeId ? { ...edge, ...command.patch, updatedAt: timestamp } : edge), graphVersion: graphVersion(revision) }),
  });
  if (result.status !== 'ok') return result;
  return { receipt: receipt({ commandId: command.commandId, commandType: 'update-edge', edgeId: command.edgeId, revision, roleId: command.roleId, timestamp }), record: result.record, status: 'ok' };
}

async function executeDelete(
  options: CommandOptions,
  command: DeleteNeuralPersonaEdgeCommand,
): Promise<NeuralPersonaEdgeCommandResult> {
  const issue = invalidEnvelope(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const resolved = await loadMutableEdge(options, command);
  if ('result' in resolved) return resolved.result;
  if (resolved.loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (resolved.loaded.status === 'corrupt') return resolved.loaded;
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: (graph) => ({ ...graph, edges: graph.edges.filter((edge) => edge.edgeId !== command.edgeId), graphVersion: graphVersion(revision) }),
  });
  if (result.status !== 'ok') return result;
  return { receipt: receipt({ commandId: command.commandId, commandType: 'delete-edge', edgeId: command.edgeId, revision, roleId: command.roleId, timestamp }), record: result.record, status: 'ok' };
}

export function createNeuralPersonaEdgeCommandService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}): NeuralPersonaEdgeCommandService {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return {
    createEdge: (command) => executeCreate(resolved, command),
    deleteEdge: (command) => executeDelete(resolved, command),
    updateEdge: (command) => executeUpdate(resolved, command),
  };
}
