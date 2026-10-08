import type { NeuralPersonaNodeType } from '../character-graph/neural-persona';

/** Memory kinds a character may propose; all map onto neural persona node types. */
export const NEURAL_MEMORY_PROPOSAL_TYPES = [
  'experience',
  'preference',
  'relationship-influence',
  'emotional-tendency',
  'belief-or-viewpoint',
  'desire-or-goal',
  'concern-or-risk',
] as const satisfies readonly NeuralPersonaNodeType[];

export type NeuralMemoryProposalType = typeof NEURAL_MEMORY_PROPOSAL_TYPES[number];

export const NEURAL_MEMORY_PROPOSAL_TYPE_LABELS: Record<NeuralMemoryProposalType, string> = {
  'belief-or-viewpoint': '观点',
  'concern-or-risk': '担忧',
  'desire-or-goal': '目标',
  'emotional-tendency': '情绪记忆',
  experience: '经历',
  preference: '偏好',
  'relationship-influence': '关系',
};

/** A memory the character wants to keep, waiting for the user's approval. */
export interface NeuralMemoryProposal {
  content: string;
  createdAt: number;
  id: string;
  reason: string;
  roleId: string;
  sourceExcerpt: string;
  sourceMessageIds: string[];
  type: NeuralMemoryProposalType;
}

export const NEURAL_MEMORY_PROPOSAL_MAX_CONTENT_LENGTH = 160;
// Pending proposals per role; older ones drop off so the sidebar stays reviewable.
export const NEURAL_MEMORY_PROPOSAL_MAX_PENDING_PER_ROLE = 8;

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, maxLength) : '';
}

export function isNeuralMemoryProposalType(value: unknown): value is NeuralMemoryProposalType {
  return NEURAL_MEMORY_PROPOSAL_TYPES.includes(value as NeuralMemoryProposalType);
}

function normalizeProposal(value: unknown): NeuralMemoryProposal | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const id = text(item.id, 128);
  const roleId = text(item.roleId, 256);
  const content = text(item.content, NEURAL_MEMORY_PROPOSAL_MAX_CONTENT_LENGTH);
  if (!id || !roleId || !content) return null;
  return {
    content,
    createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : 0,
    id,
    reason: text(item.reason, 200),
    roleId,
    sourceExcerpt: text(item.sourceExcerpt, 240),
    sourceMessageIds: Array.isArray(item.sourceMessageIds)
      ? item.sourceMessageIds.filter((entry): entry is string => typeof entry === 'string').slice(0, 8)
      : [],
    type: isNeuralMemoryProposalType(item.type) ? item.type : 'experience',
  };
}

export function normalizeNeuralMemoryProposals(value: unknown): NeuralMemoryProposal[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.map(normalizeProposal).filter((proposal): proposal is NeuralMemoryProposal => {
    if (!proposal || seen.has(proposal.id)) return false;
    seen.add(proposal.id);
    return true;
  });
}

export function normalizedMemoryText(value: string) {
  return value.normalize('NFKC').replace(/[\s，。！？、,.!?；;：:"'“”‘’（）()]+/gu, '').toLocaleLowerCase();
}
