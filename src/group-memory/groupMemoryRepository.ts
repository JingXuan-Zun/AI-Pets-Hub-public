import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  type GroupMemoryOperationKind,
  type GroupMemoryOperationReceipt,
  type GroupMemoryReceiptArchive,
  type GroupMemoryRecordChange,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryRecord,
} from './groupMemoryTypes';
import {
  MAX_ACTIVE_GROUP_MEMORY_RECEIPTS,
  archiveGroupMemoryReceipts,
} from './groupMemoryReceiptArchive';
import {
  normalizeGroupMemoryCandidateReviewReceipts,
  normalizeGroupMemoryCandidates,
} from './groupMemoryCandidateNormalization';
import {
  archiveReviewedGroupMemoryCandidates,
  normalizeGroupMemoryCandidateArchives,
} from './groupMemoryCandidateArchive';
import {
  isObject,
  normalizeStoredGroupMemoryRecord,
  normalizeTimestamp,
} from './groupMemoryNormalizationUtils';
import {
  normalizeGroupMemorySubgroupAuditTrail,
  normalizeGroupMemorySubgroups,
  isWritableGroupMemoryGroup,
} from './groupMemorySubgroups';
import { normalizeGroupMemoryEvidenceScopeSnapshots } from './groupMemoryEvidenceScope';
import { normalizeGroupMemoryEvidenceScopeCorrections } from './groupMemoryEvidenceScopeCorrection';

const LEGACY_HEADER_PATTERN = /^\[群体记忆｜([^｜]+)｜id=([^｜]+)｜source=([^｜]+)｜topic=([^｜]+)｜confidence=([\d.]+)(?:｜createdAt=(\d+))?\]$/u;
const VALID_OPERATION_KINDS = new Set<GroupMemoryOperationKind>([
  'invalidate', 'move-group', 'restore', 'resolve-conflict', 'rollback',
]);
const MAX_ARCHIVES = 20;

function normalizeChange(value: unknown, now: number): GroupMemoryRecordChange | null {
  if (!isObject(value)) return null;
  const recordId = typeof value.recordId === 'string' ? value.recordId.trim() : '';
  if (!recordId) return null;
  const before = value.before === null ? null : normalizeStoredGroupMemoryRecord(value.before, now);
  const after = value.after === null ? null : normalizeStoredGroupMemoryRecord(value.after, now);
  if (!before && !after) return null;
  if ((before && before.id !== recordId) || (after && after.id !== recordId)) return null;
  return { after, before, recordId };
}

