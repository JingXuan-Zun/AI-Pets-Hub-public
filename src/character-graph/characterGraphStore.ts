import type { CharacterGraphNode } from './characterGraphTypes';

export interface CharacterGraphStore {
  get: (id: string) => CharacterGraphNode | null;
  list: () => CharacterGraphNode[];
}

function normalizeNode(node: CharacterGraphNode): CharacterGraphNode | null {
  const id = node.id.trim();
  const summary = node.summary.replace(/\s+/gu, ' ').trim();
  if (!id || !summary || !Number.isFinite(node.confidence)) {
    return null;
  }
  return {
    ...node,
    confidence: Math.max(0, Math.min(1, node.confidence)),
    id,
    participantRoleIds: [...new Set(node.participantRoleIds.filter(Boolean))],
    summary,
    source: node.source.trim() || 'unknown',
  };
}

export function createReadonlyCharacterGraphStore(
  inputNodes: CharacterGraphNode[] = [],
): CharacterGraphStore {
  const nodesById = new Map<string, CharacterGraphNode>();
  inputNodes.forEach((inputNode) => {
    const node = normalizeNode(inputNode);
    if (!node) return;
    const current = nodesById.get(node.id);
    if (!current || node.updatedAt >= current.updatedAt) {
      nodesById.set(node.id, node);
    }
  });
  return {
    get: (id) => nodesById.get(id) ?? null,
    list: () => [...nodesById.values()],
  };
}
