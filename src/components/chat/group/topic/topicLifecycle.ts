export type GroupTopicStatus =
  | 'starting'
  | 'active'
  | 'disputed'
  | 'waiting-information'
  | 'resolving'
  | 'concluded'
  | 'decaying'
  | 'closed'
  | 'archived';

export type GroupTopicHistoryEntry = {
  id: string;
  parentTopicId: string | null;
  recordedAt: number;
  status: GroupTopicStatus;
};

export type GroupTopicTransitionSource =
  | 'role-signal'
  | 'task'
  | 'inactivity'
  | 'user-input'
  | 'derivation';

export type GroupTopicTransitionAuditEntry = {
  fromStatus: GroupTopicStatus | null;
  reason: string;
  recordedAt: number;
  source: GroupTopicTransitionSource;
  toStatus: GroupTopicStatus;
  topicId: string;
};

export type GroupTopicLifecycleInput = {
  hasNewUserInput?: boolean;
  hasNewInformation?: boolean;
  hasDisagreement?: boolean;
  hasStageConclusion?: boolean;
  repeatedReplyCount?: number;
  shouldArchive?: boolean;
  shouldDecay?: boolean;
  startsDerivedTopic?: boolean;
  userRequestedTopicChange?: boolean;
  waitingForInformation?: boolean;
};

export function isGroupTopicTransitionAllowed(
  currentStatus: GroupTopicStatus,
  nextStatus: GroupTopicStatus,
) {
  if (currentStatus === 'archived') return nextStatus === 'starting';
  if (currentStatus === 'closed') {
    return nextStatus === 'archived' || nextStatus === 'starting';
  }
  return true;
}

export function resolveGroupTopicStatus(
  currentStatus: GroupTopicStatus | null,
  input: GroupTopicLifecycleInput,
): GroupTopicStatus {
  if (!currentStatus) return 'starting';
  if (input.startsDerivedTopic) return 'starting';
  if (currentStatus === 'archived') return 'archived';
  if (currentStatus === 'closed' && !input.shouldArchive) return 'closed';

  let nextStatus: GroupTopicStatus = currentStatus;
  if (input.hasNewUserInput) nextStatus = 'starting';
  else if (input.shouldArchive) nextStatus = 'archived';
  else if (input.userRequestedTopicChange) nextStatus = 'closed';
  else if (input.hasStageConclusion) nextStatus = 'concluded';
  else if (input.waitingForInformation) nextStatus = 'waiting-information';
  else if (input.hasDisagreement) nextStatus = 'disputed';
  else if (input.shouldDecay) nextStatus = 'decaying';
  else if (input.hasNewInformation && currentStatus !== 'starting') nextStatus = 'active';
  else if ((input.repeatedReplyCount ?? 0) >= 2 && !input.hasNewInformation) {
    nextStatus = 'resolving';
  } else if (currentStatus === 'starting') nextStatus = 'active';

  return isGroupTopicTransitionAllowed(currentStatus, nextStatus)
    ? nextStatus
    : currentStatus;
}

export function shouldContinueGroupTopic(status: GroupTopicStatus) {
  return status === 'starting' || status === 'active' || status === 'disputed';
}
