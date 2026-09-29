export type GroupUserTopicAdoptionState = 'pending' | 'active' | 'adopted' | 'completed';

export type GroupUserTopicState = {
  addressedRoleIds: string[];
  answeredRoleIds: string[];
  adoptionState: GroupUserTopicAdoptionState;
  deferredTopicId: string | null;
  remainingRoleIds: string[];
  sourceMessageId: string;
  topicId: string;
};

const ADOPTION_STATES = new Set<GroupUserTopicAdoptionState>([
  'pending', 'active', 'adopted', 'completed',
]);

function uniqueRoleIds(roleIds: string[]) {
  return [...new Set(roleIds.map((roleId) => roleId.trim()).filter(Boolean))];
}

export function createGroupUserTopicState(options: {
  addressedRoleIds: string[];
  deferredTopicId?: string | null;
  roleIds: string[];
  sourceMessageId: string;
  topicId: string;
}): GroupUserTopicState {
  const addressedRoleIds = uniqueRoleIds(options.addressedRoleIds);
  const roleIds = uniqueRoleIds(options.roleIds);
  return {
    addressedRoleIds,
    answeredRoleIds: [],
    adoptionState: 'pending',
    deferredTopicId: options.deferredTopicId ?? null,
    remainingRoleIds: [...addressedRoleIds, ...roleIds.filter((roleId) => !addressedRoleIds.includes(roleId))],
    sourceMessageId: options.sourceMessageId,
    topicId: options.topicId,
  };
}

export function markGroupUserTopicRoleAnswered(
  state: GroupUserTopicState,
  roleId: string,
): GroupUserTopicState {
  if (!state.remainingRoleIds.includes(roleId)) return state;
  const answeredRoleIds = [...state.answeredRoleIds, roleId];
  const remainingRoleIds = state.remainingRoleIds.filter((item) => item !== roleId);
  return {
    ...state,
    answeredRoleIds,
    adoptionState: remainingRoleIds.length === 0 ? 'completed' : 'adopted',
    remainingRoleIds,
  };
}

export function normalizeGroupUserTopicState(value: unknown): GroupUserTopicState | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const text = (item: unknown) => typeof item === 'string' && item.trim() ? item.trim() : null;
  const sourceMessageId = text(record.sourceMessageId);
  const topicId = text(record.topicId);
  const adoptionState = text(record.adoptionState) as GroupUserTopicAdoptionState | null;
  if (!sourceMessageId || !topicId || !adoptionState || !ADOPTION_STATES.has(adoptionState)) return null;
  const roles = (item: unknown) => Array.isArray(item) ? uniqueRoleIds(item.filter((id): id is string => typeof id === 'string')) : [];
  return {
    addressedRoleIds: roles(record.addressedRoleIds),
    answeredRoleIds: roles(record.answeredRoleIds),
    adoptionState,
    deferredTopicId: text(record.deferredTopicId),
    remainingRoleIds: roles(record.remainingRoleIds),
    sourceMessageId,
    topicId,
  };
}
