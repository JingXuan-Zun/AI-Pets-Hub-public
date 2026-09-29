import {
  createNeuralPersonaEdgeCommandService,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaEdgeCommandResult,
  type NeuralPersonaEdgeDraft,
  type NeuralPersonaEdgePatch,
  type NeuralPersonaNodeCommandResult,
  type NeuralPersonaNodeDraft,
  type NeuralPersonaNodePatch,
  type NeuralPersonaGraphRepository,
} from '../../character-graph/neural-persona';
import type { NeuralPersonaGraphSectionState } from './useNeuralPersonaGraphSectionState';

type MutationResult = NeuralPersonaNodeCommandResult | NeuralPersonaEdgeCommandResult;
type ApplyResult = <Result extends MutationResult>(result: Result) => Promise<Result>;

function missingGraph() {
  return { reason: 'graph-not-ready', status: 'missing' } as const;
}

export function createNeuralPersonaNodeMutationActions(options: {
  applyResult: ApplyResult;
  commandId: (type: string) => string;
  repository: () => NeuralPersonaGraphRepository;
  roleId: string;
  state: NeuralPersonaGraphSectionState;
}) {
  const createNode = async (node: NeuralPersonaNodeDraft) => {
    if (options.state.status !== 'ready') return missingGraph();
    const service = createNeuralPersonaNodeCommandService({ repository: options.repository() });
    return options.applyResult(await service.createNode({
      commandId: options.commandId('create-node'), expectedRevision: options.state.record.revision,
      node, roleId: options.roleId,
    }));
  };
  const initializeGraph = async () => {
    const service = createNeuralPersonaNodeCommandService({ repository: options.repository() });
    return options.applyResult(await service.initializeGraph({
      commandId: options.commandId('initialize-graph'), roleId: options.roleId,
    }));
  };
  const updateNode = async (nodeId: string, patch: NeuralPersonaNodePatch) => {
    if (options.state.status !== 'ready') return missingGraph();
    const service = createNeuralPersonaNodeCommandService({ repository: options.repository() });
    return options.applyResult(await service.updateNode({
      commandId: options.commandId('update-node'), expectedRevision: options.state.record.revision,
      nodeId, patch, roleId: options.roleId,
    }));
  };
  return { createNode, initializeGraph, updateNode };
}

export function createNeuralPersonaEdgeMutationActions(options: {
  applyResult: ApplyResult;
  commandId: (type: string) => string;
  onDeleted: () => void;
  repository: () => NeuralPersonaGraphRepository;
  roleId: string;
  state: NeuralPersonaGraphSectionState;
}) {
  const createEdge = async (edge: NeuralPersonaEdgeDraft) => {
    if (options.state.status !== 'ready') return missingGraph();
    const service = createNeuralPersonaEdgeCommandService({ repository: options.repository() });
    return options.applyResult(await service.createEdge({
      commandId: options.commandId('create-edge'), edge,
      expectedRevision: options.state.record.revision, roleId: options.roleId,
    }));
  };
  const updateEdge = async (edgeId: string, patch: NeuralPersonaEdgePatch, confirmProtectedRelationship: boolean) => {
    if (options.state.status !== 'ready') return missingGraph();
    const service = createNeuralPersonaEdgeCommandService({ repository: options.repository() });
    return options.applyResult(await service.updateEdge({
      commandId: options.commandId('update-edge'), confirmProtectedRelationship, edgeId,
      expectedRevision: options.state.record.revision, patch, roleId: options.roleId,
    }));
  };
  const deleteEdge = async (edgeId: string, confirmProtectedRelationship: boolean) => {
    if (options.state.status !== 'ready') return missingGraph();
    const service = createNeuralPersonaEdgeCommandService({ repository: options.repository() });
    const result = await options.applyResult(await service.deleteEdge({
      commandId: options.commandId('delete-edge'), confirmProtectedRelationship, edgeId,
      expectedRevision: options.state.record.revision, roleId: options.roleId,
    }));
    if (result.status === 'ok') options.onDeleted();
    return result;
  };
  return { createEdge, deleteEdge, updateEdge };
}
