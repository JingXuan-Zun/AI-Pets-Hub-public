import type {
  NeuralPersonaGraphProjection,
  NeuralPersonaGraphViewNode,
} from './neuralPersonaGraphProjection';
import type {
  NeuralPersonaNodeStatus,
  NeuralPersonaNodeType,
  NeuralPersonaScope,
} from './neuralPersonaTypes';
import {
  type NeuralPersonaGraphCluster,
  type NeuralPersonaLayoutNode,
} from './neuralPersonaGraphLayout';
import { layoutNeuralPersonaGraphHierarchy } from './neuralPersonaGraphHierarchyLayout';
import {
  NEURAL_PERSONA_GRAPH_VIEW_HEIGHT,
  NEURAL_PERSONA_GRAPH_VIEW_WIDTH,
  NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_HEIGHT,
  NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_WIDTH,
} from './neuralPersonaGraphDimensions';

export interface NeuralPersonaGraphFilters {
  focusNodeId?: string;
  query: string;
  scopes: NeuralPersonaScope[];
  statuses: NeuralPersonaNodeStatus[];
  tagIds: string[];
  types: NeuralPersonaNodeType[];
}

export interface NeuralPersonaGraphExplorerView {
  clusters: NeuralPersonaGraphCluster[];
  edges: NeuralPersonaGraphProjection['edges'];
  nodes: NeuralPersonaLayoutNode[];
  tagIds: string[];
}

export const EMPTY_NEURAL_PERSONA_GRAPH_FILTERS: NeuralPersonaGraphFilters = {
  query: '',
  scopes: [],
  statuses: [],
  tagIds: [],
  types: [],
};

function includesAny<T>(selected: T[], values: T[]) {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

function matchesNode(node: NeuralPersonaGraphViewNode, filters: NeuralPersonaGraphFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  const searchable = `${node.label} ${node.nodeId} ${node.tagIds.join(' ')}`.toLocaleLowerCase();
  return (!query || searchable.includes(query))
    && includesAny(filters.scopes, [node.scope])
    && includesAny(filters.statuses, [node.status])
    && includesAny(filters.types, [node.type])
    && filters.tagIds.every((tagId) => node.tagIds.includes(tagId));
}

function focusedNodeIds(projection: NeuralPersonaGraphProjection, focusNodeId?: string) {
  if (!focusNodeId) return null;
  const ids = new Set([focusNodeId]);
  projection.edges.forEach((edge) => {
    if (edge.sourceNodeId === focusNodeId) ids.add(edge.targetNodeId);
    if (edge.targetNodeId === focusNodeId) ids.add(edge.sourceNodeId);
  });
  return ids;
}

export function buildNeuralPersonaGraphExplorerView(
  projection: NeuralPersonaGraphProjection,
  filters: NeuralPersonaGraphFilters,
  viewport = {
    height: NEURAL_PERSONA_GRAPH_VIEW_HEIGHT,
    width: NEURAL_PERSONA_GRAPH_VIEW_WIDTH,
  },
): NeuralPersonaGraphExplorerView {
  const focused = focusedNodeIds(projection, filters.focusNodeId);
  const visibleNodes = projection.nodes.filter((node) => (
    matchesNode(node, filters) && (!focused || focused.has(node.nodeId))
  ));
  const visibleIds = new Set(visibleNodes.map((node) => node.nodeId));
  const visibleEdges = projection.edges.filter((edge) => (
    visibleIds.has(edge.sourceNodeId) && visibleIds.has(edge.targetNodeId)
  ));
  const layout = layoutNeuralPersonaGraphHierarchy(visibleNodes, visibleEdges, viewport);
  const offsetX = (NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_WIDTH - viewport.width) / 2;
  const offsetY = (NEURAL_PERSONA_GRAPH_INITIAL_WORKSPACE_HEIGHT - viewport.height) / 2;
  return {
    clusters: layout.clusters.map((cluster) => ({
      ...cluster, x: cluster.x + offsetX, y: cluster.y + offsetY,
    })),
    edges: visibleEdges,
    nodes: layout.nodes.map((node) => ({
      ...node,
      anchorX: (node.anchorX ?? node.x) + offsetX,
      anchorY: (node.anchorY ?? node.y) + offsetY,
      x: node.x + offsetX, y: node.y + offsetY,
    })),
    tagIds: [...new Set(projection.nodes.flatMap((node) => node.tagIds))].sort(),
  };
}
