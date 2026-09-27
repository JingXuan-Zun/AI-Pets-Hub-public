import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import type {
  DeleteNeuralPersonaNodesCommand,
  NeuralPersonaNodeBatchDeleteReceipt,
  NeuralPersonaNodeBatchDeleteResult,
} from './neuralPersonaNodeBatchDeleteCommandTypes';

interface CommandOptions {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}

function graphVersion(revision: number) {
  return `neural-graph.r${revision}`;
}

function validateCommand(command: DeleteNeuralPersonaNodesCommand) {
  if (!command.commandId.trim()) return 'command-id-missing';
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    return 'expected-revision-invalid';
  }
  if (!command.nodeIds.length) return 'node-batch-selection-empty';
  if (command.nodeIds.some((nodeId) => !nodeId.trim())) return 'node-batch-selection-invalid';
  if (new Set(command.nodeIds).size !== command.nodeIds.length) {
    return 'node-batch-selection-duplicate';
  }
  return null;
}

function receipt(options: {
  command: DeleteNeuralPersonaNodesCommand;
  deletedEdgeIds: string[];
  revision: number;
  timestamp: number;
}): NeuralPersonaNodeBatchDeleteReceipt {
  return {
    appliedRevision: options.revision,
    commandId: options.command.commandId,
    commandType: 'delete-nodes',
    deletedEdgeIds: options.deletedEdgeIds,
    deletedNodeIds: [...options.command.nodeIds],
    graphVersion: graphVersion(options.revision),
    roleId: options.command.roleId,
    timestamp: options.timestamp,
  };
}

async function executeDelete(
  options: CommandOptions,
  command: DeleteNeuralPersonaNodesCommand,
): Promise<NeuralPersonaNodeBatchDeleteResult> {
  const issue = validateCommand(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const selectedIds = new Set(command.nodeIds);
  const selectedNodes = loaded.record.graph.nodes.filter((node) => selectedIds.has(node.nodeId));
  if (selectedNodes.length !== selectedIds.size) return { reason: 'node-missing', status: 'missing' };
  if (selectedNodes.some((node) => node.protected) && !command.confirmProtectedNodes) {
    return { reason: 'protected-node-confirmation-required', status: 'invalid' };
  }
  const deletedEdges = loaded.record.graph.edges.filter((edge) => (
    selectedIds.has(edge.sourceNodeId) || selectedIds.has(edge.targetNodeId)
  ));
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: (graph) => ({
      ...graph,
      edges: graph.edges.filter((edge) => !selectedIds.has(edge.sourceNodeId)
        && !selectedIds.has(edge.targetNodeId)),
      graphVersion: graphVersion(revision),
      nodes: graph.nodes.filter((node) => !selectedIds.has(node.nodeId)),
    }),
  });
  if (result.status !== 'ok') return result;
  return {
    receipt: receipt({ command, deletedEdgeIds: deletedEdges.map((edge) => edge.edgeId), revision, timestamp }),
    record: result.record,
    status: 'ok',
  };
}

export function createNeuralPersonaNodeBatchDeleteCommandService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}) {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return {
    deleteNodes: (command: DeleteNeuralPersonaNodesCommand) => executeDelete(resolved, command),
  };
}
