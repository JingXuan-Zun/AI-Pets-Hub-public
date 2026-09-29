import type { ChatMessage } from '../../../../types';
import {
  enqueueGroupMemoryCandidate,
  evaluateGroupMemoryCandidateEvidence,
  type GroupMemoryCandidate,
  type GroupMemoryRepositoryData,
} from '../../../../group-memory';
import { createManualGroupMemoryCandidate } from './groupMemoryCandidate';

export function createAutomaticGroupTaskMemoryCandidate(
  message: ChatMessage,
): GroupMemoryCandidate | null {
  if (!message.id || message.groupTaskEvent?.type !== 'task-completed') {
    return null;
  }
  if (!message.groupTaskEvent.factualSummary.trim()) {
    return null;
  }
  const candidate = createManualGroupMemoryCandidate(message);
  if (!candidate) return null;
  return evaluateGroupMemoryCandidateEvidence(candidate).decision === 'eligible'
    ? candidate
    : null;
}

export function getCompletedGroupTaskMessageKey(message: ChatMessage) {
  const event = message.groupTaskEvent;
  if (!message.id || event?.type !== 'task-completed') return null;
  return `${message.id}:${event.taskId}:${event.factualSummary}`;
}

export function captureAutomaticGroupTaskMemoryCandidates(options: {
  messages: ChatMessage[];
  observedKeys: Set<string>;
  repository: GroupMemoryRepositoryData;
}) {
  let repository = options.repository;
  let latestCandidate: GroupMemoryCandidate | null = null;
  options.messages.forEach((message) => {
    const key = getCompletedGroupTaskMessageKey(message);
    if (!key || options.observedKeys.has(key)) return;
    options.observedKeys.add(key);
    const candidate = createAutomaticGroupTaskMemoryCandidate(message);
    if (!candidate || repository.candidates.some((item) => item.id === candidate.id)) return;
    repository = enqueueGroupMemoryCandidate(repository, candidate);
    latestCandidate = candidate;
  });
  return { latestCandidate, repository };
}
