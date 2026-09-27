import type { ChatMessage } from '../../../../types';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  type StoredGroupMemoryRecord,
} from '../../../../group-memory';

export type GroupMemoryKind = 'discussion-summary' | 'role-perspective' | 'verified-fact';
export type GroupMemoryVisibility = 'group' | 'private';

export interface GroupMemoryRecord {
  confidence: number;
  createdAt: number;
  id: string;
  kind: GroupMemoryKind;
  ownerRoleId?: string;
  sourceRoleId: string;
  summary: string;
  topicId: string | null;
  visibility: GroupMemoryVisibility;
}

export interface GroupMemoryWriteDecision {
  accepted: boolean;
  reason: 'accepted' | 'empty-summary' | 'missing-owner' | 'private-scope-mismatch'
    | 'unverified-group-perspective' | 'low-fact-confidence';
}

const GROUP_MEMORY_SUMMARY_LIMIT = 240;

function normalizeSummary(text: string) {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= GROUP_MEMORY_SUMMARY_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, GROUP_MEMORY_SUMMARY_LIMIT - 1)}…`;
}

function resolveMemoryKind(message: ChatMessage): GroupMemoryKind {
  if (message.groupTaskEvent?.type === 'task-completed') {
    return 'verified-fact';
  }
  return message.role === 'model' ? 'role-perspective' : 'discussion-summary';
}

export function createManualGroupMemoryRecord(message: ChatMessage): GroupMemoryRecord | null {
  const sourceText = message.groupTaskEvent?.type === 'task-completed'
    ? message.groupTaskEvent.factualSummary
    : message.text;
  const summary = normalizeSummary(sourceText);
  if (!summary || message.chatMode !== 'group') {
    return null;
  }
  const createdAt = message.createdAt ?? Date.now();
  return {
    confidence: message.groupTaskEvent?.type === 'task-completed' ? 1 : 0.8,
    createdAt,
    id: `group-memory-${message.id ?? createdAt}`,
    kind: resolveMemoryKind(message),
    sourceRoleId: message.role === 'user' ? 'user' : (message.petId ?? 'primary'),
    summary,
    topicId: message.groupTaskEvent?.topicId ?? null,
    visibility: 'group',
  };
}

export function evaluateGroupMemoryWrite(options: {
  explicitUserSave: boolean;
  record: GroupMemoryRecord;
  targetRoleId?: string;
}): GroupMemoryWriteDecision {
  const { explicitUserSave, record, targetRoleId } = options;
  if (!record.summary.trim()) return { accepted: false, reason: 'empty-summary' };
  if (record.visibility === 'private' && !record.ownerRoleId) {
    return { accepted: false, reason: 'missing-owner' };
  }
  if (record.visibility === 'private' && targetRoleId !== record.ownerRoleId) {
    return { accepted: false, reason: 'private-scope-mismatch' };
  }
  if (record.kind === 'verified-fact' && record.confidence < 0.8) {
    return { accepted: false, reason: 'low-fact-confidence' };
  }
  if (record.visibility === 'group' && record.kind === 'role-perspective' && !explicitUserSave) {
    return { accepted: false, reason: 'unverified-group-perspective' };
  }
  return { accepted: true, reason: 'accepted' };
}

export function formatGroupMemoryRecord(record: GroupMemoryRecord) {
  const confidence = Math.max(0, Math.min(1, record.confidence)).toFixed(2);
  return [
    `[群体记忆｜${record.kind}｜id=${record.id}｜source=${record.sourceRoleId}｜topic=${record.topicId ?? 'none'}｜confidence=${confidence}｜createdAt=${record.createdAt}]`,
    record.summary,
  ].join('\n');
}

export function toStoredGroupMemoryRecord(
  record: GroupMemoryRecord,
  groupId = CURRENT_GROUP_MEMORY_GROUP_ID,
): StoredGroupMemoryRecord | null {
  if (record.visibility !== 'group') return null;
  return {
    confidence: record.confidence,
    createdAt: record.createdAt,
    groupId,
    id: record.id,
    kind: record.kind,
    sourceRoleId: record.sourceRoleId,
    summary: record.summary,
    topicId: record.topicId,
    updatedAt: record.createdAt,
    visibility: 'group',
  };
}
