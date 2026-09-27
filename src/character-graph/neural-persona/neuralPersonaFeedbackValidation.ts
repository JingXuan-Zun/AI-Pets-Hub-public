import {
  MAX_NEURAL_PERSONA_FEEDBACK_EVENTS,
  type NeuralPersonaFeedbackEvent,
  type NeuralPersonaFeedbackKind,
  type NeuralPersonaFeedbackSourceType,
} from './neuralPersonaFeedbackTypes';
import { isReservedNeuralPersonaStorageRoleId } from './neuralPersonaStorageNamespaces';

type JsonObject = Record<string, unknown>;

const EVENT_KINDS = new Set<NeuralPersonaFeedbackKind>([
  'correction', 'dismissal', 'negative', 'positive',
]);
const SOURCE_TYPES = new Set<NeuralPersonaFeedbackSourceType>([
  'manual-review', 'system-test', 'user-explicit',
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    return null;
  }
  return normalized;
}

export function normalizeNeuralPersonaRoleId(value: unknown) {
  const roleId = normalizeText(value, 128);
  return roleId && !isReservedNeuralPersonaStorageRoleId(roleId) ? roleId : null;
}

export type NeuralPersonaFeedbackEventValidationResult =
  | { event: NeuralPersonaFeedbackEvent; valid: true }
  | { reason: string; valid: false };

function compareEvents(left: NeuralPersonaFeedbackEvent, right: NeuralPersonaFeedbackEvent) {
  if (left.occurredAt !== right.occurredAt) return left.occurredAt - right.occurredAt;
  if (left.eventId === right.eventId) return 0;
  return left.eventId < right.eventId ? -1 : 1;
}

export function normalizeNeuralPersonaFeedbackEvent(
  value: unknown,
  expectedRoleId?: string,
  latestOccurredAt?: number,
): NeuralPersonaFeedbackEventValidationResult {
  if (!isObject(value) || !isObject(value.evidence)) {
    return { reason: 'feedback-event-shape-invalid', valid: false };
  }
  const eventId = normalizeText(value.eventId, 128);
  const roleId = normalizeNeuralPersonaRoleId(value.roleId);
  const nodeId = normalizeText(value.nodeId, 128);
  const sourceId = normalizeText(value.evidence.sourceId, 160);
  const summary = normalizeText(value.evidence.summary, 240);
  if (!eventId || !roleId || !nodeId || !sourceId || !summary) {
    return { reason: 'feedback-event-text-invalid', valid: false };
  }
  if (expectedRoleId !== undefined && roleId !== expectedRoleId) {
    return { reason: 'feedback-event-role-mismatch', valid: false };
  }
  if (!EVENT_KINDS.has(value.kind as NeuralPersonaFeedbackKind)) {
    return { reason: 'feedback-kind-invalid', valid: false };
  }
  if (!SOURCE_TYPES.has(value.evidence.sourceType as NeuralPersonaFeedbackSourceType)) {
    return { reason: 'feedback-evidence-source-invalid', valid: false };
  }
  if (typeof value.magnitude !== 'number' || !Number.isFinite(value.magnitude)
    || value.magnitude <= 0 || value.magnitude > 1) {
    return { reason: 'feedback-magnitude-invalid', valid: false };
  }
  if (typeof value.occurredAt !== 'number' || !Number.isSafeInteger(value.occurredAt)
    || value.occurredAt < 0
    || (latestOccurredAt !== undefined && value.occurredAt > latestOccurredAt)) {
    return { reason: 'feedback-time-invalid', valid: false };
  }
  if (value.observedGraphRevision !== undefined
    && (typeof value.observedGraphRevision !== 'number'
      || !Number.isSafeInteger(value.observedGraphRevision)
      || value.observedGraphRevision < 0)) {
    return { reason: 'feedback-graph-revision-invalid', valid: false };
  }
  return {
    event: {
      eventId, evidence: { sourceId, sourceType: value.evidence.sourceType, summary },
      kind: value.kind, magnitude: value.magnitude, nodeId,
      observedGraphRevision: value.observedGraphRevision,
      occurredAt: value.occurredAt, roleId,
    } as NeuralPersonaFeedbackEvent,
    valid: true,
  };
}

export function normalizeNeuralPersonaFeedbackEvents(
  values: unknown,
  roleId: string,
): { events: NeuralPersonaFeedbackEvent[]; reason?: string } {
  if (!Array.isArray(values) || values.length > MAX_NEURAL_PERSONA_FEEDBACK_EVENTS) {
    return { events: [], reason: 'feedback-event-limit-invalid' };
  }
  const events: NeuralPersonaFeedbackEvent[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    const normalized = normalizeNeuralPersonaFeedbackEvent(value, roleId);
    if (normalized.valid === false) return { events: [], reason: normalized.reason };
    if (ids.has(normalized.event.eventId)) {
      return { events: [], reason: 'feedback-event-id-duplicate' };
    }
    ids.add(normalized.event.eventId);
    events.push(normalized.event);
  }
  return { events: events.sort(compareEvents) };
}
