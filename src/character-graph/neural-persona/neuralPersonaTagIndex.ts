import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import type { NeuralPersonaNode } from './neuralPersonaTypes';

export interface NeuralPersonaTagIndex {
  findNodeIds: (tagIds: Iterable<string>) => string[];
  listTagIds: () => string[];
}

export function normalizeNeuralPersonaTagId(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/gu, '-');
}

function isIndexableNode(node: NeuralPersonaNode) {
  return node.status === 'active';
}

export function createNeuralPersonaTagIndex(
  store: ReadonlyNeuralPersonaGraphStore,
): NeuralPersonaTagIndex {
  const nodeIdsByTag = new Map<string, Set<string>>();
  const add = (tagId: string, nodeId: string) => {
    const normalized = normalizeNeuralPersonaTagId(tagId);
    if (!normalized) return;
    const nodeIds = nodeIdsByTag.get(normalized) ?? new Set<string>();
    nodeIds.add(nodeId);
    nodeIdsByTag.set(normalized, nodeIds);
  };
  store.listNodes().filter(isIndexableNode).forEach((node) => {
    node.tags.forEach((tag) => {
      if (tag.status !== 'active') return;
      add(tag.canonicalId, node.nodeId);
      add(tag.label, node.nodeId);
      tag.aliases?.forEach((alias) => add(alias, node.nodeId));
    });
  });
  return {
    findNodeIds: (tagIds) => [...new Set([...tagIds].flatMap((tagId) => (
      [...(nodeIdsByTag.get(normalizeNeuralPersonaTagId(tagId)) ?? [])]
    )))].sort(),
    listTagIds: () => [...nodeIdsByTag.keys()].sort(),
  };
}
