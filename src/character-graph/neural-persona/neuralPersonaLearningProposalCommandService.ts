import type { NeuralPersonaReinforcementLedgerRepository } from './neuralPersonaFeedbackRepository';
import {
  generateNeuralPersonaLearningProposal,
} from './neuralPersonaLearningProposalGenerator';
import type { NeuralPersonaLearningProposalRepository } from './neuralPersonaLearningProposalRepository';
import type {
  GenerateNeuralPersonaLearningProposalCommand,
  NeuralPersonaLearningProposalCommandReceipt,
  NeuralPersonaLearningProposalCommandResult,
  ReviewNeuralPersonaLearningProposalCommand,
} from './neuralPersonaLearningProposalCommandTypes';
import {
  MAX_NEURAL_PERSONA_LEARNING_PROPOSALS,
  type NeuralPersonaLearningProposal,
  type NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';
import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';

interface CommandOptions {
  graphRepository: NeuralPersonaGraphRepository;
  ledgerRepository: NeuralPersonaReinforcementLedgerRepository;
  now: () => number;
  proposalRepository: NeuralPersonaLearningProposalRepository;
}

export interface NeuralPersonaLearningProposalCommandService {
  generate: (
    command: GenerateNeuralPersonaLearningProposalCommand,
  ) => Promise<NeuralPersonaLearningProposalCommandResult>;
  review: (
    command: ReviewNeuralPersonaLearningProposalCommand,
  ) => Promise<NeuralPersonaLearningProposalCommandResult>;
}

function conflict(scope: 'graph' | 'ledger' | 'proposal', actualRevision: number | null) {
  return { actualRevision, conflictScope: scope, status: 'conflict' as const };
}

function validRevision(value: number | null, nullable = false) {
  return (nullable && value === null) || (Number.isSafeInteger(value) && Number(value) >= 0);
}

function generateIssue(command: GenerateNeuralPersonaLearningProposalCommand) {
  if (![command.commandId, command.nodeId, command.roleId].every((value) => value.trim())) {
    return 'learning-proposal-command-invalid';
  }
  if (!validRevision(command.expectedGraphRevision)
    || !validRevision(command.expectedLedgerRevision)
    || !validRevision(command.expectedProposalRevision, true)
    || !validRevision(command.createdAt) || !validRevision(command.projectedAt)) {
    return 'learning-proposal-command-revision-invalid';
  }
  return null;
}

function sameProposal(left: NeuralPersonaLearningProposal, right: NeuralPersonaLearningProposal) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function receipt(input: {
  commandId: string;
  commandType: NeuralPersonaLearningProposalCommandReceipt['commandType'];
  decision?: 'accept' | 'reject';
  proposalId: string;
  proposalRevision: number;
  resultingStatus: NeuralPersonaLearningProposal['status'];
  roleId: string;
  timestamp: number;
}): NeuralPersonaLearningProposalCommandReceipt {
  return { ...input };
}

async function ensureProposalRecord(
  options: CommandOptions,
  command: GenerateNeuralPersonaLearningProposalCommand,
) {
  const loaded = await options.proposalRepository.load(command.roleId);
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.status === 'ok') return loaded;
  if (command.expectedProposalRevision !== null) {
    return { reason: 'learning-proposal-record-missing', status: 'missing' as const };
  }
  const initialized = await options.proposalRepository.initialize(command.roleId);
  if (initialized.status === 'ok') return initialized;
  if (initialized.status !== 'conflict') return initialized;
  const latest = await options.proposalRepository.load(command.roleId);
  return latest.status === 'missing'
    ? conflict('proposal', null)
    : latest;
}

function duplicateResult(
  command: GenerateNeuralPersonaLearningProposalCommand,
  record: NeuralPersonaLearningProposalRecord,
  proposal: NeuralPersonaLearningProposal,
  now: number,
): NeuralPersonaLearningProposalCommandResult | null {
  const duplicate = record.proposals.find((item) => item.proposalId === proposal.proposalId);
  if (!duplicate) return null;
  if (!sameProposal(duplicate, proposal)) {
    return { reason: 'learning-proposal-id-collision', status: 'invalid' };
  }
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'generate-learning-proposal',
      proposalId: proposal.proposalId, proposalRevision: record.revision,
      resultingStatus: duplicate.status, roleId: command.roleId, timestamp: now }),
    record,
    status: 'idempotent',
  };
}

function hasDuplicateEvidence(
  record: NeuralPersonaLearningProposalRecord,
  proposal: NeuralPersonaLearningProposal,
) {
  return record.proposals.some((item) => item.nodeId === proposal.nodeId
    && item.observedGraphRevision === proposal.observedGraphRevision
    && item.observedLedgerRevision === proposal.observedLedgerRevision
    && item.sourceEventIds.length === proposal.sourceEventIds.length
    && item.sourceEventIds.every((eventId, index) => eventId === proposal.sourceEventIds[index]));
}

async function loadGenerationSources(
  options: CommandOptions,
  command: GenerateNeuralPersonaLearningProposalCommand,
) {
  const [graph, ledger] = await Promise.all([
    options.graphRepository.load(command.roleId),
    options.ledgerRepository.load(command.roleId),
  ]);
  if (graph.status !== 'ok') return graph.status === 'missing'
    ? { reason: 'graph-record-missing', status: 'missing' as const } : graph;
  if (ledger.status !== 'ok') return ledger.status === 'missing'
    ? { reason: 'feedback-record-missing', status: 'missing' as const } : ledger;
  if (graph.record.revision !== command.expectedGraphRevision) {
    return conflict('graph', graph.record.revision);
  }
  if (ledger.record.revision !== command.expectedLedgerRevision) {
    return conflict('ledger', ledger.record.revision);
  }
  return { graph: graph.record, ledger: ledger.record, status: 'ok' as const };
}

