import type {
  GroupMemoryRepositoryData,
  GroupMemorySubgroupAuditEntry,
  GroupMemorySubgroupOperationKind,
  StoredGroupMemorySubgroup,
} from './groupMemoryTypes';
import { CURRENT_GROUP_MEMORY_GROUP_ID } from './groupMemoryTypes';
import { isObject, normalizeTimestamp } from './groupMemoryNormalizationUtils';

const MAX_SUBGROUPS = 20;
const MAX_SUBGROUP_AUDIT_ENTRIES = 100;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, maxLength) : '';
}

function cleanRoleIds(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map((item) => cleanText(item, 120)).filter(Boolean))];
}

export function normalizeGroupMemorySubgroup(value: unknown, now: number) {
  if (!isObject(value)) return null;
  const id = cleanText(value.id, 120);
  const name = cleanText(value.name, 80);
  const memberRoleIds = cleanRoleIds(value.memberRoleIds);
  if (!id || id === CURRENT_GROUP_MEMORY_GROUP_ID || !name || memberRoleIds.length < 2) return null;
  const createdAt = normalizeTimestamp(value.createdAt, now);
  return {
    createdAt, id, memberRoleIds, name,
    ...(value.invalidatedAt !== null && value.invalidatedAt !== undefined
      && Number.isFinite(Number(value.invalidatedAt))
      ? { invalidatedAt: Number(value.invalidatedAt) } : {}),
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  } satisfies StoredGroupMemorySubgroup;
}

export function normalizeGroupMemorySubgroups(value: unknown, now: number) {
  const values = Array.isArray(value) ? value : [];
  const byId = new Map<string, StoredGroupMemorySubgroup>();
  values.forEach((item) => {
    const subgroup = normalizeGroupMemorySubgroup(item, now);
    const previous = subgroup ? byId.get(subgroup.id) : null;
    if (subgroup && (!previous || subgroup.updatedAt >= previous.updatedAt)) byId.set(subgroup.id, subgroup);
  });
  return [...byId.values()].slice(-MAX_SUBGROUPS);
}

function normalizeAuditEntry(value: unknown, now: number): GroupMemorySubgroupAuditEntry | null {
  if (!isObject(value)) return null;
  const allowed = new Set<GroupMemorySubgroupOperationKind>([
    'create', 'invalidate', 'restore', 'update-members',
  ]);
  const id = cleanText(value.id, 240);
  const groupId = cleanText(value.groupId, 120);
  const kind = allowed.has(value.kind as GroupMemorySubgroupOperationKind)
    ? value.kind as GroupMemorySubgroupOperationKind : null;
  const before = value.before === null ? null : normalizeGroupMemorySubgroup(value.before, now);
  const after = value.after === null ? null : normalizeGroupMemorySubgroup(value.after, now);
  if (!id || !groupId || !kind || (!before && !after)) return null;
  return { after, before, groupId, id, kind, occurredAt: normalizeTimestamp(value.occurredAt, now) };
}

export function normalizeGroupMemorySubgroupAuditTrail(value: unknown, now: number) {
  const values = Array.isArray(value) ? value : [];
  return values.map((item) => normalizeAuditEntry(item, now))
    .filter((item): item is GroupMemorySubgroupAuditEntry => item !== null)
    .slice(-MAX_SUBGROUP_AUDIT_ENTRIES);
}

function commitSubgroup(repository: GroupMemoryRepositoryData, kind: GroupMemorySubgroupOperationKind,
  before: StoredGroupMemorySubgroup | null, after: StoredGroupMemorySubgroup, now: number) {
  const entry: GroupMemorySubgroupAuditEntry = {
    after, before, groupId: after.id, id: `group-memory-subgroup-${kind}-${now}-${after.id}`,
    kind, occurredAt: now,
  };
  return {
    ...repository,
    subgroupAuditTrail: [...repository.subgroupAuditTrail, entry].slice(-MAX_SUBGROUP_AUDIT_ENTRIES),
    subgroups: [...repository.subgroups.filter((item) => item.id !== after.id), after],
  };
}

export function createGroupMemorySubgroup(repository: GroupMemoryRepositoryData,
  input: { memberRoleIds: string[]; name: string }, now = Date.now()) {
  const memberRoleIds = cleanRoleIds(input.memberRoleIds);
  const name = cleanText(input.name, 80);
  if (!name || memberRoleIds.length < 2 || repository.subgroups.length >= MAX_SUBGROUPS) return repository;
  let id = `subgroup-${now}`;
  let suffix = 1;
  while (repository.subgroups.some((item) => item.id === id)) id = `subgroup-${now}-${suffix++}`;
  const subgroup = { createdAt: now, id, memberRoleIds, name, updatedAt: now };
  return commitSubgroup(repository, 'create', null, subgroup, now);
}

export function updateGroupMemorySubgroupMembers(repository: GroupMemoryRepositoryData,
  groupId: string, memberRoleIds: string[], now = Date.now()) {
  const before = repository.subgroups.find((item) => item.id === groupId);
  const members = cleanRoleIds(memberRoleIds);
  if (!before || before.invalidatedAt !== undefined || members.length < 2) return repository;
  if (members.join('|') === before.memberRoleIds.join('|')) return repository;
  return commitSubgroup(repository, 'update-members', before, {
    ...before, memberRoleIds: members, updatedAt: Math.max(before.updatedAt, now),
  }, now);
}

function setSubgroupInvalidated(repository: GroupMemoryRepositoryData, groupId: string,
  invalidated: boolean, now: number) {
  const before = repository.subgroups.find((item) => item.id === groupId);
  if (!before || (before.invalidatedAt !== undefined) === invalidated) return repository;
  const { invalidatedAt: _invalidatedAt, ...active } = before;
  const after = invalidated
    ? { ...before, invalidatedAt: now, updatedAt: Math.max(before.updatedAt, now) }
    : { ...active, updatedAt: Math.max(before.updatedAt, now) };
  return commitSubgroup(repository, invalidated ? 'invalidate' : 'restore', before, after, now);
}

export function invalidateGroupMemorySubgroup(repository: GroupMemoryRepositoryData,
  groupId: string, now = Date.now()) {
  return setSubgroupInvalidated(repository, groupId, true, now);
}

export function restoreGroupMemorySubgroup(repository: GroupMemoryRepositoryData,
  groupId: string, now = Date.now()) {
  return setSubgroupInvalidated(repository, groupId, false, now);
}

export function getReadableGroupMemoryGroupIds(repository: GroupMemoryRepositoryData,
  roleId: string, primaryGroupId = CURRENT_GROUP_MEMORY_GROUP_ID) {
  return [primaryGroupId, ...repository.subgroups.filter((subgroup) => (
    subgroup.invalidatedAt === undefined && subgroup.memberRoleIds.includes(roleId)
  )).map((subgroup) => subgroup.id)];
}

export function isWritableGroupMemoryGroup(repository: GroupMemoryRepositoryData, groupId: string) {
  if (groupId === CURRENT_GROUP_MEMORY_GROUP_ID) return true;
  return repository.subgroups.some((subgroup) => (
    subgroup.id === groupId && subgroup.invalidatedAt === undefined
  ));
}

export function getWritableGroupMemoryGroupOptions(repository: GroupMemoryRepositoryData) {
  return [
    { id: CURRENT_GROUP_MEMORY_GROUP_ID, name: '全部群聊角色' },
    ...repository.subgroups.filter((subgroup) => subgroup.invalidatedAt === undefined)
      .map((subgroup) => ({ id: subgroup.id, name: subgroup.name })),
  ];
}
