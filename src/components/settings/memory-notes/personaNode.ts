import {
  createNeuralPersonaAnchorNode,
  isNeuralPersonaAnchorNode,
  isNeuralPersonaStructuralNode,
  neuralPersonaAnchorNodeId,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../../../character-graph/neural-persona';
import { GROWTH_KIND_LABELS, GROWTH_KINDS, GROWTH_NODE_TYPES, isGrowthNode } from '../../../character-growth/growthRules';

// The 人格节点 (2026-11-19, user): a character's knowledge-memory graph always has one node from
// the start — her persona — whether or not anything is written in it. Its content is the persona
// prompt the user writes (the authority stays in her personality, so the node is added for
// display only, never stored), and it is drawn with the avatar set for her in the chat window.

export const isPersonaNode = (node: NeuralPersonaNode) => isNeuralPersonaAnchorNode(node);

export function personaNodeId(roleId: string) {
  return neuralPersonaAnchorNodeId(roleId);
}

/** The graph with her persona node in it (added when missing; the stored graph is untouched). */
export function withPersonaNode(graph: NeuralPersonaGraphSnapshot, roleId: string, roleName: string): NeuralPersonaGraphSnapshot {
  const anchorId = personaNodeId(roleId);
  const hasAnchor = graph.nodes.some((node) => isPersonaNode(node) && node.status !== 'deleted');
  // What she grew into hangs off her persona node (display-only links, like the node itself).
  const growthLinks = graph.nodes
    .filter((node) => node.status !== 'deleted' && isGrowthNode(node) && !graph.edges.some((edge) => edge.sourceNodeId === anchorId && edge.targetNodeId === node.nodeId))
    // Only the fields the graph view reads; never saved.
    .map((node) => ({ edgeId: `persona-growth:${node.nodeId}`, relationType: 'associated-with', sourceNodeId: anchorId, targetNodeId: node.nodeId }) as unknown as NeuralPersonaGraphSnapshot['edges'][number]);
  if (hasAnchor && !growthLinks.length) return graph;
  return {
    ...graph,
    edges: [...graph.edges, ...growthLinks],
    nodes: hasAnchor ? graph.nodes : [createNeuralPersonaAnchorNode({ personaName: roleName, roleId, timestamp: 0 }), ...graph.nodes],
  };
}

/** What the graph view draws: every memory plus the persona node (structural nodes stay hidden). */
export function graphViewNodes(graph: NeuralPersonaGraphSnapshot) {
  return graph.nodes.filter((node) => node.status !== 'deleted' && !isNeuralPersonaStructuralNode(node));
}

/** Her 成长日记: what she grew into, newest first, with how many memories back each one. */
export function growthDiary(graph: NeuralPersonaGraphSnapshot) {
  return graph.nodes
    .filter((node) => node.status !== 'deleted' && isGrowthNode(node))
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((node) => ({
      createdAt: node.createdAt,
      evidenceCount: graph.edges.filter((edge) => edge.targetNodeId === node.nodeId && edge.relationType === 'supports').length,
      kindLabel: GROWTH_KIND_LABELS[GROWTH_KINDS.find((kind) => GROWTH_NODE_TYPES[kind] === node.type) ?? 'preference'],
      nodeId: node.nodeId,
      text: node.influenceSummary,
    }));
}
