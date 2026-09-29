import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import { createImmutableNeuralPersonaSnapshot } from './neuralPersonaSnapshot';
import type {
  NeuralPersonaEdge,
  NeuralPersonaGraphSnapshot,
  NeuralPersonaNode,
} from './neuralPersonaTypes';
import {
  validateNeuralPersonaGraph,
  type NeuralPersonaValidationIssue,
} from './neuralPersonaValidation';

export interface ReadonlyNeuralPersonaGraphStore {
  getEdge: (edgeId: string) => NeuralPersonaEdge | null;
  getNode: (nodeId: string) => NeuralPersonaNode | null;
  listEdges: () => NeuralPersonaEdge[];
  listNodes: () => NeuralPersonaNode[];
  snapshot: () => NeuralPersonaGraphSnapshot;
}

export type NeuralPersonaGraphStoreResult =
  | { issues: []; store: ReadonlyNeuralPersonaGraphStore; valid: true }
  | { issues: NeuralPersonaValidationIssue[]; store: null; valid: false };

export function createReadonlyNeuralPersonaGraphStore(
  input: NeuralPersonaGraphSnapshot,
  config: NeuralPersonaConfig,
): NeuralPersonaGraphStoreResult {
  const validation = validateNeuralPersonaGraph(input, config);
  if (!validation.valid) {
    return { issues: validation.issues, store: null, valid: false };
  }
  const graph = createImmutableNeuralPersonaSnapshot(input);
  const nodesById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const edgesById = new Map(graph.edges.map((edge) => [edge.edgeId, edge]));
  return {
    issues: [],
    store: {
      getEdge: (edgeId) => edgesById.get(edgeId) ?? null,
      getNode: (nodeId) => nodesById.get(nodeId) ?? null,
      listEdges: () => [...edgesById.values()],
      listNodes: () => [...nodesById.values()],
      snapshot: () => graph,
    },
    valid: true,
  };
}
