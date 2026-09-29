import type {
  NeuralPersonaEdge,
  NeuralPersonaGraphSnapshot,
  NeuralPersonaNode,
  NeuralPersonaTag,
} from './neuralPersonaTypes';

function cloneTag(tag: NeuralPersonaTag): NeuralPersonaTag {
  return Object.freeze({
    ...tag,
    aliases: tag.aliases ? Object.freeze([...tag.aliases]) as string[] : undefined,
  });
}

function cloneNode(node: NeuralPersonaNode): NeuralPersonaNode {
  return Object.freeze({
    ...node,
    learningApplication: node.learningApplication
      ? Object.freeze({
        ...node.learningApplication,
        appliedValues: node.learningApplication.appliedValues
          ? Object.freeze({ ...node.learningApplication.appliedValues }) : undefined,
        previousValues: node.learningApplication.previousValues
          ? Object.freeze({ ...node.learningApplication.previousValues }) : undefined,
      }) : undefined,
    tags: Object.freeze(node.tags.map(cloneTag)) as NeuralPersonaTag[],
  });
}

function cloneEdge(edge: NeuralPersonaEdge): NeuralPersonaEdge {
  return Object.freeze({ ...edge });
}

export function createImmutableNeuralPersonaSnapshot(
  graph: NeuralPersonaGraphSnapshot,
): NeuralPersonaGraphSnapshot {
  return Object.freeze({
    ...graph,
    edges: Object.freeze(graph.edges.map(cloneEdge)) as NeuralPersonaEdge[],
    nodes: Object.freeze(graph.nodes.map(cloneNode)) as NeuralPersonaNode[],
  });
}
