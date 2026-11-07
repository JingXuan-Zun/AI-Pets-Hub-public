// Relationship candidates are decided by the character they are about (user, 2026-11-06): group
// chat notices "A seems to trust B more"; A reads it against her own persona and accepts or
// declines. Nobody has to work through an approval queue in settings.

import type { DirectedRelationshipCandidate } from '../character-relationship';

const DIMENSION_LABELS: Record<keyof DirectedRelationshipCandidate['deltas'], string> = {
  intimacy: '亲近',
  trust: '信任',
  vigilance: '戒备',
};

function describeDeltas(deltas: DirectedRelationshipCandidate['deltas']) {
  return (Object.keys(DIMENSION_LABELS) as (keyof typeof DIMENSION_LABELS)[])
    .filter((key) => Math.abs(deltas[key]) >= 0.005)
    .map((key) => `${DIMENSION_LABELS[key]}${deltas[key] > 0 ? '多了一些' : '少了一些'}`)
    .join('、') || '有一点变化';
}

export function buildRelationshipDecisionPrompt(options: {
  candidate: DirectedRelationshipCandidate;
  name: string;
  persona: string;
}) {
  const { candidate } = options;
  const systemInstruction = [
    `你是${options.name}。下面是你的人设，按它来判断，不要跳出角色。`,
    '只输出一个 JSON：{"accept": true 或 false, "why": "一句话，用你自己的口吻"}。',
    '人设里写明的关系和感情永远优先；和人设矛盾的变化一律不接受。',
    '',
    options.persona,
  ].join('\n');
  const payload = [
    `最近群聊里，看起来你对${candidate.targetRoleName}的感觉变了：${describeDeltas(candidate.deltas)}。`,
    candidate.reason ? `理由：${candidate.reason}` : '',
    candidate.evidenceExcerpt ? `当时的话：${candidate.evidenceExcerpt}` : '',
    `这符合你的性格，也符合你和${candidate.targetRoleName}的关系吗？`,
  ].filter(Boolean).join('\n');
  return { payload, systemInstruction };
}

export function parseRelationshipDecision(text: string): { accept: boolean; why: string } | null {
  const match = text.match(/\{[\s\S]*\}/u);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { accept?: unknown; why?: unknown };
    if (typeof parsed.accept !== 'boolean') return null;
    return { accept: parsed.accept, why: typeof parsed.why === 'string' ? parsed.why.trim().slice(0, 120) : '' };
  } catch {
    return null;
  }
}

/** Candidates waiting for a decision: the rules let them through but nobody decided yet. */
export function pendingRelationshipCandidates(candidates: DirectedRelationshipCandidate[]) {
  return candidates
    .filter((candidate) => candidate.status === 'pending')
    .sort((left, right) => left.createdAt - right.createdAt);
}
