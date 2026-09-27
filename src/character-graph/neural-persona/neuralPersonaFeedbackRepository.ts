import {
  MAX_NEURAL_PERSONA_FEEDBACK_EVENTS,
  MAX_NEURAL_PERSONA_FEEDBACK_RECOVERY_SNAPSHOTS,
  NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION,
  type NeuralPersonaFeedbackAppendInput,
  type NeuralPersonaFeedbackLoadResult,
  type NeuralPersonaFeedbackRecoverySnapshot,
  type NeuralPersonaFeedbackRepositoryOptions,
  type NeuralPersonaFeedbackWriteResult,
  type NeuralPersonaReinforcementLedgerRecord,
} from './neuralPersonaFeedbackTypes';
import {
  createImmutableNeuralPersonaFeedbackRecord,
  parseNeuralPersonaFeedbackEvents,
  parseNeuralPersonaFeedbackRecord,
  serializeNeuralPersonaFeedbackRecord,
} from './neuralPersonaFeedbackSerialization';
import { createNeuralPersonaFeedbackStorage } from './neuralPersonaFeedbackStorage';
import {
  normalizeNeuralPersonaFeedbackEvent,
  normalizeNeuralPersonaRoleId,
} from './neuralPersonaFeedbackValidation';
import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';

interface CurrentRecord {
  raw: string;
  record: NeuralPersonaReinforcementLedgerRecord;
  status: 'ok';
}

type CurrentResult = CurrentRecord
  | { reason: string; status: 'corrupt' }
  | { status: 'missing' };

export interface NeuralPersonaReinforcementLedgerRepository {
  append: (input: NeuralPersonaFeedbackAppendInput) => Promise<NeuralPersonaFeedbackWriteResult>;
  initialize: (roleId: string) => Promise<NeuralPersonaFeedbackWriteResult>;
  load: (roleId: string) => Promise<NeuralPersonaFeedbackLoadResult>;
  rollback: (roleId: string, snapshotId: string) => Promise<NeuralPersonaFeedbackWriteResult>;
}

function sortEvents(events: NeuralPersonaReinforcementLedgerRecord['events']) {
  return [...events].sort((left, right) => (
    left.occurredAt - right.occurredAt
    || (left.eventId === right.eventId ? 0 : left.eventId < right.eventId ? -1 : 1)
  ));
}

function snapshot(record: NeuralPersonaReinforcementLedgerRecord, now: number) {
  return {
    createdAt: now,
    reason: 'before-update' as const,
    serializedEvents: JSON.stringify(record.events),
    snapshotId: `revision:${record.revision}`,
  };
}

function appendSnapshot(
  snapshots: NeuralPersonaFeedbackRecoverySnapshot[],
  next: NeuralPersonaFeedbackRecoverySnapshot,
) {
  return [...snapshots.filter((item) => item.snapshotId !== next.snapshotId), next]
    .slice(-MAX_NEURAL_PERSONA_FEEDBACK_RECOVERY_SNAPSHOTS);
}

