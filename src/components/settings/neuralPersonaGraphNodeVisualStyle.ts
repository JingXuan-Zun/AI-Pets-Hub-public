import type {
  NeuralPersonaNodeStatus,
  NeuralPersonaNodeType,
} from '../../character-graph/neural-persona';

const NODE_COLORS: Partial<Record<NeuralPersonaNodeType, number>> = {
  'persona-anchor': 0xff2bd6,
  'cognitive-domain': 0x38bdf8,
  'cognitive-topic': 0x818cf8,
  'identity-reference': 0x22d3ee,
  'memory-reference': 0xa78bfa,
  experience: 0x34d399,
  preference: 0xfbbf24,
  'emotional-tendency': 0xfb7185,
};

export function neuralPersonaGraphColorHex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

type NodeDegree = {
  incomingCount: number;
  label?: string;
  outgoingCount: number;
  status: NeuralPersonaNodeStatus;
  tagIds?: readonly string[];
  type: NeuralPersonaNodeType;
};

function connectionCount(node: Pick<NodeDegree, 'incomingCount' | 'outgoingCount'>) {
  return Math.max(0, node.incomingCount) + Math.max(0, node.outgoingCount);
}

function baseNodeRadius(node: NodeDegree) {
  const degree = Math.sqrt(connectionCount(node));
  return node.type === 'persona-anchor'
    ? Math.min(30, 16 + degree * 2)
    : Math.min(24, 6 + degree * 2);
}

export function neuralPersonaGraphNodeVisualRadius(node: NodeDegree, selected = false) {
  return Math.min(34, baseNodeRadius(node) + (selected ? 4 : 0));
}

export function neuralPersonaGraphNodeHitRadius(node: NodeDegree) {
  const radius = neuralPersonaGraphNodeVisualRadius(node);
  return radius + (node.type === 'persona-anchor' ? 10 : 7);
}

function truncateNodeText(value: string, maxCharacters: number) {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maxCharacters) return normalized;
  return `${normalized.slice(0, Math.max(1, maxCharacters - 1))}…`;
}

function compactTagLabel(tagIds: readonly string[] = []) {
  return tagIds.slice(0, 3).map((tagId) => tagId.split(':').pop()?.trim())
    .filter(Boolean).map((tagId) => `#${tagId}`).join(' ');
}

export function neuralPersonaGraphNodeInnerFontSize(node: NodeDegree, selected = false) {
  const style = resolveNeuralPersonaGraphNodeVisualStyle(node, selected);
  return Math.max(5, Math.min(style.labelFontSize, style.radius * 0.42));
}

export function neuralPersonaGraphNodeInnerText(node: NodeDegree, selected = false) {
  const style = resolveNeuralPersonaGraphNodeVisualStyle(node, selected);
  const fontSize = neuralPersonaGraphNodeInnerFontSize(node, selected);
  const maxCharacters = Math.max(2, Math.floor((style.radius * 1.65) / fontSize));
  const label = truncateNodeText(node.label ?? node.type, maxCharacters);
  const tag = compactTagLabel(node.tagIds);
  if (style.radius < 14 || !tag) return label;
  return `${label}\n${truncateNodeText(tag, maxCharacters)}`;
}

export function resolveNeuralPersonaGraphNodeVisualStyle(
  node: NodeDegree,
  selected: boolean,
) {
  const anchor = node.type === 'persona-anchor';
  const radius = neuralPersonaGraphNodeVisualRadius(node, selected);
  return {
    defaultStroke: anchor ? 0xffa3ec : 0x0f172a,
    fillAlpha: anchor ? (node.status === 'active' ? 1 : 0.72)
      : (node.status === 'active' ? 0.95 : 0.45),
    fillColor: NODE_COLORS[node.type] ?? 0x94a3b8,
    haloAlpha: anchor ? (node.status === 'active' ? 0.24 : 0.14) : 0,
    haloColor: 0xff7be5,
    haloRadius: anchor ? radius + 7 : radius,
    labelColor: anchor ? 0xffd6f6 : 0xe5e7eb,
    labelFontSize: anchor ? 10 : 9,
    radius,
  };
}
