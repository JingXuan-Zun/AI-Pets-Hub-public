import {
  MAX_NEURAL_PERSONA_BASE_WEIGHT_DELTA,
  MAX_NEURAL_PERSONA_CONFIDENCE_DELTA,
  MAX_NEURAL_PERSONA_LEARNING_PROPOSALS,
  MAX_NEURAL_PERSONA_PROPOSAL_SOURCE_EVENTS,
  MAX_NEURAL_PERSONA_STABILITY_DELTA,
  NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION,
  type NeuralPersonaLearningProposal,
  type NeuralPersonaLearningProposalRecord,
  type NeuralPersonaLearningProposalRecoverySnapshot,
} from './neuralPersonaLearningProposalTypes';
import { normalizeNeuralPersonaRoleId } from './neuralPersonaFeedbackValidation';

type JsonObject = Record<string, unknown>;

export type NeuralPersonaLearningProposalParseResult =
  | { record: NeuralPersonaLearningProposalRecord; status: 'ok' }
  | { reason: string; status: 'corrupt' };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function safeTime(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function bounded(value: unknown, limit: number) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

type NormalizedReview = Pick<NeuralPersonaLearningProposal, 'status'> & Partial<Pick<
  NeuralPersonaLearningProposal,
  'appliedAt' | 'appliedBy' | 'appliedGraphRevision' | 'applicationStartedAt'
  | 'applicationCommandId' | 'protectedReviewConfirmed' | 'reversalCommandId'
  | 'reversalStartedAt' | 'reversedAt' | 'reversedBy' | 'reversedGraphRevision'
  | 'reviewedAt' | 'reviewerId'
>>;

function normalizeApplication(value: JsonObject) {
  const appliedBy = text(value.appliedBy, 128);
  const applicationCommandId = text(value.applicationCommandId, 128);
  if (!appliedBy || !applicationCommandId || !safeTime(value.applicationStartedAt)) return null;
  return { appliedBy, applicationCommandId,
    applicationStartedAt: value.applicationStartedAt as number };
}

function normalizeReversal(value: JsonObject, completed: boolean) {
  const reversalCommandId = text(value.reversalCommandId, 128);
  const reversedBy = text(value.reversedBy, 128);
  if (!reversalCommandId || !reversedBy || !safeTime(value.reversalStartedAt)) return null;
  if (!completed) {
    if (value.reversedAt !== undefined || value.reversedGraphRevision !== undefined) return null;
    return { reversalCommandId, reversalStartedAt: value.reversalStartedAt as number, reversedBy };
  }
  if (!safeTime(value.reversedAt) || !safeTime(value.reversedGraphRevision)) return null;
  return { reversalCommandId, reversalStartedAt: value.reversalStartedAt as number,
    reversedAt: value.reversedAt as number, reversedBy,
    reversedGraphRevision: value.reversedGraphRevision as number };
}

function normalizeReview(value: JsonObject, protectedNode: boolean): NormalizedReview | null {
  const status = value.status;
  const applicationFields = [value.appliedAt, value.appliedBy, value.appliedGraphRevision,
    value.applicationCommandId, value.applicationStartedAt];
  const reversalFields = [value.reversalCommandId, value.reversalStartedAt,
    value.reversedAt, value.reversedBy, value.reversedGraphRevision];
  if (!['accepted', 'applied', 'applying', 'pending-review', 'rejected', 'reversed', 'reversing']
    .includes(String(status))) return null;
  if (status === 'pending-review') {
    if (value.reviewedAt !== undefined || value.reviewerId !== undefined
      || value.protectedReviewConfirmed !== undefined
      || [...applicationFields, ...reversalFields].some((field) => field !== undefined)) return null;
    return { status } as const;
  }
  const reviewerId = text(value.reviewerId, 128);
  if (!reviewerId || !safeTime(value.reviewedAt)) return null;
  const confirmed = value.protectedReviewConfirmed;
  if (status !== 'rejected' && protectedNode && confirmed !== true) return null;
  if (confirmed !== undefined && typeof confirmed !== 'boolean') return null;
  const review = {
    protectedReviewConfirmed: confirmed as boolean | undefined,
    reviewedAt: value.reviewedAt as number,
    reviewerId,
  };
  if (status === 'accepted' || status === 'rejected') {
    if ([...applicationFields, ...reversalFields].some((field) => field !== undefined)) return null;
    return { ...review, status: status as 'accepted' | 'rejected' };
  }
  const application = normalizeApplication(value);
  if (!application) return null;
  if (status === 'applying') {
    if (value.appliedAt !== undefined || value.appliedGraphRevision !== undefined
      || reversalFields.some((field) => field !== undefined)) return null;
    return { ...review, ...application, status: 'applying' };
  }
  if (!safeTime(value.appliedAt) || !safeTime(value.appliedGraphRevision)) return null;
  const applied = { ...review, ...application, appliedAt: value.appliedAt as number,
    appliedGraphRevision: value.appliedGraphRevision as number };
  if (status === 'applied') return reversalFields.some((field) => field !== undefined)
    ? null : { ...applied, status };
  const reversal = normalizeReversal(value, status === 'reversed');
  return reversal ? { ...applied, ...reversal, status } as NormalizedReview : null;
}

function normalizeProposal(value: unknown, roleId: string): NeuralPersonaLearningProposal | null {
  if (!isObject(value) || !isObject(value.deltas) || !isObject(value.signal)) return null;
  const proposalId = text(value.proposalId, 128);
  const nodeId = text(value.nodeId, 128);
  const reasonSummary = text(value.reasonSummary, 240);
  if (!proposalId || !nodeId || !reasonSummary || value.roleId !== roleId) return null;
  if (!bounded(value.deltas.baseWeight, MAX_NEURAL_PERSONA_BASE_WEIGHT_DELTA)
    || !bounded(value.deltas.confidence, MAX_NEURAL_PERSONA_CONFIDENCE_DELTA)
    || !bounded(value.deltas.stability, MAX_NEURAL_PERSONA_STABILITY_DELTA)) return null;
  if (typeof value.signal.eventCount !== 'number'
    || !Number.isInteger(value.signal.eventCount) || value.signal.eventCount < 1
    || value.signal.eventCount > MAX_NEURAL_PERSONA_PROPOSAL_SOURCE_EVENTS
    || ![value.signal.positiveScore, value.signal.negativeScore, value.signal.netScore]
      .every((score) => typeof score === 'number' && Number.isFinite(score))) return null;
  if (!Array.isArray(value.sourceEventIds)
    || value.sourceEventIds.length !== value.signal.eventCount) return null;
  const sourceEventIds = value.sourceEventIds.map((id) => text(id, 128));
  if (sourceEventIds.some((id) => !id)
    || new Set(sourceEventIds).size !== sourceEventIds.length) return null;
  if (![value.createdAt, value.projectedAt, value.observedGraphRevision,
    value.observedLedgerRevision].every(safeTime) || typeof value.protectedNode !== 'boolean') return null;
  const review = normalizeReview(value, value.protectedNode);
  if (!review) return null;
  return {
    createdAt: value.createdAt as number,
    deltas: value.deltas as unknown as NeuralPersonaLearningProposal['deltas'],
    nodeId,
    observedGraphRevision: value.observedGraphRevision as number,
    observedLedgerRevision: value.observedLedgerRevision as number,
    projectedAt: value.projectedAt as number,
    proposalId,
    protectedNode: value.protectedNode,
    reasonSummary,
    roleId,
    signal: value.signal as unknown as NeuralPersonaLearningProposal['signal'],
    sourceEventIds: sourceEventIds as string[],
    ...review,
  };
}

export function normalizeNeuralPersonaLearningProposals(values: unknown, roleId: string) {
  if (!Array.isArray(values) || values.length > MAX_NEURAL_PERSONA_LEARNING_PROPOSALS) return null;
  const proposals = values.map((value) => normalizeProposal(value, roleId));
  if (proposals.some((proposal) => !proposal)) return null;
  const resolved = proposals as NeuralPersonaLearningProposal[];
  return new Set(resolved.map((proposal) => proposal.proposalId)).size === resolved.length
    ? resolved : null;
}

function recoverySnapshots(value: unknown) {
  if (!Array.isArray(value) || value.length > 5) return null;
  const snapshots: NeuralPersonaLearningProposalRecoverySnapshot[] = [];
  for (const item of value) {
    if (!isObject(item) || item.reason !== 'before-update' || !safeTime(item.createdAt)
      || !text(item.snapshotId, 128) || typeof item.serializedProposals !== 'string') return null;
    snapshots.push(item as unknown as NeuralPersonaLearningProposalRecoverySnapshot);
  }
  return snapshots;
}

export function createImmutableNeuralPersonaLearningProposalRecord(
  record: NeuralPersonaLearningProposalRecord,
) {
  const proposals = record.proposals.map((proposal) => Object.freeze({
    ...proposal,
    deltas: Object.freeze({ ...proposal.deltas }),
    signal: Object.freeze({ ...proposal.signal }),
    sourceEventIds: Object.freeze([...proposal.sourceEventIds]) as string[],
  }));
  return Object.freeze({
    ...record,
    proposals: Object.freeze(proposals) as NeuralPersonaLearningProposal[],
    recoverySnapshots: Object.freeze(record.recoverySnapshots.map((item) => (
      Object.freeze({ ...item })
    ))) as NeuralPersonaLearningProposalRecoverySnapshot[],
  });
}

export function serializeNeuralPersonaLearningProposalRecord(
  record: NeuralPersonaLearningProposalRecord,
) {
  return JSON.stringify(record);
}

export function parseNeuralPersonaLearningProposalRecord(
  serialized: string,
): NeuralPersonaLearningProposalParseResult {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch {
    return { reason: 'invalid-json', status: 'corrupt' };
  }
  if (!isObject(value) || value.formatVersion !== NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION) {
    return { reason: 'unsupported-learning-proposal-record', status: 'corrupt' };
  }
  const roleId = normalizeNeuralPersonaRoleId(value.roleId);
  const snapshots = recoverySnapshots(value.recoverySnapshots);
  if (!roleId || !snapshots || !safeTime(value.revision) || !safeTime(value.updatedAt)) {
    return { reason: 'learning-proposal-metadata-invalid', status: 'corrupt' };
  }
  const proposals = normalizeNeuralPersonaLearningProposals(value.proposals, roleId);
  if (!proposals) return { reason: 'learning-proposal-data-invalid', status: 'corrupt' };
  return {
    record: createImmutableNeuralPersonaLearningProposalRecord({
      formatVersion: NEURAL_PERSONA_LEARNING_PROPOSAL_FORMAT_VERSION,
      proposals, recoverySnapshots: snapshots, revision: value.revision as number,
      roleId, updatedAt: value.updatedAt as number,
    }),
    status: 'ok',
  };
}
