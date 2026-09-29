import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import {
  type CreateNeuralPersonaNodeCommand,
  type DeleteNeuralPersonaNodeCommand,
  type InitializeNeuralPersonaGraphCommand,
  type NeuralPersonaNodeCommandReceipt,
  type NeuralPersonaNodeCommandResult,
  type NeuralPersonaNodeDraft,
  type UpdateNeuralPersonaNodeCommand,
} from './neuralPersonaNodeCommandTypes';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';
import {
  attachCreatedNeuralPersonaNode,
  reparentNeuralPersonaNode,
} from './neuralPersonaNodeHierarchy';

export interface NeuralPersonaNodeCommandService {
  createNode: (command: CreateNeuralPersonaNodeCommand) => Promise<NeuralPersonaNodeCommandResult>;
  deleteNode: (command: DeleteNeuralPersonaNodeCommand) => Promise<NeuralPersonaNodeCommandResult>;
  initializeGraph: (command: InitializeNeuralPersonaGraphCommand) => Promise<NeuralPersonaNodeCommandResult>;
  updateNode: (command: UpdateNeuralPersonaNodeCommand) => Promise<NeuralPersonaNodeCommandResult>;
}

interface CommandOptions {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}

function createNodeFromDraft(
  draft: NeuralPersonaNodeDraft,
  roleId: string,
  timestamp: number,
): NeuralPersonaNode {
  return {
    ...draft,
    activationCount: 0,
    createdAt: timestamp,
    currentActivation: 0,
    ownerRoleId: roleId,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    updatedAt: timestamp,
  };
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

function receipt(input: {
  commandId: string;
  commandType: NeuralPersonaNodeCommandReceipt['commandType'];
  nodeId?: string;
  revision: number;
  roleId: string;
  timestamp: number;
}): NeuralPersonaNodeCommandReceipt {
  return {
    appliedRevision: input.revision,
    commandId: input.commandId,
    commandType: input.commandType,
    graphVersion: graphVersion(input.revision),
    nodeId: input.nodeId,
    roleId: input.roleId,
    timestamp: input.timestamp,
  };
}

function emptyGraph(roleId: string, timestamp: number): NeuralPersonaGraphSnapshot {
  return {
    createdAt: timestamp,
    edges: [],
    graphVersion: graphVersion(0),
    nodes: [],
    roleId,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
}

async function executeInitialize(
  options: CommandOptions,
  command: InitializeNeuralPersonaGraphCommand,
): Promise<NeuralPersonaNodeCommandResult> {
  const envelopeIssue = invalidEnvelope({ commandId: command.commandId, expectedRevision: 0 });
  if (envelopeIssue) return { reason: envelopeIssue, status: 'invalid' };
  const timestamp = options.now();
  const result = await options.repository.initialize(emptyGraph(command.roleId, timestamp));
  if (result.status !== 'ok') return result;
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'initialize-graph', revision: 0, roleId: command.roleId, timestamp }),
    record: result.record,
    status: 'ok',
  };
}

async function executeCreate(
  options: CommandOptions,
  command: CreateNeuralPersonaNodeCommand,
): Promise<NeuralPersonaNodeCommandResult> {
  const envelopeIssue = invalidEnvelope(command);
  if (envelopeIssue) return { reason: envelopeIssue, status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  if (loaded.record.graph.nodes.some((node) => node.nodeId === command.node.nodeId)) {
    return { reason: 'node-already-exists', status: 'invalid' };
  }
  const timestamp = options.now();
  const node = createNodeFromDraft(command.node, command.roleId, timestamp);
  const prepared = attachCreatedNeuralPersonaNode(loaded.record.graph, node, timestamp);
  if (prepared.status !== 'ok') return prepared;
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: () => ({
      ...prepared.graph,
      graphVersion: graphVersion(revision),
    }),
  });
  if (result.status !== 'ok') return result;
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'create-node', nodeId: node.nodeId, revision, roleId: command.roleId, timestamp }),
    record: result.record,
    status: 'ok',
  };
}

async function executeUpdate(
  options: CommandOptions,
  command: UpdateNeuralPersonaNodeCommand,
): Promise<NeuralPersonaNodeCommandResult> {
  const envelopeIssue = invalidEnvelope(command);
  if (envelopeIssue) return { reason: envelopeIssue, status: 'invalid' };
  if (Object.keys(command.patch).length === 0) {
    return { reason: 'empty-node-patch', status: 'invalid' };
  }
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  if (!loaded.record.graph.nodes.some((node) => node.nodeId === command.nodeId)) {
    return { reason: 'node-missing', status: 'missing' };
  }
  const timestamp = options.now();
  const hierarchy = 'parentNodeId' in command.patch
    ? reparentNeuralPersonaNode(
      loaded.record.graph, command.nodeId, command.patch.parentNodeId, timestamp,
    ) : { graph: loaded.record.graph, status: 'ok' as const };
  if (hierarchy.status !== 'ok') return hierarchy;
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: () => ({
      ...hierarchy.graph,
      graphVersion: graphVersion(revision),
      nodes: hierarchy.graph.nodes.map((node) => node.nodeId === command.nodeId
        ? { ...node, ...command.patch, updatedAt: timestamp }
        : node),
    }),
  });
  if (result.status !== 'ok') return result;
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'update-node', nodeId: command.nodeId, revision, roleId: command.roleId, timestamp }),
    record: result.record,
    status: 'ok',
  };
}

async function executeDelete(
  options: CommandOptions,
  command: DeleteNeuralPersonaNodeCommand,
): Promise<NeuralPersonaNodeCommandResult> {
  const envelopeIssue = invalidEnvelope(command);
  if (envelopeIssue) return { reason: envelopeIssue, status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const node = loaded.record.graph.nodes.find((candidate) => candidate.nodeId === command.nodeId);
  if (!node) return { reason: 'node-missing', status: 'missing' };
  if (node.protected && !command.confirmProtectedNode) {
    return { reason: 'protected-node-confirmation-required', status: 'invalid' };
  }
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: (graph) => ({
      ...graph,
      edges: graph.edges.filter((edge) => (
        edge.sourceNodeId !== command.nodeId && edge.targetNodeId !== command.nodeId
      )),
      graphVersion: graphVersion(revision),
      nodes: graph.nodes.filter((candidate) => candidate.nodeId !== command.nodeId),
    }),
  });
  if (result.status !== 'ok') return result;
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'delete-node', nodeId: command.nodeId, revision, roleId: command.roleId, timestamp }),
    record: result.record,
    status: 'ok',
  };
}

export function createNeuralPersonaNodeCommandService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}): NeuralPersonaNodeCommandService {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return {
    createNode: (command) => executeCreate(resolved, command),
    deleteNode: (command) => executeDelete(resolved, command),
    initializeGraph: (command) => executeInitialize(resolved, command),
    updateNode: (command) => executeUpdate(resolved, command),
  };
}
