import {
  NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION,
  type NeuralPersonaLearningProposalLoadResult,
  type NeuralPersonaLearningProposalRecord,
  type NeuralPersonaLearningProposalRecoverySnapshot,
  type NeuralPersonaLearningProposalRepositoryOptions,
  type NeuralPersonaLearningProposalTransactionInput,
  type NeuralPersonaLearningProposalWriteResult,
} from './neuralPersonaLearningProposalTypes';
import {
  createImmutableNeuralPersonaLearningProposalRecord,
  normalizeNeuralPersonaLearningProposals,
  parseNeuralPersonaLearningProposalRecord,
  serializeNeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalSerialization';
import { createNeuralPersonaLearningProposalStorage } from './neuralPersonaLearningProposalStorage';
import { normalizeNeuralPersonaRoleId } from './neuralPersonaFeedbackValidation';
import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';

interface CurrentRecord {
  raw: string;
  record: NeuralPersonaLearningProposalRecord;
  status: 'ok';
}

type CurrentResult = CurrentRecord
  | { reason: string; status: 'corrupt' }
  | { status: 'missing' };

export interface NeuralPersonaLearningProposalRepository {
  initialize: (roleId: string) => Promise<NeuralPersonaLearningProposalWriteResult>;
  load: (roleId: string) => Promise<NeuralPersonaLearningProposalLoadResult>;
  rollback: (roleId: string, snapshotId: string) => Promise<NeuralPersonaLearningProposalWriteResult>;
  transact: (
    input: NeuralPersonaLearningProposalTransactionInput,
  ) => Promise<NeuralPersonaLearningProposalWriteResult>;
}

function snapshot(record: NeuralPersonaLearningProposalRecord, now: number) {
  return {
    createdAt: now,
    reason: 'before-update' as const,
    serializedProposals: JSON.stringify(record.proposals),
    snapshotId: `revision:${record.revision}`,
  };
}

function appendSnapshot(
  snapshots: NeuralPersonaLearningProposalRecoverySnapshot[],
  next: NeuralPersonaLearningProposalRecoverySnapshot,
) {
  return [...snapshots.filter((item) => item.snapshotId !== next.snapshotId), next].slice(-5);
}

class DefaultNeuralPersonaLearningProposalRepository
implements NeuralPersonaLearningProposalRepository {
  private readonly now: () => number;
  private readonly storage: NeuralPersonaAtomicStorage;

  constructor(options: NeuralPersonaLearningProposalRepositoryOptions) {
    this.now = options.now ?? Date.now;
    this.storage = createNeuralPersonaLearningProposalStorage(options.storage);
  }

  private async readCurrent(roleId: string): Promise<CurrentResult> {
    const raw = await this.storage.read(roleId);
    if (raw === null) return { status: 'missing' };
    const parsed = parseNeuralPersonaLearningProposalRecord(raw);
    if (parsed.status === 'corrupt') return parsed;
    if (parsed.record.roleId !== roleId) {
      return { reason: 'learning-proposal-storage-role-mismatch', status: 'corrupt' };
    }
    return { raw, record: parsed.record, status: 'ok' };
  }

  private async conflict(roleId: string) {
    const latest = await this.storage.read(roleId);
    if (latest === null) return { actualRevision: null, status: 'conflict' as const };
    const parsed = parseNeuralPersonaLearningProposalRecord(latest);
    return {
      actualRevision: parsed.status === 'ok' ? parsed.record.revision : null,
      status: 'conflict' as const,
    };
  }

  async load(roleId: string): Promise<NeuralPersonaLearningProposalLoadResult> {
    const current = await this.readCurrent(roleId);
    return current.status === 'ok'
      ? { record: current.record, status: 'ok' }
      : current;
  }

  async initialize(roleId: string): Promise<NeuralPersonaLearningProposalWriteResult> {
    if (normalizeNeuralPersonaRoleId(roleId) !== roleId) {
      return { reason: 'learning-proposal-role-invalid', status: 'invalid' };
    }
    const record = createImmutableNeuralPersonaLearningProposalRecord({
      formatVersion: NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION,
      proposals: [], recoverySnapshots: [], revision: 0,
      roleId, updatedAt: this.now(),
    });
    const written = await this.storage.compareAndSwap(
      roleId, null, serializeNeuralPersonaLearningProposalRecord(record),
    );
    return written ? { record, status: 'ok' } : this.conflict(roleId);
  }

  async transact(
    input: NeuralPersonaLearningProposalTransactionInput,
  ): Promise<NeuralPersonaLearningProposalWriteResult> {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      return { reason: 'learning-proposal-revision-invalid', status: 'invalid' };
    }
    const current = await this.readCurrent(input.roleId);
    if (current.status !== 'ok') return current.status === 'missing'
      ? { reason: 'learning-proposal-record-missing', status: 'missing' } : current;
    if (current.record.revision !== input.expectedRevision) {
      return { actualRevision: current.record.revision, status: 'conflict' };
    }
    const proposals = normalizeNeuralPersonaLearningProposals(
      input.update([...current.record.proposals]), input.roleId,
    );
    if (!proposals) return { reason: 'learning-proposal-update-invalid', status: 'invalid' };
    const now = this.now();
    const next = createImmutableNeuralPersonaLearningProposalRecord({
      ...current.record,
      proposals,
      recoverySnapshots: appendSnapshot(
        current.record.recoverySnapshots, snapshot(current.record, now),
      ),
      revision: current.record.revision + 1,
      updatedAt: now,
    });
    const written = await this.storage.compareAndSwap(
      input.roleId, current.raw, serializeNeuralPersonaLearningProposalRecord(next),
    );
    return written ? { record: next, status: 'ok' } : this.conflict(input.roleId);
  }

  async rollback(roleId: string, snapshotId: string) {
    const current = await this.readCurrent(roleId);
    if (current.status !== 'ok') return current.status === 'missing'
      ? { reason: 'learning-proposal-record-missing', status: 'missing' as const } : current;
    const selected = current.record.recoverySnapshots.find(
      (item) => item.snapshotId === snapshotId,
    );
    if (!selected) return { reason: 'learning-proposal-snapshot-missing', status: 'missing' as const };
    let raw: unknown;
    try { raw = JSON.parse(selected.serializedProposals); } catch {
      return { reason: 'learning-proposal-snapshot-corrupt', status: 'corrupt' as const };
    }
    const proposals = normalizeNeuralPersonaLearningProposals(raw, roleId);
    if (!proposals) return { reason: 'learning-proposal-snapshot-corrupt', status: 'corrupt' as const };
    return this.transact({ expectedRevision: current.record.revision,
      roleId, update: () => proposals });
  }
}

export function createNeuralPersonaLearningProposalRepository(
  options: NeuralPersonaLearningProposalRepositoryOptions,
): NeuralPersonaLearningProposalRepository {
  return new DefaultNeuralPersonaLearningProposalRepository(options);
}