function normalizeReceipt(value: unknown, now: number): GroupMemoryOperationReceipt | null {
  if (!isObject(value) || !Array.isArray(value.changes)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const kind = VALID_OPERATION_KINDS.has(value.kind as GroupMemoryOperationKind)
    ? value.kind as GroupMemoryOperationKind : null;
  const changes = value.changes.map((change) => normalizeChange(change, now))
    .filter((change): change is GroupMemoryRecordChange => Boolean(change));
  if (!id || !kind || !changes.length) return null;
  return {
    changes, id, kind, occurredAt: normalizeTimestamp(value.occurredAt, now),
    ...(typeof value.revertsReceiptId === 'string' && value.revertsReceiptId.trim()
      ? { revertsReceiptId: value.revertsReceiptId.trim() } : {}),
  };
}

function normalizeArchive(value: unknown, now: number): GroupMemoryReceiptArchive | null {
  if (!isObject(value) || !isObject(value.operationCounts)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const firstReceiptId = typeof value.firstReceiptId === 'string' ? value.firstReceiptId.trim() : '';
  const lastReceiptId = typeof value.lastReceiptId === 'string' ? value.lastReceiptId.trim() : '';
  const count = Math.max(0, Math.floor(Number(value.count) || 0));
  if (!id || !firstReceiptId || !lastReceiptId || !count) return null;
  const operationCounts = Object.fromEntries([...VALID_OPERATION_KINDS].flatMap((kind) => {
    const operationCount = Math.max(0, Math.floor(Number(value.operationCounts?.[kind]) || 0));
    return operationCount > 0 ? [[kind, operationCount] as const] : [];
  }));
  return {
    archivedAt: normalizeTimestamp(value.archivedAt, now), count,
    firstOccurredAt: normalizeTimestamp(value.firstOccurredAt, now), firstReceiptId, id,
    lastOccurredAt: normalizeTimestamp(value.lastOccurredAt, now), lastReceiptId,
    operationCounts,
  };
}

function parseLegacyEntry(entry: string, now: number): StoredGroupMemoryRecord | null {
  const [header = '', ...summaryLines] = entry.trim().split('\n');
  const match = header.match(LEGACY_HEADER_PATTERN);
  if (!match) return null;
  const [, kind, id, sourceRoleId, topicId, confidence, createdAt] = match;
  return normalizeStoredGroupMemoryRecord({
    confidence, createdAt, groupId: CURRENT_GROUP_MEMORY_GROUP_ID, id, kind,
    sourceRoleId, summary: summaryLines.join(' '), topicId, visibility: 'group',
  }, now);
}

function dedupeRecords(records: StoredGroupMemoryRecord[]) {
  const byId = new Map<string, StoredGroupMemoryRecord>();
  records.forEach((record) => {
    const current = byId.get(record.id);
    if (!current || record.updatedAt >= current.updatedAt) byId.set(record.id, record);
  });
  return [...byId.values()].sort((left, right) => left.createdAt - right.createdAt);
}

function dedupeReceipts(receipts: GroupMemoryOperationReceipt[]) {
  const byId = new Map<string, GroupMemoryOperationReceipt>();
  receipts.forEach((receipt) => byId.set(receipt.id, receipt));
  return [...byId.values()];
}

export function parseLegacyGroupMemory(memory: string, now = Date.now()) {
  return memory.split(/\n{2,}/gu)
    .map((entry) => parseLegacyEntry(entry, now))
    .filter((record): record is StoredGroupMemoryRecord => Boolean(record));
}

export function stripLegacyGroupMemory(memory: string) {
  return memory.split(/\n{2,}/gu)
    .filter((entry) => !entry.trim().split('\n')[0]?.match(LEGACY_HEADER_PATTERN))
    .join('\n\n').trim();
}

function normalizeEvidenceScopes(value: unknown, now: number) {
  const evidenceScopeSnapshots = normalizeGroupMemoryEvidenceScopeSnapshots(
    isObject(value) ? value.evidenceScopeSnapshots : [], now,
  );
  const evidenceScopeCorrections = normalizeGroupMemoryEvidenceScopeCorrections(
    isObject(value) ? value.evidenceScopeCorrections : [], now,
  );
  return { evidenceScopeCorrections, evidenceScopeSnapshots };
}

export function normalizeGroupMemoryRepository(
  value: unknown,
  legacyMemories: string[] = [],
  now = Date.now(),
): GroupMemoryRepositoryData {
  const rawRecords = isObject(value) && Array.isArray(value.records) ? value.records : [];
  const storedRecords = rawRecords.map((record) => normalizeStoredGroupMemoryRecord(record, now))
    .filter((record): record is StoredGroupMemoryRecord => Boolean(record));
  const legacyRecords = legacyMemories.flatMap((memory) => parseLegacyGroupMemory(memory, now));
  const rawReceipts = isObject(value) && Array.isArray(value.receipts) ? value.receipts : [];
  const normalizedReceipts = rawReceipts.map((receipt) => normalizeReceipt(receipt, now))
    .filter((receipt): receipt is GroupMemoryOperationReceipt => Boolean(receipt));
  const dedupedReceipts = dedupeReceipts(normalizedReceipts);
  const overflowReceipts = dedupedReceipts.slice(0, -MAX_ACTIVE_GROUP_MEMORY_RECEIPTS);
  const receipts = dedupedReceipts.slice(-MAX_ACTIVE_GROUP_MEMORY_RECEIPTS);
  const rawArchives = isObject(value) && Array.isArray(value.receiptArchives)
    ? value.receiptArchives : [];
  const normalizedArchives = rawArchives.map((archive) => normalizeArchive(archive, now))
    .filter((archive): archive is GroupMemoryReceiptArchive => Boolean(archive))
    .slice(-MAX_ARCHIVES);
  const receiptArchives = archiveGroupMemoryReceipts(normalizedArchives, overflowReceipts, now);
  const candidates = normalizeGroupMemoryCandidates(isObject(value) ? value.candidates : [], now);
  const candidateReviewReceipts = normalizeGroupMemoryCandidateReviewReceipts(
    isObject(value) ? value.candidateReviewReceipts : [], now,
  );
  const candidateArchives = normalizeGroupMemoryCandidateArchives(
    isObject(value) ? value.candidateArchives : [], now,
  );
  const { evidenceScopeCorrections, evidenceScopeSnapshots } = normalizeEvidenceScopes(value, now);
  const subgroups = normalizeGroupMemorySubgroups(isObject(value) ? value.subgroups : [], now);
  const subgroupAuditTrail = normalizeGroupMemorySubgroupAuditTrail(
    isObject(value) ? value.subgroupAuditTrail : [], now,
  );
  return archiveReviewedGroupMemoryCandidates({
    ...EMPTY_GROUP_MEMORY_REPOSITORY,
    candidateArchives,
    candidateReviewReceipts,
    candidates,
    evidenceScopeCorrections,
    evidenceScopeSnapshots,
    receiptArchives,
    receipts,
    records: dedupeRecords([...storedRecords, ...legacyRecords]),
    subgroupAuditTrail,
    subgroups,
  }, now);
}

export function upsertGroupMemoryRecord(
  repository: GroupMemoryRepositoryData | null | undefined,
  record: StoredGroupMemoryRecord,
) {
  const currentRepository = normalizeGroupMemoryRepository(repository);
  if (!isWritableGroupMemoryGroup(currentRepository, record.groupId)) return currentRepository;
  const existing = currentRepository.records.find((item) => item.id === record.id);
  if (existing && existing.groupId !== record.groupId) return currentRepository;
  return normalizeGroupMemoryRepository({
    candidateArchives: currentRepository.candidateArchives,
    candidateReviewReceipts: currentRepository.candidateReviewReceipts,
    candidates: currentRepository.candidates,
    evidenceScopeCorrections: currentRepository.evidenceScopeCorrections,
    evidenceScopeSnapshots: currentRepository.evidenceScopeSnapshots,
    receiptArchives: currentRepository.receiptArchives,
    receipts: currentRepository.receipts,
    records: [...currentRepository.records, record],
    schemaVersion: 8,
    subgroupAuditTrail: currentRepository.subgroupAuditTrail,
    subgroups: currentRepository.subgroups,
  });
}
