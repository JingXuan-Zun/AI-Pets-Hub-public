import type { GroupMemoryRepositoryData, StoredGroupMemoryRecord } from './groupMemoryTypes';

export type GroupMemoryIntegrityIssueKind =
  | 'self-reference'
  | 'missing-target'
  | 'cross-group-target'
  | 'target-still-active'
  | 'cycle';

export interface GroupMemoryIntegrityIssue {
  id: string;
  kind: GroupMemoryIntegrityIssueKind;
  recordIds: string[];
}

function issue(kind: GroupMemoryIntegrityIssueKind, recordIds: string[]) {
  return { id: `group-memory-integrity-${kind}-${recordIds.join('-')}`, kind, recordIds };
}

function validateLink(record: StoredGroupMemoryRecord, recordsById: Map<string, StoredGroupMemoryRecord>) {
  if (!record.supersedesId) return [];
  if (record.supersedesId === record.id) return [issue('self-reference', [record.id])];
  const target = recordsById.get(record.supersedesId);
  if (!target) return [issue('missing-target', [record.id, record.supersedesId])];
  const issues: GroupMemoryIntegrityIssue[] = [];
  if (target.groupId !== record.groupId) issues.push(issue('cross-group-target', [record.id, target.id]));
  if (target.invalidatedAt === undefined) issues.push(issue('target-still-active', [record.id, target.id]));
  return issues;
}

function findCycle(
  start: StoredGroupMemoryRecord,
  recordsById: Map<string, StoredGroupMemoryRecord>,
) {
  const path: string[] = [];
  const positions = new Map<string, number>();
  let current: StoredGroupMemoryRecord | undefined = start;
  while (current?.supersedesId) {
    const currentPosition = positions.get(current.id);
    if (currentPosition !== undefined) return path.slice(currentPosition).sort();
    positions.set(current.id, path.length);
    path.push(current.id);
    current = recordsById.get(current.supersedesId);
  }
  return [];
}

export function validateGroupMemoryIntegrity(repository: GroupMemoryRepositoryData) {
  const recordsById = new Map(repository.records.map((record) => [record.id, record]));
  const issues = repository.records.flatMap((record) => validateLink(record, recordsById));
  const cycleKeys = new Set<string>();
  repository.records.forEach((record) => {
    const cycleIds = findCycle(record, recordsById);
    const key = cycleIds.join('|');
    if (key && !cycleKeys.has(key)) {
      cycleKeys.add(key);
      issues.push(issue('cycle', cycleIds));
    }
  });
  return issues;
}
