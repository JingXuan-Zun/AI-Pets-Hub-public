import {
  createNeuralPersonaEdgeCommandService,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaEdgeType,
  type NeuralPersonaGraphRepository,
  type NeuralPersonaNode,
} from '../character-graph/neural-persona';
import { createNeuralMemoryRepository } from './neuralMemoryStaging';

const LINK_LABEL_MAX_LENGTH = 12;

/** Short text inserted for a dropped memory: its first phrase, without trailing punctuation. */
export function neuralMemoryLinkLabel(node: Pick<NeuralPersonaNode, 'influenceSummary'>) {
  const firstPhrase = node.influenceSummary.replace(/\s+/gu, ' ').trim().split(/[，。！？,.!?；;\n]/u)[0] ?? '';
  return firstPhrase.slice(0, LINK_LABEL_MAX_LENGTH).replace(/[、：:]+$/u, '') || '一段记忆';
}

export function insertTextAt(content: string, offset: number, text: string) {
  const at = Math.max(0, Math.min(content.length, Math.round(offset)));
  return `${content.slice(0, at)}${text}${content.slice(at)}`;
}

let sequence = 0;
function commandId(kind: string) {
  sequence += 1;
  return `neural-memory-link:${kind}:${Date.now()}:${sequence}`;
}

/**
 * Obsidian-style drop: inserts the target's label into the source content at
 * `offset` and links that text to the target. Both writes read the latest
 * revision, so they never race the settings controller's cached revision.
 */
export async function insertNeuralMemoryLink(options: {
  offset: number;
  relation?: NeuralPersonaEdgeType;
  repository?: NeuralPersonaGraphRepository;
  roleId: string;
  sourceNodeId: string;
  targetNodeId: string;
}) {
  const repository = options.repository ?? createNeuralMemoryRepository();
  const loaded = await repository.load(options.roleId);
  if (loaded.status !== 'ok') return { reason: loaded.status, status: 'invalid' as const };
  const source = loaded.record.graph.nodes.find((node) => node.nodeId === options.sourceNodeId);
  const target = loaded.record.graph.nodes.find((node) => node.nodeId === options.targetNodeId);
  if (!source || !target || source.nodeId === target.nodeId) {
    return { reason: 'link-node-missing', status: 'invalid' as const };
  }
  const label = neuralMemoryLinkLabel(target);
  const updated = await createNeuralPersonaNodeCommandService({ repository }).updateNode({
    commandId: commandId('insert-text'), expectedRevision: loaded.record.revision,
    nodeId: source.nodeId, patch: { influenceSummary: insertTextAt(source.influenceSummary, options.offset, label) },
    roleId: options.roleId,
  });
  if (updated.status !== 'ok') return updated;
  return createNeuralPersonaEdgeCommandService({ repository }).createEdge({
    commandId: commandId('create-edge'),
    edge: {
      anchorText: label, confidence: 0.8,
      edgeId: `memory-link-${source.nodeId}-${target.nodeId}-${Date.now().toString(36)}`,
      relationType: options.relation ?? 'associated-with',
      sourceNodeId: source.nodeId, targetNodeId: target.nodeId, weight: 0.6,
    },
    expectedRevision: updated.record.revision,
    roleId: options.roleId,
  });
}