async function executeGenerate(
  options: CommandOptions,
  command: GenerateNeuralPersonaLearningProposalCommand,
): Promise<NeuralPersonaLearningProposalCommandResult> {
  const issue = generateIssue(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const sources = await loadGenerationSources(options, command);
  if (sources.status !== 'ok') return sources;
  const generated = generateNeuralPersonaLearningProposal({
    createdAt: command.createdAt, graph: sources.graph.graph,
    graphRevision: sources.graph.revision, ledger: sources.ledger,
    nodeId: command.nodeId, projectedAt: command.projectedAt,
    proposalId: command.commandId,
  });
  if (generated.status !== 'ok') return generated;
  const proposals = await ensureProposalRecord(options, command);
  if (proposals.status !== 'ok') return proposals.status === 'conflict'
    ? { ...proposals, conflictScope: 'proposal' } : proposals;
  const duplicate = duplicateResult(command, proposals.record, generated.proposal, options.now());
  if (duplicate) return duplicate;
  if (hasDuplicateEvidence(proposals.record, generated.proposal)) {
    return { reason: 'learning-proposal-evidence-already-proposed', status: 'invalid' };
  }
  if (command.expectedProposalRevision === null && proposals.record.revision !== 0) {
    return conflict('proposal', proposals.record.revision);
  }
  if (command.expectedProposalRevision !== null
    && proposals.record.revision !== command.expectedProposalRevision) {
    return conflict('proposal', proposals.record.revision);
  }
  if (proposals.record.proposals.length >= MAX_NEURAL_PERSONA_LEARNING_PROPOSALS) {
    return { reason: 'learning-proposal-limit-exceeded', status: 'invalid' };
  }
  const written = await options.proposalRepository.transact({
    expectedRevision: proposals.record.revision, roleId: command.roleId,
    update: (items) => [...items, generated.proposal],
  });
  if (written.status === 'conflict') return { ...written, conflictScope: 'proposal' };
  if (written.status !== 'ok') return written;
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'generate-learning-proposal',
      proposalId: command.commandId, proposalRevision: written.record.revision,
      resultingStatus: 'pending-review', roleId: command.roleId, timestamp: options.now() }),
    record: written.record,
    status: 'ok',
  };
}

function reviewIssue(command: ReviewNeuralPersonaLearningProposalCommand) {
  if (![command.commandId, command.proposalId, command.reviewerId, command.roleId]
    .every((value) => value.trim()) || command.reviewerId.length > 128
    || !validRevision(command.expectedProposalRevision)
    || !['accept', 'reject'].includes(command.decision)) return 'learning-proposal-review-invalid';
  return null;
}

async function executeReview(
  options: CommandOptions,
  command: ReviewNeuralPersonaLearningProposalCommand,
): Promise<NeuralPersonaLearningProposalCommandResult> {
  const issue = reviewIssue(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const loaded = await options.proposalRepository.load(command.roleId);
  if (loaded.status !== 'ok') return loaded.status === 'missing'
    ? { reason: 'learning-proposal-record-missing', status: 'missing' } : loaded;
  if (loaded.record.revision !== command.expectedProposalRevision) {
    return conflict('proposal', loaded.record.revision);
  }
  const proposal = loaded.record.proposals.find((item) => item.proposalId === command.proposalId);
  if (!proposal) return { reason: 'learning-proposal-missing', status: 'missing' };
  const status = command.decision === 'accept' ? 'accepted' as const : 'rejected' as const;
  if (proposal.status !== 'pending-review') {
    return proposal.status === status && proposal.reviewerId === command.reviewerId
      ? { receipt: receipt({ commandId: command.commandId,
        commandType: 'review-learning-proposal', decision: command.decision,
        proposalId: proposal.proposalId, proposalRevision: loaded.record.revision,
        resultingStatus: status, roleId: command.roleId, timestamp: options.now() }),
      record: loaded.record, status: 'idempotent' }
      : { reason: 'learning-proposal-not-pending', status: 'invalid' };
  }
  if (status === 'accepted' && proposal.protectedNode && !command.confirmProtectedNode) {
    return { reason: 'protected-node-confirmation-required', status: 'invalid' };
  }
  const timestamp = options.now();
  const written = await options.proposalRepository.transact({
    expectedRevision: loaded.record.revision, roleId: command.roleId,
    update: (items) => items.map((item) => item.proposalId === command.proposalId
      ? { ...item, protectedReviewConfirmed: command.confirmProtectedNode || undefined,
        reviewedAt: timestamp, reviewerId: command.reviewerId, status } : item),
  });
  if (written.status === 'conflict') return { ...written, conflictScope: 'proposal' };
  if (written.status !== 'ok') return written;
  return {
    receipt: receipt({ commandId: command.commandId, commandType: 'review-learning-proposal',
      decision: command.decision, proposalId: command.proposalId,
      proposalRevision: written.record.revision, resultingStatus: status,
      roleId: command.roleId, timestamp }),
    record: written.record,
    status: 'ok',
  };
}

export function createNeuralPersonaLearningProposalCommandService(options: {
  graphRepository: NeuralPersonaGraphRepository;
  ledgerRepository: NeuralPersonaReinforcementLedgerRepository;
  now?: () => number;
  proposalRepository: NeuralPersonaLearningProposalRepository;
}): NeuralPersonaLearningProposalCommandService {
  const resolved = { ...options, now: options.now ?? Date.now };
  return {
    generate: (command) => executeGenerate(resolved, command),
    review: (command) => executeReview(resolved, command),
  };
}
