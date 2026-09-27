import type {
  GroupSessionRecord,
  GroupTopicDerivationSuggestion,
} from '../state/groupSessionRecord';

export type GroupTopicDerivationDecision = {
  confirmedTopicId: string | null;
  nextSequence: number;
  suggestions: GroupTopicDerivationSuggestion[];
};

const REQUIRED_DISTINCT_ROLES = 2;

export function createDerivedGroupTopicId(groupSessionId: string, sequence: number) {
  return `${groupSessionId}:topic:${sequence}`;
}

export function resolveTopicDerivationSuggestion(options: {
  now?: number;
  record: GroupSessionRecord;
  roleId: string;
  turnId: string;
}): GroupTopicDerivationDecision {
  const { record } = options;
  const parentTopicId = record.currentTopicId;
  const roleId = options.roleId.trim();
  const turnId = options.turnId.trim();
  if (!parentTopicId || !roleId || !turnId || !record.activeRoleIds.includes(roleId)) {
    return {
      confirmedTopicId: null,
      nextSequence: record.topicDerivationSequence,
      suggestions: record.topicDerivationSuggestions,
    };
  }
  const currentSuggestions = record.topicDerivationSuggestions.filter(
    (item) => item.parentTopicId === parentTopicId,
  );
  const duplicate = currentSuggestions.some(
    (item) => item.roleId === roleId || item.turnId === turnId,
  );
  const suggestions = duplicate ? currentSuggestions : [...currentSuggestions, {
    parentTopicId, roleId, turnId, suggestedAt: options.now ?? Date.now(),
  }];
  if (new Set(suggestions.map((item) => item.roleId)).size < REQUIRED_DISTINCT_ROLES) {
    return { confirmedTopicId: null, nextSequence: record.topicDerivationSequence, suggestions };
  }
  const nextSequence = record.topicDerivationSequence + 1;
  return {
    confirmedTopicId: createDerivedGroupTopicId(record.groupSessionId, nextSequence),
    nextSequence,
    suggestions: [],
  };
}
