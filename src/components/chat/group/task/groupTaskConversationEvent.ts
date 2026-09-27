import type { GroupTaskResultReceipt } from './groupTaskResultReceipt';
import type { ChatGroupTaskEvent } from '../../../../types';

export type GroupTaskConversationEvent = ChatGroupTaskEvent;

export function createGroupTaskConversationEvent(options: {
  receipt: GroupTaskResultReceipt;
  verified: boolean;
}): GroupTaskConversationEvent {
  const { receipt } = options;
  const type = receipt.outcome === 'pending-approval'
    ? 'task-pending-approval'
    : (receipt.outcome === 'completed' && options.verified ? 'task-completed' : 'task-failed');
  return {
    type,
    groupSessionId: receipt.groupSessionId,
    topicId: receipt.topicId,
    taskId: receipt.taskId,
    factualSummary: receipt.summary,
    ...(receipt.collaborationPlan ? { collaborationPlan: receipt.collaborationPlan } : {}),
    requestedCapability: receipt.candidateRequestedCapability,
    sourceRoleIds: [...receipt.sourceRoleIds],
    summary: receipt.summary,
  };
}

export function updateGroupTaskConversationEvent(options: {
  event?: GroupTaskConversationEvent | null;
  outcome: 'completed' | 'pending-approval' | 'failed';
  summary: string;
}): GroupTaskConversationEvent | null {
  if (!options.event) {
    return null;
  }
  return {
    ...options.event,
    type: options.outcome === 'completed'
      ? 'task-completed'
      : options.outcome === 'pending-approval' ? 'task-pending-approval' : 'task-failed',
    factualSummary: options.summary,
  };
}
