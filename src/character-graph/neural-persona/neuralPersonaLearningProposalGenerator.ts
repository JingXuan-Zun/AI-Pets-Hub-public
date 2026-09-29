import type {
  NeuralPersonaFeedbackEvent,
  NeuralPersonaReinforcementLedgerRecord,
  NeuralPersonaReinforcementProjection,
} from './neuralPersonaFeedbackTypes';
import {
  MAX_NEURAL_PERSONA_BASE_WEIGHT_DELTA,
  MAX_NEURAL_PERSONA_CONFIDENCE_DELTA,
  MAX_NEURAL_PERSONA_PROPOSAL_SOURCE_EVENTS,
  MAX_NEURAL_PERSONA_STABILITY_DELTA,
  type NeuralPersonaLearningProposal,
} from './neuralPersonaLearningProposalTypes';
import { replayNeuralPersonaReinforcementLedger } from './neuralPersonaReinforcementProjection';
import type { NeuralPersonaGraphSnapshot, NeuralPersonaNode } from './neuralPersonaTypes';

export interface NeuralPersonaLearningProposalGenerationInput {
  createdAt: number;
  graph: NeuralPersonaGraphSnapshot;
  graphRevision: number;
  ledger: NeuralPersonaReinforcementLedgerRecord;
  nodeId: string;
  projectedAt: number;
  proposalId: string;
}

export type NeuralPersonaLearningProposalGenerationResult =
  | { proposal: NeuralPersonaLearningProposal; status: 'ok' }
  | { reason: string; status: 'invalid' | 'missing' };

function round(value: number) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeDelta(current: number, raw: number, limit: number) {
  return round(clamp(raw, -Math.min(limit, current), Math.min(limit, 1 - current)));
}

function proposalDeltas(node: NeuralPersonaNode, signal: number) {
  return {
    baseWeight: safeDelta(
      node.baseWeight, signal * node.plasticity * MAX_NEURAL_PERSONA_BASE_WEIGHT_DELTA,
      MAX_NEURAL_PERSONA_BASE_WEIGHT_DELTA,
    ),
    confidence: safeDelta(
      node.confidence, signal * MAX_NEURAL_PERSONA_CONFIDENCE_DELTA,
      MAX_NEURAL_PERSONA_CONFIDENCE_DELTA,
    ),
    stability: safeDelta(
      node.stability, signal * MAX_NEURAL_PERSONA_STABILITY_DELTA,
      MAX_NEURAL_PERSONA_STABILITY_DELTA,
    ),
  };
}

function relevantEvents(input: NeuralPersonaLearningProposalGenerationInput) {
  return input.ledger.events
    .filter((event) => event.nodeId === input.nodeId && event.occurredAt <= input.projectedAt)
    .slice(-MAX_NEURAL_PERSONA_PROPOSAL_SOURCE_EVENTS);
}

function buildProposal(
  input: NeuralPersonaLearningProposalGenerationInput,
  node: NeuralPersonaNode,
  projection: NeuralPersonaReinforcementProjection,
  events: NeuralPersonaFeedbackEvent[],
  deltas: ReturnType<typeof proposalDeltas>,
): NeuralPersonaLearningProposal {
  return {
    createdAt: input.createdAt,
    deltas,
    nodeId: node.nodeId,
    observedGraphRevision: input.graphRevision,
    observedLedgerRevision: input.ledger.revision,
    projectedAt: input.projectedAt,
    proposalId: input.proposalId,
    protectedNode: node.protected,
    reasonSummary: `Net feedback ${projection.netScore.toFixed(3)} from ${events.length} explicit events.`,
    roleId: input.graph.roleId,
    signal: {
      eventCount: events.length,
      negativeScore: projection.negativeScore,
      netScore: projection.netScore,
      positiveScore: projection.positiveScore,
    },
    sourceEventIds: events.map((event) => event.eventId),
    status: 'pending-review',
  };
}

export function generateNeuralPersonaLearningProposal(
  input: NeuralPersonaLearningProposalGenerationInput,
): NeuralPersonaLearningProposalGenerationResult {
  if (input.graph.roleId !== input.ledger.roleId) {
    return { reason: 'learning-proposal-role-mismatch', status: 'invalid' };
  }
  if (!input.proposalId.trim() || input.proposalId.length > 128) {
    return { reason: 'learning-proposal-id-invalid', status: 'invalid' };
  }
  const node = input.graph.nodes.find((item) => item.nodeId === input.nodeId);
  if (!node) return { reason: 'learning-proposal-node-missing', status: 'missing' };
  if (node.status !== 'active') {
    return { reason: 'learning-proposal-node-not-active', status: 'invalid' };
  }
  if (node.expiresAt !== undefined && node.expiresAt <= input.projectedAt) {
    return { reason: 'learning-proposal-node-expired', status: 'invalid' };
  }
  const events = relevantEvents(input);
  if (!events.length) return { reason: 'learning-proposal-events-missing', status: 'missing' };
  const [projection] = replayNeuralPersonaReinforcementLedger(
    { ...input.ledger, events },
    { decayRatePerDay: node.decayRate, projectedAt: input.projectedAt },
  );
  const signal = clamp(projection.netScore, -1, 1);
  if (Math.abs(signal) < 0.05) {
    return { reason: 'learning-proposal-signal-insufficient', status: 'invalid' };
  }
  const deltas = proposalDeltas(node, signal);
  if (Object.values(deltas).every((delta) => delta === 0)) {
    return { reason: 'learning-proposal-no-change', status: 'invalid' };
  }
  return {
    proposal: buildProposal(input, node, projection, events, deltas),
    status: 'ok',
  };
}
