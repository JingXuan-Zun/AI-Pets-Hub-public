import type { ChatMessage } from '../../../../types';
import type { GroupMemoryCandidate } from '../../../../group-memory';
import {
  createManualGroupMemoryRecord,
  toStoredGroupMemoryRecord,
} from './groupMemoryRecord';

const GROUP_MEMORY_CANDIDATE_EVIDENCE_LIMIT = 500;

function limitEvidenceExcerpt(value: string) {
  const excerpt = value.replace(/\s+/gu, ' ').trim();
  return excerpt.length <= GROUP_MEMORY_CANDIDATE_EVIDENCE_LIMIT
    ? excerpt : `${excerpt.slice(0, GROUP_MEMORY_CANDIDATE_EVIDENCE_LIMIT - 1)}…`;
}

export function createManualGroupMemoryCandidate(
  message: ChatMessage,
): GroupMemoryCandidate | null {
  const record = createManualGroupMemoryRecord(message);
  const proposedRecord = record ? toStoredGroupMemoryRecord(record) : null;
  if (!record || !proposedRecord) return null;
  const sourceMessageId = message.id ?? `message-${record.createdAt}`;
  const excerpt = limitEvidenceExcerpt(message.groupTaskEvent?.type === 'task-completed'
    ? message.groupTaskEvent.factualSummary.trim()
    : message.text.trim());
  if (!excerpt) return null;
  return {
    createdAt: record.createdAt,
    evidence: {
      capturedAt: record.createdAt,
      excerpt,
      kind: message.groupTaskEvent?.type === 'task-completed' ? 'task-result' : 'chat-message',
      sourceMessageId,
      sourceRoleId: record.sourceRoleId,
      topicId: record.topicId,
    },
    id: `group-memory-candidate-${sourceMessageId}`,
    proposedRecord,
    status: 'pending',
  };
}
