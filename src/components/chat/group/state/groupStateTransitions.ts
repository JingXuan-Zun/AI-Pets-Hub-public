import type { GroupSessionRecord, GroupSessionStatus } from './groupSessionRecord';

const allowedTransitions: Record<GroupSessionStatus, GroupSessionStatus[]> = {
  idle: ['planning', 'cancelled'],
  planning: ['speaking', 'waiting-next-speaker', 'waiting-task', 'completing', 'paused', 'cancelled', 'failed'],
  speaking: ['waiting-next-speaker', 'waiting-task', 'completing', 'paused', 'cancelled', 'failed'],
  'waiting-next-speaker': ['planning', 'completing', 'paused', 'cancelled', 'failed'],
  'waiting-task': ['resuming', 'paused', 'cancelled', 'failed'],
  paused: ['resuming', 'cancelled'],
  resuming: ['planning', 'speaking', 'cancelled', 'failed'],
  completing: ['completed', 'failed'],
  completed: [],
  cancelled: [],
  failed: [],
};

export function canTransitionGroupSession(
  from: GroupSessionStatus,
  to: GroupSessionStatus,
) {
  return allowedTransitions[from].includes(to);
}

export function transitionGroupSession(
  record: GroupSessionRecord,
  status: GroupSessionStatus,
  now = Date.now(),
) {
  if (!canTransitionGroupSession(record.status, status)) {
    throw new Error(`Invalid group session transition: ${record.status} -> ${status}`);
  }

  return { ...record, status, updatedAt: now };
}
