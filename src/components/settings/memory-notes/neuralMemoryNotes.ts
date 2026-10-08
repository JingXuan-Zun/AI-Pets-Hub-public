import {
  isNeuralPersonaStructuralNode,
  type NeuralPersonaEdge,
  type NeuralPersonaEdgeType,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
  type NeuralPersonaNodeType,
} from '../../../character-graph/neural-persona';
import { isNeuralMemoryStagedNode } from '../../../neural-memory/neuralMemoryStaging';

export const MEMORY_NOTE_TYPE_LABELS: Partial<Record<NeuralPersonaNodeType, string>> = {
  'belief-or-viewpoint': '观点', 'concern-or-risk': '担忧', 'desire-or-goal': '目标',
  'emotional-tendency': '情绪记忆', experience: '经历', 'identity-reference': '身份',
  'knowledge-reference': '知识', 'memory-reference': '记忆引用', preference: '偏好',
  'relationship-influence': '关系', 'style-tendency': '表达风格',
  'temporary-cognitive-state': '临时状态', 'world-state-reference': '世界状态',
};
/** Types a memory can be switched to; reference types need a source and stay display-only. */
export const MEMORY_NOTE_TYPES: NeuralPersonaNodeType[] = [
  'experience', 'preference', 'relationship-influence', 'emotional-tendency',
  'belief-or-viewpoint', 'desire-or-goal', 'concern-or-risk', 'style-tendency',
];

export const MEMORY_LINK_RELATIONS: Array<[NeuralPersonaEdgeType, string]> = [
  ['associated-with', '相关'], ['reminds-of', '让我想起'], ['supports', '支持'],
  ['triggers', '触发'], ['inhibits', '抑制'], ['opposes', '冲突'],
];

export function memoryLinkRelationLabel(type: NeuralPersonaEdgeType) {
  return MEMORY_LINK_RELATIONS.find(([value]) => value === type)?.[1] ?? type;
}

export function memoryTypeLabel(type: NeuralPersonaNodeType) {
  return MEMORY_NOTE_TYPE_LABELS[type] ?? type;
}

/** Memories are every content node; structural hierarchy and the persona anchor stay hidden. */
export function memoryNotes(graph: NeuralPersonaGraphSnapshot) {
  return graph.nodes.filter((node) => node.status !== 'deleted'
    && !isNeuralPersonaStructuralNode(node) && node.type !== 'persona-anchor');
}

export function memoryNoteTitle(node: NeuralPersonaNode, maxLength = 24) {
  const value = node.influenceSummary.replace(/\s+/gu, ' ').trim() || '未命名记忆';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export interface MemoryNoteGroup {
  key: string;
  label: string;
  notes: NeuralPersonaNode[];
  staged: boolean;
}

export function groupMemoryNotes(notes: NeuralPersonaNode[], query: string): MemoryNoteGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? notes.filter((node) => `${node.influenceSummary} ${node.tags.map((tag) => tag.label).join(' ')}`
      .toLocaleLowerCase().includes(needle))
    : notes;
  const byNewest = (left: NeuralPersonaNode, right: NeuralPersonaNode) => right.updatedAt - left.updatedAt;
  const staged = matches.filter(isNeuralMemoryStagedNode).sort(byNewest);
  const groups: MemoryNoteGroup[] = staged.length
    ? [{ key: 'staged', label: '暂存', notes: staged, staged: true }] : [];
  const rest = matches.filter((node) => !isNeuralMemoryStagedNode(node));
  const types = [...new Set(rest.map((node) => node.type))]
    .sort((left, right) => MEMORY_NOTE_TYPES.indexOf(left) - MEMORY_NOTE_TYPES.indexOf(right));
  types.forEach((type) => groups.push({
    key: type, label: memoryTypeLabel(type), staged: false,
    notes: rest.filter((node) => node.type === type).sort(byNewest),
  }));
  return groups;
}

export interface MemoryNoteLink {
  direction: 'incoming' | 'outgoing';
  edge: NeuralPersonaEdge;
  other: NeuralPersonaNode;
}

export function memoryNoteLinks(graph: NeuralPersonaGraphSnapshot, nodeId: string): MemoryNoteLink[] {
  const notes = new Map(memoryNotes(graph).map((node) => [node.nodeId, node]));
  return graph.edges.flatMap((edge): MemoryNoteLink[] => {
    if (edge.relationType === 'contains') return [];
    if (edge.sourceNodeId === nodeId && notes.has(edge.targetNodeId)) {
      return [{ direction: 'outgoing', edge, other: notes.get(edge.targetNodeId)! }];
    }
    if (edge.targetNodeId === nodeId && notes.has(edge.sourceNodeId)) {
      return [{ direction: 'incoming', edge, other: notes.get(edge.sourceNodeId)! }];
    }
    return [];
  });
}

export interface MemoryContentSegment {
  link?: MemoryNoteLink;
  text: string;
}

/** Splits content so every linked anchor (first occurrence, longest first) renders in color. */
export function memoryContentSegments(content: string, links: MemoryNoteLink[]): MemoryContentSegment[] {
  const anchored = links
    .filter((link) => link.direction === 'outgoing' && link.edge.anchorText?.trim())
    .sort((left, right) => (right.edge.anchorText!.length - left.edge.anchorText!.length));
  const ranges: Array<{ end: number; link: MemoryNoteLink; start: number }> = [];
  anchored.forEach((link) => {
    const text = link.edge.anchorText!;
    let from = 0;
    while (from <= content.length) {
      const start = content.indexOf(text, from);
      if (start < 0) return;
      const end = start + text.length;
      if (!ranges.some((range) => start < range.end && end > range.start)) {
        ranges.push({ end, link, start });
        return;
      }
      from = start + 1;
    }
  });
  ranges.sort((left, right) => left.start - right.start);
  const segments: MemoryContentSegment[] = [];
  let cursor = 0;
  ranges.forEach((range) => {
    if (range.start > cursor) segments.push({ text: content.slice(cursor, range.start) });
    segments.push({ link: range.link, text: content.slice(range.start, range.end) });
    cursor = range.end;
  });
  if (cursor < content.length) segments.push({ text: content.slice(cursor) });
  return segments;
}
