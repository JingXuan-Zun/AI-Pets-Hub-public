import type { GroupMemoryCandidate } from './groupMemoryTypes';

export type GroupMemoryCandidateScreeningDecision = 'eligible' | 'manual-review' | 'blocked';
export type GroupMemoryCandidateScreeningReason =
  | 'verified-task-result'
  | 'candidate-invalidated'
  | 'evidence-source-mismatch'
  | 'evidence-topic-mismatch'
  | 'empty-evidence'
  | 'question-like'
  | 'speculative-language'
  | 'transient-language'
  | 'unsupported-verified-fact'
  | 'role-perspective-requires-review'
  | 'discussion-requires-review';

export interface GroupMemoryCandidateScreeningResult {
  decision: GroupMemoryCandidateScreeningDecision;
  reasons: GroupMemoryCandidateScreeningReason[];
}

const SPECULATIVE_PATTERN = /(?:可能|也许|大概|猜测|我觉得|似乎|maybe|perhaps|probably|guess)/iu;
const TRANSIENT_PATTERN = /(?:随便说说|开玩笑|测试消息|临时记录|暂时记一下|just kidding|test message|temporary note)/iu;
const QUESTION_PATTERN = /(?:[?？]\s*$|^(?:谁|什么|哪里|为何|为什么|怎么|是否|能否|可以吗|what|who|where|why|how|can|could|is|are)\b)/iu;

function structuralReason(candidate: GroupMemoryCandidate) {
  if (!candidate.evidence.excerpt.trim()) return 'empty-evidence' as const;
  if (candidate.proposedRecord.invalidatedAt !== undefined) return 'candidate-invalidated' as const;
  if (candidate.evidence.sourceRoleId !== candidate.proposedRecord.sourceRoleId) {
    return 'evidence-source-mismatch' as const;
  }
  if (candidate.evidence.topicId !== candidate.proposedRecord.topicId) {
    return 'evidence-topic-mismatch' as const;
  }
  return null;
}

function contentReason(candidate: GroupMemoryCandidate) {
  const text = candidate.evidence.excerpt;
  if (QUESTION_PATTERN.test(text)) return 'question-like' as const;
  if (SPECULATIVE_PATTERN.test(text)) return 'speculative-language' as const;
  if (TRANSIENT_PATTERN.test(text)) return 'transient-language' as const;
  return null;
}

export function evaluateGroupMemoryCandidateEvidence(
  candidate: GroupMemoryCandidate,
): GroupMemoryCandidateScreeningResult {
  const blockedReason = structuralReason(candidate) ?? contentReason(candidate);
  if (blockedReason) return { decision: 'blocked', reasons: [blockedReason] };
  if (candidate.evidence.kind === 'task-result') {
    const verified = candidate.proposedRecord.kind === 'verified-fact'
      && candidate.proposedRecord.confidence >= 0.8;
    return verified
      ? { decision: 'eligible', reasons: ['verified-task-result'] }
      : { decision: 'blocked', reasons: ['unsupported-verified-fact'] };
  }
  return candidate.proposedRecord.kind === 'role-perspective'
    ? { decision: 'manual-review', reasons: ['role-perspective-requires-review'] }
    : { decision: 'manual-review', reasons: ['discussion-requires-review'] };
}
