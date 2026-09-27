import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaEdgeCommandService,
  createNeuralPersonaGraphProjection,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  createNeuralPersonaNodeBatchCommandService,
  createNeuralPersonaNodeBatchDeleteCommandService,
  createNeuralPersonaRelationshipBatchCommandService,
  createReadonlyNeuralPersonaGraphStore,
  type NeuralPersonaGraphProjection,
  type NeuralPersonaGraphExchangeResult,
  type NeuralPersonaEdgeCommandResult,
  type NeuralPersonaNodeCommandResult,
  type NeuralPersonaNodeBatchCommandResult,
  type NeuralPersonaNodeBatchDeleteResult,
  type NeuralPersonaNodeGenerationBatch,
  type NeuralPersonaPersistedRecord,
  type NeuralPersonaRelationshipBatchCommandResult,
  type NeuralPersonaRelationshipCandidateBatch,
  type NeuralPersonaTagReviewCommandResult,
} from '../../character-graph/neural-persona';
import {
  createNeuralPersonaGraphExchangeActions,
} from './neuralPersonaGraphExchangeActions';
import { createNeuralPersonaTagReviewActions } from './neuralPersonaTagReviewActions';
import type { PetConfig } from '../../types';
import { toggleNeuralPersonaNodeBatchSelection } from './neuralPersonaNodeBatchSelection';
import {
  createNeuralPersonaEdgeMutationActions,
  createNeuralPersonaNodeMutationActions,
} from './neuralPersonaGraphMutationActions';

export type NeuralPersonaGraphSectionState =
  | { status: 'disabled' | 'loading' | 'missing' }
  | { message: string; status: 'error' }
  | { projection: NeuralPersonaGraphProjection; record: NeuralPersonaPersistedRecord; status: 'ready' };

function repository() {
  return createNeuralPersonaGraphRepository({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    storage: createNeuralPersonaDesktopStorage(),
  });
}

function readyState(record: NeuralPersonaPersistedRecord): NeuralPersonaGraphSectionState {
  const store = createReadonlyNeuralPersonaGraphStore(record.graph, DEFAULT_NEURAL_PERSONA_CONFIG);
  if (!store.valid) return { message: store.issues[0]?.code ?? 'invalid-graph', status: 'error' };
  return { projection: createNeuralPersonaGraphProjection(store.store), record, status: 'ready' };
}

async function loadState(roleId: string): Promise<NeuralPersonaGraphSectionState> {
  try {
    const loaded = await repository().load(roleId);
    if (loaded.status === 'missing') return { status: 'missing' };
    if (loaded.status === 'corrupt') return { message: loaded.reason, status: 'error' };
    return readyState(loaded.record);
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error), status: 'error' };
  }
}

