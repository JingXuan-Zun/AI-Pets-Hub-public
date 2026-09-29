import type {
  GroupTopicLifecycleInput,
  GroupTopicStatus,
  GroupTopicTransitionAuditEntry,
  GroupTopicTransitionSource,
} from './topicLifecycle';

const MAX_TOPIC_AUDIT_ENTRIES = 200;

export type GroupTopicTransitionContext = {
  reason: string;
  source: GroupTopicTransitionSource;
};

export function inferGroupTopicTransitionContext(
  input: GroupTopicLifecycleInput,
): GroupTopicTransitionContext {
  if (input.hasNewUserInput || input.userRequestedTopicChange) {
    return { reason: input.hasNewUserInput ? 'new-user-input' : 'user-topic-change', source: 'user-input' };
  }
  if (input.repeatedReplyCount !== undefined) {
    return {
      reason: input.repeatedReplyCount >= 2 ? 'repeated-role-replies' : 'role-turn-progress',
      source: 'role-signal',
    };
  }
  if (input.waitingForInformation) return { reason: 'waiting-for-task-information', source: 'task' };
  if (input.hasNewInformation) return { reason: 'new-task-or-role-information', source: 'task' };
  if (input.hasDisagreement) return { reason: 'role-disagreement', source: 'role-signal' };
  if (input.hasStageConclusion) return { reason: 'role-stage-conclusion', source: 'role-signal' };
  if (input.shouldArchive) return { reason: 'archive-requested', source: 'user-input' };
  if (input.shouldDecay) return { reason: 'inactivity-threshold', source: 'inactivity' };
  return { reason: 'role-turn-progress', source: 'role-signal' };
}

export function appendGroupTopicTransitionAudit(options: {
  auditTrail: GroupTopicTransitionAuditEntry[];
  context: GroupTopicTransitionContext;
  fromStatus: GroupTopicStatus | null;
  now: number;
  toStatus: GroupTopicStatus;
  topicId: string | null;
}) {
  if (!options.topicId || options.fromStatus === options.toStatus) return options.auditTrail;
  return [...options.auditTrail, {
    fromStatus: options.fromStatus,
    reason: options.context.reason,
    recordedAt: options.now,
    source: options.context.source,
    toStatus: options.toStatus,
    topicId: options.topicId,
  }].slice(-MAX_TOPIC_AUDIT_ENTRIES);
}
