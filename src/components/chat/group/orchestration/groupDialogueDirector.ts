import type { ChatMessage } from '../../../../types';
import type { GroupAttentionCandidate } from '../attention/attentionPolicy';
import type { GroupSessionRecord } from '../state/groupSessionRecord';
import type { GroupTopicStatus } from '../topic/topicLifecycle';
import type { GroupConversationProgress } from '../topic/groupConversationProgressPolicy';

export type GroupDialogueAction =
  | 'answer-user'
  | 'continue-topic'
  | 'ask-user'
  | 'summarize-topic'
  | 'wait-task'
  | 'close-topic';

export type GroupDialogueDecision = {
  action: GroupDialogueAction;
  candidateRoleIds: string[];
  reason: string;
};

function resolveTopicAction(status: GroupTopicStatus | null): GroupDialogueAction | null {
  if (status === 'waiting-information') return 'ask-user';
  if (status === 'resolving' || status === 'concluded') return 'summarize-topic';
  if (status === 'closed' || status === 'archived' || status === 'decaying') return 'close-topic';
  return null;
}

function latestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => (
    message.role === 'user' && message.chatMode === 'group'
  ));
}

function userTopicIsCurrent(record: GroupSessionRecord, messages: ChatMessage[]) {
  const state = record.groupUserTopicState;
  return Boolean(state && state.adoptionState !== 'completed'
    && latestUserMessage(messages)?.id === state.sourceMessageId);
}

function resolveCandidates(
  candidates: GroupAttentionCandidate[],
  preferredRoleIds: string[],
) {
  if (preferredRoleIds.length === 0) return candidates.map((candidate) => candidate.roleId);
  const candidateIds = new Set(candidates.map((candidate) => candidate.roleId));
  return preferredRoleIds.filter((roleId) => candidateIds.has(roleId));
}

export function planGroupDialogueTurn(options: {
  attentionCandidates: GroupAttentionCandidate[];
  progress?: GroupConversationProgress;
  messages: ChatMessage[];
  record: GroupSessionRecord;
}): GroupDialogueDecision {
  const { attentionCandidates, messages, progress, record } = options;
  if (record.pendingTaskId) {
    return { action: 'wait-task', candidateRoleIds: [], reason: 'group-task-pending' };
  }
  const userTopic = record.groupUserTopicState;
  if (userTopicIsCurrent(record, messages) && userTopic?.remainingRoleIds.length) {
    return {
      action: 'answer-user',
      candidateRoleIds: resolveCandidates(attentionCandidates, userTopic.remainingRoleIds),
      reason: 'unanswered-user-topic',
    };
  }
  if (progress?.action === 'ask-user') {
    return { action: 'ask-user', candidateRoleIds: [], reason: progress.reason };
  }
  if (progress?.action === 'close') {
    return {
      action: 'summarize-topic',
      candidateRoleIds: attentionCandidates.slice(0, 1).map((candidate) => candidate.roleId),
      reason: progress.reason,
    };
  }
  const topicAction = resolveTopicAction(record.topicStatus);
  if (topicAction) {
    return { action: topicAction, candidateRoleIds: [], reason: `topic-${record.topicStatus}` };
  }
  return {
    action: 'continue-topic',
    candidateRoleIds: attentionCandidates.map((candidate) => candidate.roleId),
    reason: 'normal-group-continuation',
  };
}
