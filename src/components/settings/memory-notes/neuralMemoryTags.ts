import { createUserNeuralPersonaTag, type NeuralPersonaNode, type NeuralPersonaTag } from '../../../character-graph/neural-persona';

export interface MemoryTagFilter {
  id: string;
  label: string;
}

/** Tags that take part in recall: the ones shown on a memory. */
export function activeMemoryTags(node: NeuralPersonaNode) {
  return node.tags.filter((tag) => tag.status === 'active');
}

/** Adds a user tag, or re-activates one that was removed; null when there is nothing to change. */
export function addMemoryTag(node: NeuralPersonaNode, label: string): NeuralPersonaTag[] | null {
  const tag = createUserNeuralPersonaTag({ label });
  if (!tag) return null;
  const existing = node.tags.find((item) => item.canonicalId === tag.canonicalId);
  if (existing?.status === 'active') return null;
  return existing
    ? node.tags.map((item) => (item === existing ? { ...item, status: 'active' as const } : item))
    : [...node.tags, tag];
}

/** User tags are dropped; system tags are kept as rejected so they are not suggested again. */
export function removeMemoryTag(node: NeuralPersonaNode, canonicalId: string): NeuralPersonaTag[] {
  return node.tags.flatMap((tag) => {
    if (tag.canonicalId !== canonicalId) return [tag];
    return tag.source === 'user' ? [] : [{ ...tag, status: 'rejected' as const }];
  });
}

export function memoryHasTag(node: NeuralPersonaNode, canonicalId: string) {
  return activeMemoryTags(node).some((tag) => tag.canonicalId === canonicalId);
}
