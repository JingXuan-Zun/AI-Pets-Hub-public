import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import {
  NEURAL_PERSONA_RECORD_VERSION,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaLoadResult,
  type NeuralPersonaPersistedRecord,
  type NeuralPersonaRecoverySnapshot,
  type NeuralPersonaTransactionInput,
  type NeuralPersonaWriteResult,
} from './neuralPersonaPersistenceTypes';
import {
  parseNeuralPersonaRecord,
  serializeNeuralPersonaRecord,
} from './neuralPersonaSerialization';
import { createImmutableNeuralPersonaSnapshot } from './neuralPersonaSnapshot';
import type { NeuralPersonaGraphSnapshot } from './neuralPersonaTypes';
import { validateNeuralPersonaGraph } from './neuralPersonaValidation';

const MAX_RECOVERY_SNAPSHOTS = 5;

export interface NeuralPersonaGraphRepository {
  initialize: (graph: NeuralPersonaGraphSnapshot) => Promise<NeuralPersonaWriteResult>;
  load: (roleId: string) => Promise<NeuralPersonaLoadResult>;
  rollback: (roleId: string, snapshotId: string) => Promise<NeuralPersonaWriteResult>;
  transact: (input: NeuralPersonaTransactionInput) => Promise<NeuralPersonaWriteResult>;
}

function recoverySnapshot(record: NeuralPersonaPersistedRecord, now: number) {
  return {
    createdAt: now,
    reason: 'before-update' as const,
    serializedGraph: JSON.stringify(record.graph),
    snapshotId: `revision:${record.revision}`,
  };
}

function appendSnapshot(
  snapshots: NeuralPersonaRecoverySnapshot[],
  snapshot: NeuralPersonaRecoverySnapshot,
) {
  return [...snapshots.filter((entry) => entry.snapshotId !== snapshot.snapshotId), snapshot]
    .slice(-MAX_RECOVERY_SNAPSHOTS);
}

function conflictRevision(raw: string | null, config: NeuralPersonaConfig, now: number) {
  if (!raw) return null;
  const parsed = parseNeuralPersonaRecord(raw, config, now);
  return parsed.status === 'ok' ? parsed.record.revision : null;
}

interface RepositoryOptions {
  config: NeuralPersonaConfig;
  now?: () => number;
  storage: NeuralPersonaAtomicStorage;
}

class DefaultNeuralPersonaGraphRepository implements NeuralPersonaGraphRepository {
  private readonly now: () => number;

  constructor(private readonly options: RepositoryOptions) {
    this.now = options.now ?? Date.now;
  }

  private async persistMigration(
    roleId: string,
    raw: string,
    record: NeuralPersonaPersistedRecord,
  ): Promise<NeuralPersonaLoadResult> {
    const snapshot: NeuralPersonaRecoverySnapshot = {
      createdAt: this.now(),
      reason: 'before-migration',
      serializedGraph: raw,
      snapshotId: `migration:${record.revision}`,
    };
    const migrated = {
      ...record,
      recoverySnapshots: appendSnapshot(record.recoverySnapshots, snapshot),
      revision: record.revision + 1,
      updatedAt: this.now(),
    };
    const written = await this.options.storage.compareAndSwap(
      roleId, raw, serializeNeuralPersonaRecord(migrated),
    );
    if (written) return { record: migrated, status: 'ok' };
    const latest = await this.options.storage.read(roleId);
    if (latest === null) return { status: 'missing' };
    const reparsed = parseNeuralPersonaRecord(latest, this.options.config, this.now());
    return reparsed.status === 'ok'
      ? { record: reparsed.record, status: 'ok' }
      : reparsed;
  }

  async load(roleId: string): Promise<NeuralPersonaLoadResult> {
    const raw = await this.options.storage.read(roleId);
    if (raw === null) return { status: 'missing' };
    const parsed = parseNeuralPersonaRecord(raw, this.options.config, this.now());
    if (parsed.status === 'corrupt') return parsed;
    if (parsed.record.roleId !== roleId) return { reason: 'storage-role-mismatch', status: 'corrupt' };
    if (parsed.migrated) return this.persistMigration(roleId, raw, parsed.record);
    return { record: parsed.record, status: 'ok' };
  }

  async initialize(graph: NeuralPersonaGraphSnapshot): Promise<NeuralPersonaWriteResult> {
    const validation = validateNeuralPersonaGraph(graph, this.options.config);
    if (!validation.valid) return { reason: validation.issues[0].code, status: 'invalid' };
    const record: NeuralPersonaPersistedRecord = {
      graph: createImmutableNeuralPersonaSnapshot(graph),
      recordVersion: NEURAL_PERSONA_RECORD_VERSION,
      recoverySnapshots: [],
      revision: 0,
      roleId: graph.roleId,
      updatedAt: this.now(),
    };
    const written = await this.options.storage.compareAndSwap(
      graph.roleId, null, serializeNeuralPersonaRecord(record),
    );
    if (written) return { record, status: 'ok' };
    const actual = await this.options.storage.read(graph.roleId);
    return {
      actualRevision: conflictRevision(actual, this.options.config, this.now()),
      status: 'conflict',
    };
  }

  async transact(input: NeuralPersonaTransactionInput): Promise<NeuralPersonaWriteResult> {
    const raw = await this.options.storage.read(input.roleId);
    if (raw === null) return { reason: 'record-missing', status: 'missing' };
    const parsed = parseNeuralPersonaRecord(raw, this.options.config, this.now());
    if (parsed.status === 'corrupt') return parsed;
    const current = parsed.record;
    if (current.roleId !== input.roleId) return { reason: 'storage-role-mismatch', status: 'corrupt' };
    if (current.revision !== input.expectedRevision) {
      return { actualRevision: current.revision, status: 'conflict' };
    }
    const graph = input.update(current.graph);
    const validation = validateNeuralPersonaGraph(graph, this.options.config);
    if (!validation.valid || graph.roleId !== input.roleId) {
      return { reason: validation.issues[0]?.code ?? 'graph-role-mismatch', status: 'invalid' };
    }
    const next = {
      ...current,
      graph: createImmutableNeuralPersonaSnapshot(graph),
      recoverySnapshots: appendSnapshot(
        current.recoverySnapshots,
        recoverySnapshot(current, this.now()),
      ),
      revision: current.revision + 1,
      updatedAt: this.now(),
    };
    const written = await this.options.storage.compareAndSwap(
      input.roleId, raw, serializeNeuralPersonaRecord(next),
    );
    if (written) return { record: next, status: 'ok' };
    const actual = await this.options.storage.read(input.roleId);
    return {
      actualRevision: conflictRevision(actual, this.options.config, this.now()),
      status: 'conflict',
    };
  }

  async rollback(roleId: string, snapshotId: string): Promise<NeuralPersonaWriteResult> {
    const loaded = await this.load(roleId);
    if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
    if (loaded.status === 'corrupt') return loaded;
    const snapshot = loaded.record.recoverySnapshots.find((entry) => entry.snapshotId === snapshotId);
    if (!snapshot) return { reason: 'snapshot-missing', status: 'missing' };
    const parsed = parseNeuralPersonaRecord(
      snapshot.serializedGraph,
      this.options.config,
      this.now(),
    );
    if (parsed.status === 'corrupt') return parsed;
    return this.transact({
      expectedRevision: loaded.record.revision,
      roleId,
      update: () => parsed.record.graph,
    });
  }

}

export function createNeuralPersonaGraphRepository(
  options: RepositoryOptions,
): NeuralPersonaGraphRepository {
  return new DefaultNeuralPersonaGraphRepository(options);
}
