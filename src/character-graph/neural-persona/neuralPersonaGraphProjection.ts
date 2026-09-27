import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import type {
  NeuralPersonaEdgeType,
  NeuralPersonaNodeStatus,
  NeuralPersonaNodeType,
  NeuralPersonaScope,
} from './neuralPersonaTypes';

export interface NeuralPersonaGraphViewNode {
  incomingCount: number;
  label: string;
  nodeId: string;
  outgoingCount: number;
  protected: boolean;
  scope: NeuralPersonaScope;
  sourceRef?: string;
  status: NeuralPersonaNodeStatus;
  tagIds: string[];
  type: NeuralPersonaNodeType;
}

export interface NeuralPersonaGraphViewEdge {
  edgeId: string;
  relationType: NeuralPersonaEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
}

export interface NeuralPersonaGraphProjection {
  edges: NeuralPersonaGraphViewEdge[];
  graphVersion: string;
  nodes: NeuralPersonaGraphViewNode[];
  roleId: string;
}

function shortLabel(summary: string) {
  const normalized = summary.replace(/\s+/gu, ' ').trim();
  return normalized.length <= 48 ? normalized : `${normalized.slice(0, 47)}…`;
}

export function createNeuralPersonaGraphProjection(
  store: ReadonlyNeuralPersonaGraphStore,
  options: { exposeSourceRefs?: boolean } = {},
): NeuralPersonaGraphProjection {
  const snapshot = store.snapshot();
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  snapshot.edges.forEach((edge) => {
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
    outgoing.set(edge.sourceNodeId, (outgoing.get(edge.sourceNodeId) ?? 0) + 1);
  });
  return {
    edges: snapshot.edges.map((edge) => ({
      edgeId: edge.edgeId,
      relationType: edge.relationType,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      weight: edge.weight,
    })),
    graphVersion: snapshot.graphVersion,
    nodes: snapshot.nodes.map((node) => ({
      incomingCount: incoming.get(node.nodeId) ?? 0,
      label: shortLabel(node.influenceSummary),
      nodeId: node.nodeId,
      outgoingCount: outgoing.get(node.nodeId) ?? 0,
      protected: node.protected,
      scope: node.scope,
      sourceRef: options.exposeSourceRefs ? node.sourceRef : undefined,
      status: node.status,
      tagIds: node.tags.filter((tag) => tag.status === 'active').map((tag) => tag.canonicalId),
      type: node.type,
    })),
    roleId: snapshot.roleId,
  };
}
