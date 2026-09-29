import {
  MAX_NEURAL_PERSONA_FEEDBACK_RECOVERY_SNAPSHOTS,
  NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION,
  type NeuralPersonaFeedbackRecoverySnapshot,
  type NeuralPersonaReinforcementLedgerRecord,
} from './neuralPersonaFeedbackTypes';
import {
  normalizeNeuralPersonaFeedbackEvents,
  normalizeNeuralPersonaRoleId,
} from './neuralPersonaFeedbackValidation';

type JsonObject = Record<string, unknown>;

export type NeuralPersonaFeedbackParseResult =
  | { record: NeuralPersonaReinforcementLedgerRecord; status: 'ok' }
  | { reason: string; status: 'corrupt' };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRecoverySnapshots(value: unknown) {
  if (!Array.isArray(value)
    || value.length > MAX_NEURAL_PERSONA_FEEDBACK_RECOVERY_SNAPSHOTS) return null;
  const snapshots: NeuralPersonaFeedbackRecoverySnapshot[] = [];
  for (const item of value) {
    if (!isObject(item) || item.reason !== 'before-update'
      || typeof item.serializedEvents !== 'string'
      || typeof item.snapshotId !== 'string' || !item.snapshotId
      || typeof item.createdAt !== 'number'
      || !Number.isSafeInteger(item.createdAt) || item.createdAt < 0) return null;
    snapshots.push({
      createdAt: item.createdAt as number,
      reason: 'before-update',
      serializedEvents: item.serializedEvents,
      snapshotId: item.snapshotId,
    });
  }
  return snapshots;
}

export function createImmutableNeuralPersonaFeedbackRecord(
  record: NeuralPersonaReinforcementLedgerRecord,
) {
  const events = record.events.map((event) => Object.freeze({
    ...event, evidence: Object.freeze({ ...event.evidence }),
  }));
  const recoverySnapshots = record.recoverySnapshots.map((snapshot) => Object.freeze({
    ...snapshot,
  }));
  return Object.freeze({
    ...record,
    events: Object.freeze(events) as NeuralPersonaReinforcementLedgerRecord['events'],
    recoverySnapshots: Object.freeze(recoverySnapshots) as NeuralPersonaFeedbackRecoverySnapshot[],
  });
}

export function serializeNeuralPersonaFeedbackRecord(
  record: NeuralPersonaReinforcementLedgerRecord,
) {
  return JSON.stringify(record);
}

export function parseNeuralPersonaFeedbackEvents(serialized: string, roleId: string) {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return { events: [], reason: 'feedback-snapshot-json-invalid' };
  }
  return normalizeNeuralPersonaFeedbackEvents(value, roleId);
}

export function parseNeuralPersonaFeedbackRecord(
  serialized: string,
): NeuralPersonaFeedbackParseResult {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return { reason: 'invalid-json', status: 'corrupt' };
  }
  if (!isObject(value) || value.formatVersion !== NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION) {
    return { reason: 'unsupported-feedback-record-shape', status: 'corrupt' };
  }
  const roleId = normalizeNeuralPersonaRoleId(value.roleId);
  const recoverySnapshots = normalizeRecoverySnapshots(value.recoverySnapshots);
  if (!roleId || !recoverySnapshots || typeof value.revision !== 'number'
    || !Number.isSafeInteger(value.revision) || value.revision < 0
    || typeof value.updatedAt !== 'number'
    || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0) {
    return { reason: 'feedback-record-metadata-invalid', status: 'corrupt' };
  }
  const normalized = normalizeNeuralPersonaFeedbackEvents(value.events, roleId);
  if (normalized.reason) return { reason: normalized.reason, status: 'corrupt' };
  return {
    record: createImmutableNeuralPersonaFeedbackRecord({
      events: normalized.events,
      formatVersion: NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION,
      recoverySnapshots,
      revision: value.revision as number,
      roleId,
      updatedAt: value.updatedAt as number,
    }),
    status: 'ok',
  };
}