function sameEvent(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

class DefaultNeuralPersonaReinforcementLedgerRepository
implements NeuralPersonaReinforcementLedgerRepository {
  private readonly now: () => number;
  private readonly storage: NeuralPersonaAtomicStorage;

  constructor(options: NeuralPersonaFeedbackRepositoryOptions) {
    this.now = options.now ?? Date.now;
    this.storage = createNeuralPersonaFeedbackStorage(options.storage);
  }

  private async readCurrent(roleId: string): Promise<CurrentResult> {
    const raw = await this.storage.read(roleId);
    if (raw === null) return { status: 'missing' };
    const parsed = parseNeuralPersonaFeedbackRecord(raw);
    if (parsed.status === 'corrupt') return parsed;
    if (parsed.record.roleId !== roleId) {
      return { reason: 'feedback-storage-role-mismatch', status: 'corrupt' };
    }
    return { raw, record: parsed.record, status: 'ok' };
  }

  private async conflict(roleId: string) {
    const latest = await this.storage.read(roleId);
    if (latest === null) return { actualRevision: null, status: 'conflict' as const };
    const parsed = parseNeuralPersonaFeedbackRecord(latest);
    return {
      actualRevision: parsed.status === 'ok' ? parsed.record.revision : null,
      status: 'conflict' as const,
    };
  }

  async load(roleId: string): Promise<NeuralPersonaFeedbackLoadResult> {
    const current = await this.readCurrent(roleId);
    if (current.status !== 'ok') return current;
    return { record: current.record, status: 'ok' };
  }

  async initialize(roleId: string): Promise<NeuralPersonaFeedbackWriteResult> {
    if (normalizeNeuralPersonaRoleId(roleId) !== roleId) {
      return { reason: 'feedback-role-invalid', status: 'invalid' };
    }
    const record = createImmutableNeuralPersonaFeedbackRecord({
      events: [], formatVersion: NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION,
      recoverySnapshots: [], revision: 0, roleId, updatedAt: this.now(),
    });
    const written = await this.storage.compareAndSwap(
      roleId, null, serializeNeuralPersonaFeedbackRecord(record),
    );
    if (written) return { record, status: 'ok' };
    return this.conflict(roleId);
  }

  async append(input: NeuralPersonaFeedbackAppendInput): Promise<NeuralPersonaFeedbackWriteResult> {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      return { reason: 'feedback-revision-invalid', status: 'invalid' };
    }
    const current = await this.readCurrent(input.roleId);
    if (current.status !== 'ok') {
      return current.status === 'missing'
        ? { reason: 'feedback-record-missing', status: 'missing' }
        : current;
    }
    const normalized = normalizeNeuralPersonaFeedbackEvent(
      input.event, input.roleId, this.now(),
    );
    if (normalized.valid === false) return { reason: normalized.reason, status: 'invalid' };
    if (normalized.event.nodeId !== input.nodeId) {
      return { reason: 'feedback-event-node-mismatch', status: 'invalid' };
    }
    const duplicate = current.record.events.find(
      (item) => item.eventId === normalized.event.eventId,
    );
    if (duplicate) {
      return sameEvent(duplicate, normalized.event)
        ? { eventId: duplicate.eventId, record: current.record, status: 'idempotent' }
        : { reason: 'feedback-event-id-collision', status: 'invalid' };
    }
    if (current.record.revision !== input.expectedRevision) {
      return { actualRevision: current.record.revision, status: 'conflict' };
    }
    if (current.record.events.length >= MAX_NEURAL_PERSONA_FEEDBACK_EVENTS) {
      return { reason: 'feedback-event-limit-exceeded', status: 'invalid' };
    }
    return this.commitAppend(current, normalized.event);
  }

  private async commitAppend(
    current: CurrentRecord,
    event: NeuralPersonaReinforcementLedgerRecord['events'][number],
  ): Promise<NeuralPersonaFeedbackWriteResult> {
    const now = this.now();
    const next = createImmutableNeuralPersonaFeedbackRecord({
      ...current.record,
      events: sortEvents([...current.record.events, event]),
      recoverySnapshots: appendSnapshot(
        current.record.recoverySnapshots, snapshot(current.record, now),
      ),
      revision: current.record.revision + 1,
      updatedAt: now,
    });
    const written = await this.storage.compareAndSwap(
      current.record.roleId, current.raw, serializeNeuralPersonaFeedbackRecord(next),
    );
    if (written) return { record: next, status: 'ok' };
    return this.resolveAppendCasFailure(current.record.roleId, event);
  }

  private async resolveAppendCasFailure(
    roleId: string,
    event: NeuralPersonaReinforcementLedgerRecord['events'][number],
  ): Promise<NeuralPersonaFeedbackWriteResult> {
    const latest = await this.load(roleId);
    if (latest.status !== 'ok') {
      return latest.status === 'missing'
        ? { actualRevision: null, status: 'conflict' }
        : latest;
    }
    const duplicate = latest.record.events.find((item) => item.eventId === event.eventId);
    if (!duplicate) return { actualRevision: latest.record.revision, status: 'conflict' };
    return sameEvent(duplicate, event)
      ? { eventId: event.eventId, record: latest.record, status: 'idempotent' }
      : { reason: 'feedback-event-id-collision', status: 'invalid' };
  }

  async rollback(roleId: string, snapshotId: string): Promise<NeuralPersonaFeedbackWriteResult> {
    const current = await this.readCurrent(roleId);
    if (current.status !== 'ok') {
      return current.status === 'missing'
        ? { reason: 'feedback-record-missing', status: 'missing' }
        : current;
    }
    const selected = current.record.recoverySnapshots.find(
      (item) => item.snapshotId === snapshotId,
    );
    if (!selected) return { reason: 'feedback-snapshot-missing', status: 'missing' };
    const parsed = parseNeuralPersonaFeedbackEvents(selected.serializedEvents, roleId);
    if (parsed.reason) return { reason: parsed.reason, status: 'corrupt' };
    const now = this.now();
    const next = createImmutableNeuralPersonaFeedbackRecord({
      ...current.record,
      events: sortEvents(parsed.events),
      recoverySnapshots: appendSnapshot(
        current.record.recoverySnapshots, snapshot(current.record, now),
      ),
      revision: current.record.revision + 1,
      updatedAt: now,
    });
    const written = await this.storage.compareAndSwap(
      roleId, current.raw, serializeNeuralPersonaFeedbackRecord(next),
    );
    return written ? { record: next, status: 'ok' } : this.conflict(roleId);
  }
}

export function createNeuralPersonaReinforcementLedgerRepository(
  options: NeuralPersonaFeedbackRepositoryOptions,
): NeuralPersonaReinforcementLedgerRepository {
  return new DefaultNeuralPersonaReinforcementLedgerRepository(options);
}
