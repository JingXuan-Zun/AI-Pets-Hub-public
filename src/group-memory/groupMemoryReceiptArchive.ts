import type {
  GroupMemoryOperationKind,
  GroupMemoryOperationReceipt,
  GroupMemoryReceiptArchive,
} from './groupMemoryTypes';

export const MAX_ACTIVE_GROUP_MEMORY_RECEIPTS = 50;
const MAX_ARCHIVE_ENTRIES = 20;
const MAX_RECEIPTS_PER_ARCHIVE = 50;

function operationCounts(receipts: GroupMemoryOperationReceipt[]) {
  return receipts.reduce<Partial<Record<GroupMemoryOperationKind, number>>>((counts, receipt) => ({
    ...counts,
    [receipt.kind]: (counts[receipt.kind] ?? 0) + 1,
  }), {});
}

function createArchive(
  receipts: GroupMemoryOperationReceipt[],
  archivedAt: number,
): GroupMemoryReceiptArchive {
  const first = receipts[0]!;
  const last = receipts.at(-1)!;
  return {
    archivedAt,
    count: receipts.length,
    firstOccurredAt: first.occurredAt,
    firstReceiptId: first.id,
    id: `group-memory-archive-${first.id}`,
    lastOccurredAt: last.occurredAt,
    lastReceiptId: last.id,
    operationCounts: operationCounts(receipts),
  };
}

function mergeArchive(
  archive: GroupMemoryReceiptArchive,
  receipts: GroupMemoryOperationReceipt[],
  archivedAt: number,
) {
  const nextCounts = operationCounts(receipts);
  const last = receipts.at(-1)!;
  return {
    ...archive,
    archivedAt,
    count: archive.count + receipts.length,
    lastOccurredAt: last.occurredAt,
    lastReceiptId: last.id,
    operationCounts: Object.fromEntries(
      Object.keys({ ...archive.operationCounts, ...nextCounts }).map((kind) => [
        kind,
        (archive.operationCounts[kind as GroupMemoryOperationKind] ?? 0)
          + (nextCounts[kind as GroupMemoryOperationKind] ?? 0),
      ]),
    ),
  };
}

export function archiveGroupMemoryReceipts(
  archives: GroupMemoryReceiptArchive[],
  receipts: GroupMemoryOperationReceipt[],
  archivedAt: number,
) {
  if (!receipts.length) return archives;
  let nextArchives = [...archives];
  let pendingReceipts = [...receipts];
  while (pendingReceipts.length) {
    const lastArchive = nextArchives.at(-1);
    const availableSpace = lastArchive
      ? Math.max(0, MAX_RECEIPTS_PER_ARCHIVE - lastArchive.count) : 0;
    if (lastArchive && availableSpace > 0) {
      const mergeReceipts = pendingReceipts.slice(0, availableSpace);
      nextArchives = [
        ...nextArchives.slice(0, -1), mergeArchive(lastArchive, mergeReceipts, archivedAt),
      ];
      pendingReceipts = pendingReceipts.slice(mergeReceipts.length);
    } else {
      const archiveReceipts = pendingReceipts.slice(0, MAX_RECEIPTS_PER_ARCHIVE);
      nextArchives.push(createArchive(archiveReceipts, archivedAt));
      pendingReceipts = pendingReceipts.slice(archiveReceipts.length);
    }
  }
  return nextArchives.slice(-MAX_ARCHIVE_ENTRIES);
}