function commandId(type: string) {
  return `${type}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function useGraphState(enabled: boolean, roleId: string) {
  const [state, setState] = useState<NeuralPersonaGraphSectionState>({ status: 'disabled' });
  const activeRoleId = useRef(roleId);
  activeRoleId.current = roleId;
  const refresh = useCallback(async () => {
    const next = await loadState(roleId);
    if (activeRoleId.current === roleId) setState(next);
    return next;
  }, [roleId]);
  useEffect(() => {
    if (!enabled) { setState({ status: 'disabled' }); return undefined; }
    let active = true;
    setState({ status: 'loading' });
    void loadState(roleId).then((next) => active && setState(next));
    return () => { active = false; };
  }, [enabled, roleId]);
  return { activeRoleId, refresh, setState, state };
}

function useGraphSelection(roleId: string) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [focusNodeId, setFocusNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [batchDeleteMode, setBatchDeleteMode] = useState(false);
  const [batchSelectedNodeIds, setBatchSelectedNodeIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedNodeId(undefined);
    setFocusNodeId(undefined);
    setSelectedEdgeId(undefined);
    setBatchDeleteMode(false);
    setBatchSelectedNodeIds([]);
  }, [roleId]);
  const toggleBatchDeleteMode = (enabled: boolean) => {
    setBatchDeleteMode(enabled); setBatchSelectedNodeIds([]);
    if (enabled) setSelectedNodeId(undefined);
  };
  const selectNodeId = (nodeId?: string) => {
    if (!batchDeleteMode || !nodeId) { setSelectedNodeId(nodeId); return; }
    setBatchSelectedNodeIds((current) => (
      toggleNeuralPersonaNodeBatchSelection(current, nodeId)
    ));
  };
  const selectBatchNodeIds = (nodeIds: string[], append: boolean) => {
    setBatchSelectedNodeIds((current) => (
      [...new Set(append ? [...current, ...nodeIds] : nodeIds)]
    ));
  };
  const clearBatchSelection = () => setBatchSelectedNodeIds([]);
  const focusNode = (nodeId?: string) => {
    setFocusNodeId(nodeId); setSelectedNodeId(nodeId);
  };
  return {
    batchDeleteMode, batchSelectedNodeIds, clearBatchSelection, focusNode, focusNodeId,
    selectBatchNodeIds, selectNodeId,
    selectedEdgeId, selectedNodeId, setBatchSelectedNodeIds, setSelectedEdgeId,
    setSelectedNodeId, toggleBatchDeleteMode,
  };
}

function createDeleteNodeAction(
  state: NeuralPersonaGraphSectionState,
  roleId: string,
  applyResult: (result: NeuralPersonaNodeCommandResult) => Promise<NeuralPersonaNodeCommandResult>,
  clearSelection: () => void,
) {
  return async (nodeId: string, confirmProtectedNode: boolean) => {
    if (state.status !== 'ready') return { reason: 'graph-not-ready', status: 'missing' } as const;
    const service = createNeuralPersonaNodeCommandService({ repository: repository() });
    const result = await applyResult(await service.deleteNode({
      commandId: commandId('delete-node'), confirmProtectedNode,
      expectedRevision: state.record.revision, nodeId, roleId,
    }));
    if (result.status === 'ok') clearSelection();
    return result;
  };
}

function createCommitGeneratedNodesAction(
  state: NeuralPersonaGraphSectionState,
  roleId: string,
  applyResult: (
    result: NeuralPersonaNodeBatchCommandResult,
  ) => Promise<NeuralPersonaNodeBatchCommandResult>,
  onCommitted: () => void,
) {
  return async (batch: NeuralPersonaNodeGenerationBatch) => {
    if (state.status !== 'ready' && state.status !== 'missing') {
      return { reason: 'graph-not-ready', status: 'missing' } as const;
    }
    const service = createNeuralPersonaNodeBatchCommandService({ repository: repository() });
    const result = await applyResult(await service.commitGeneratedNodes({
      batch, commandId: commandId('generate-nodes'),
      expectedRevision: state.status === 'ready' ? state.record.revision : null,
      reviewerId: 'local-user', roleId,
    }));
    if (result.status === 'ok') onCommitted();
    return result;
  };
}

function createDeleteNodesAction(
  state: NeuralPersonaGraphSectionState,
  roleId: string,
  applyResult: (
    result: NeuralPersonaNodeBatchDeleteResult,
  ) => Promise<NeuralPersonaNodeBatchDeleteResult>,
  onSuccess: () => void,
) {
  return async (nodeIds: string[], confirmProtectedNodes: boolean) => {
    if (state.status !== 'ready') {
      return { reason: 'graph-not-ready', status: 'missing' } as const;
    }
    const service = createNeuralPersonaNodeBatchDeleteCommandService({ repository: repository() });
    const result = await applyResult(await service.deleteNodes({
      commandId: commandId('delete-nodes'), confirmProtectedNodes,
      expectedRevision: state.record.revision, nodeIds, roleId,
    }));
    if (result.status === 'ok') onSuccess();
    return result;
  };
}

function createCommitRelationshipCandidatesAction(
  state: NeuralPersonaGraphSectionState,
  roleId: string,
  applyResult: (
    result: NeuralPersonaRelationshipBatchCommandResult,
  ) => Promise<NeuralPersonaRelationshipBatchCommandResult>,
) {
  return async (batch: NeuralPersonaRelationshipCandidateBatch) => {
    if (state.status !== 'ready') {
      return { reason: 'graph-not-ready', status: 'missing' } as const;
    }
    const service = createNeuralPersonaRelationshipBatchCommandService({ repository: repository() });
    return applyResult(await service.commitCandidates({
      batch, commandId: commandId('relationship-candidates'),
      expectedRevision: state.record.revision, reviewerId: 'local-user', roleId,
    }));
  };
}

function createResultApplier(graphState: ReturnType<typeof useGraphState>) {
  return async <Result extends NeuralPersonaNodeCommandResult
    | NeuralPersonaNodeBatchCommandResult | NeuralPersonaNodeBatchDeleteResult
    | NeuralPersonaEdgeCommandResult | NeuralPersonaGraphExchangeResult
    | NeuralPersonaRelationshipBatchCommandResult
    | NeuralPersonaTagReviewCommandResult>(result: Result): Promise<Result> => {
    if (result.status === 'ok'
      && graphState.activeRoleId.current === result.record.roleId) {
      graphState.setState(readyState(result.record));
    } else if (result.status === 'conflict') await graphState.refresh();
    return result;
  };
}

function createReviewActions(options: {
  applyResult: ReturnType<typeof createResultApplier>;
  roleId: string;
  settings: PetConfig['settings'];
  state: NeuralPersonaGraphSectionState;
}) {
  const record = options.state.status === 'ready' ? options.state.record : undefined;
  return {
    exchangeActions: createNeuralPersonaGraphExchangeActions({
      onResult: options.applyResult, record, roleId: options.roleId,
    }),
    tagReviewActions: createNeuralPersonaTagReviewActions({
      onResult: options.applyResult, record, roleId: options.roleId,
      settings: options.settings,
    }),
  };
}

function createGraphMutationActions(options: {
  applyResult: ReturnType<typeof createResultApplier>;
  roleId: string;
  selection: ReturnType<typeof useGraphSelection>;
  state: NeuralPersonaGraphSectionState;
}) {
  const mutationOptions = {
    applyResult: options.applyResult, commandId, repository, roleId: options.roleId, state: options.state,
  };
  const nodeActions = createNeuralPersonaNodeMutationActions(mutationOptions);
  const edgeActions = createNeuralPersonaEdgeMutationActions({ ...mutationOptions,
    onDeleted: () => options.selection.setSelectedEdgeId(undefined),
  });
  const commitGeneratedNodes = createCommitGeneratedNodesAction(
    options.state, options.roleId, options.applyResult, () => undefined,
  );
  const commitRelationshipCandidates = createCommitRelationshipCandidatesAction(options.state, options.roleId, options.applyResult);
  const deleteNode = createDeleteNodeAction(options.state, options.roleId, options.applyResult, () => { options.selection.focusNode(undefined); options.selection.setSelectedEdgeId(undefined); });
  const deleteNodes = createDeleteNodesAction(options.state, options.roleId, options.applyResult, () => { options.selection.focusNode(undefined); options.selection.setSelectedEdgeId(undefined); options.selection.toggleBatchDeleteMode(false); });
  return { ...nodeActions, ...edgeActions, commitGeneratedNodes, commitRelationshipCandidates, deleteNode, deleteNodes };
}

export function useNeuralPersonaGraphSectionState(enabled: boolean, roleId: string, settings: PetConfig['settings']) {
  const graphState = useGraphState(enabled, roleId);
  const { refresh, state } = graphState; const selection = useGraphSelection(roleId);
  const applyResult = createResultApplier(graphState);
  const mutations = createGraphMutationActions({
    applyResult,
    roleId, selection, state,
  });
  const { exchangeActions, tagReviewActions } = createReviewActions({ applyResult, roleId, settings, state });
  return { ...exchangeActions, ...tagReviewActions, ...selection, ...mutations, refresh, state };
}
