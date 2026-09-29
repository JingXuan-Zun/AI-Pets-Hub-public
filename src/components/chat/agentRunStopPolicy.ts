import { desktopPetChatStore } from '../../chatStore';
import type { ChatMessage } from '../../types';
import {
  isStoppableAgentApprovalStatus,
  isStoppableAgentRunStatus,
} from './agentProgressMessageProjection';

export function findLatestStoppableAgentMessage(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.id) continue;
    if (message.agentApproval && isStoppableAgentApprovalStatus(message.agentApproval.status)) {
      return message;
    }
    if (message.agentRun && isStoppableAgentRunStatus(message.agentRun.status)) {
      return message;
    }
  }
  return null;
}

export function resolveAgentStopTarget(messages: ChatMessage[], messageId?: string | null) {
  return messageId
    ? messages.find((message) => message.id === messageId) ?? null
    : findLatestStoppableAgentMessage(messages);
}

export function isStoppedAgentRunMessage(messageId: string | null) {
  if (!messageId) return false;
  const message = desktopPetChatStore.getState().messages.find((item) => item.id === messageId);
  return message?.agentRun?.stoppedByUser === true
    || message?.agentApproval?.stoppedByUser === true;
}
