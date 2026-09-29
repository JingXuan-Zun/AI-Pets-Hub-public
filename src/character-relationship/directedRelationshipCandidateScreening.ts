import type {
  DirectedRelationshipDimensions,
  DirectedRelationshipScreeningDecision,
  DirectedRelationshipScreeningReason,
} from './directedRelationshipTypes';

const QUESTION_PATTERN = /(?:[?？]\s*$|^(?:谁|什么|哪里|为何|为什么|怎么|是否|能否|可以吗|what|who|where|why|how|can|could|is|are)\b)/iu;
const TRANSIENT_PATTERN = /(?:随便说说|开玩笑|测试消息|临时记录|暂时记一下|just kidding|test message|temporary note)/iu;

export type DirectedRelationshipCandidateScreeningInput = {
  activeRoleIds: string[];
  deltas: DirectedRelationshipDimensions;
  evidenceExcerpt: string;
  sourceRoleId: string;
  targetRoleId: string;
};

export type DirectedRelationshipCandidateScreeningResult = {
  decision: DirectedRelationshipScreeningDecision;
  reasons: DirectedRelationshipScreeningReason[];
};

function blockedReason(input: DirectedRelationshipCandidateScreeningInput) {
  if (input.sourceRoleId === input.targetRoleId) return 'self-relationship' as const;
  if (!input.activeRoleIds.includes(input.targetRoleId)) return 'target-not-active' as const;
  const evidence = input.evidenceExcerpt.trim();
  if (!evidence) return 'empty-evidence' as const;
  if (QUESTION_PATTERN.test(evidence)) return 'question-like' as const;
  if (TRANSIENT_PATTERN.test(evidence)) return 'transient-language' as const;
  if (!input.deltas.intimacy && !input.deltas.trust && !input.deltas.vigilance) {
    return 'no-dimension-change' as const;
  }
  return null;
}

export function evaluateDirectedRelationshipCandidate(
  input: DirectedRelationshipCandidateScreeningInput,
): DirectedRelationshipCandidateScreeningResult {
  const reason = blockedReason(input);
  return reason
    ? { decision: 'blocked', reasons: [reason] }
    : { decision: 'manual-review', reasons: ['valid-change-requires-review'] };
}
