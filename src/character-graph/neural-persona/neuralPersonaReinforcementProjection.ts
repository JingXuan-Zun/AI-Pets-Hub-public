import type {
  NeuralPersonaFeedbackEvent,
  NeuralPersonaReinforcementLedgerRecord,
  NeuralPersonaReinforcementProjection,
} from './neuralPersonaFeedbackTypes';

const DAY_MILLISECONDS = 86_400_000;
const SCORE_SCALE = 1_000_000;

interface ProjectionAccumulator {
  correctionCount: number;
  dismissalCount: number;
  eventCount: number;
  negativeCount: number;
  negativeUnits: number;
  positiveCount: number;
  positiveUnits: number;
  sourceEventIds: string[];
}

export interface NeuralPersonaReinforcementReplayInput {
  decayRatePerDay: number;
  projectedAt: number;
}

function validateReplayInput(input: NeuralPersonaReinforcementReplayInput) {
  if (!Number.isSafeInteger(input.projectedAt) || input.projectedAt < 0) {
    throw new Error('feedback-projection-time-invalid');
  }
  if (!Number.isFinite(input.decayRatePerDay)
    || input.decayRatePerDay < 0 || input.decayRatePerDay > 1) {
    throw new Error('feedback-projection-decay-invalid');
  }
}

function effectiveUnits(
  event: NeuralPersonaFeedbackEvent,
  input: NeuralPersonaReinforcementReplayInput,
) {
  const age = Math.max(0, input.projectedAt - event.occurredAt);
  const ageDays = Math.floor(age / DAY_MILLISECONDS);
  const decayUnits = Math.round(input.decayRatePerDay * SCORE_SCALE);
  const remainingUnits = Math.max(0, SCORE_SCALE - decayUnits * ageDays);
  const magnitudeUnits = Math.round(event.magnitude * SCORE_SCALE);
  return Math.round((magnitudeUnits * remainingUnits) / SCORE_SCALE);
}

function emptyAccumulator(): ProjectionAccumulator {
  return {
    correctionCount: 0, dismissalCount: 0, eventCount: 0,
    negativeCount: 0, negativeUnits: 0, positiveCount: 0,
    positiveUnits: 0, sourceEventIds: [],
  };
}

function applyEvent(
  accumulator: ProjectionAccumulator,
  event: NeuralPersonaFeedbackEvent,
  units: number,
) {
  accumulator.eventCount += 1;
  accumulator.sourceEventIds.push(event.eventId);
  if (event.kind === 'positive') {
    accumulator.positiveCount += 1;
    accumulator.positiveUnits += units;
    return;
  }
  accumulator.negativeUnits += units;
  if (event.kind === 'negative') accumulator.negativeCount += 1;
  if (event.kind === 'correction') accumulator.correctionCount += 1;
  if (event.kind === 'dismissal') accumulator.dismissalCount += 1;
}

function toScore(units: number) {
  return units / SCORE_SCALE;
}

function toProjection(
  roleId: string,
  nodeId: string,
  projectedAt: number,
  value: ProjectionAccumulator,
): NeuralPersonaReinforcementProjection {
  return Object.freeze({
    correctionCount: value.correctionCount,
    dismissalCount: value.dismissalCount,
    eventCount: value.eventCount,
    negativeCount: value.negativeCount,
    negativeScore: toScore(value.negativeUnits),
    netScore: toScore(value.positiveUnits - value.negativeUnits),
    nodeId,
    positiveCount: value.positiveCount,
    positiveScore: toScore(value.positiveUnits),
    projectedAt,
    roleId,
    sourceEventIds: Object.freeze([...value.sourceEventIds]) as string[],
  });
}

export function replayNeuralPersonaReinforcementLedger(
  record: NeuralPersonaReinforcementLedgerRecord,
  input: NeuralPersonaReinforcementReplayInput,
) {
  validateReplayInput(input);
  const byNode = new Map<string, ProjectionAccumulator>();
  for (const event of record.events) {
    if (event.occurredAt > input.projectedAt) continue;
    const accumulator = byNode.get(event.nodeId) ?? emptyAccumulator();
    applyEvent(accumulator, event, effectiveUnits(event, input));
    byNode.set(event.nodeId, accumulator);
  }
  return [...byNode.entries()]
    .sort(([left], [right]) => (left === right ? 0 : left < right ? -1 : 1))
    .map(([nodeId, value]) => toProjection(record.roleId, nodeId, input.projectedAt, value));
}
