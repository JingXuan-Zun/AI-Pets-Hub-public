import type { NeuralPersonaReinforcementLedgerRepository } from './neuralPersonaFeedbackRepository';
import type {
  ApplyNeuralPersonaLearningProposalCommand,
  NeuralPersonaLearningApplicationResult,
} from './neuralPersonaLearningApplicationCommandTypes';
import {
  applyNeuralPersonaLearningProposalToGraph,
  createNeuralPersonaLearningApplicationReceipt,
  findNeuralPersonaLearningApplicationMarker,
  findNeuralPersonaLearningProposal,
  getNeuralPersonaLearningApplicabilityIssue,
  matchesNeuralPersonaLearningApplicationMarker,
  updateNeuralPersonaLearningProposal,
} from './neuralPersonaLearningApplicationState';
import type { NeuralPersonaLearningProposalRepository } from './neuralPersonaLearningProposalRepository';
import type {
  NeuralPersonaLearningProposal,
  NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';
import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';
import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import type { NeuralPersonaLearningApplicationMarker } from './neuralPersonaTypes';
interface ApplicationOptions {
  graphRepository: NeuralPersonaGraphRepository;
  ledgerRepository: NeuralPersonaReinforcementLedgerRepository;
  now: () => number;
  proposalRepository: NeuralPersonaLearningProposalRepository;
}
export interface NeuralPersonaLearningApplicationCommandService {
  apply: (
    command: ApplyNeuralPersonaLearningProposalCommand,
  ) => Promise<NeuralPersonaLearningApplicationResult>;
}
function conflict(scope: 'graph' | 'ledger' | 'proposal', actualRevision: number | null) {
  return { actualRevision, conflictScope: scope, status: 'conflict' as const };
}
function commandIssue(command: ApplyNeuralPersonaLearningProposalCommand) {
  if (![command.appliedBy, command.commandId, command.proposalId, command.roleId]
    .every((value) => value.trim()) || command.appliedBy.length > 128
    || command.commandId.length > 128 || command.proposalId.length > 128) {
    return 'learning-application-command-invalid';
  }
  const revisions = [command.expectedGraphRevision, command.expectedLedgerRevision,
    command.expectedProposalRevision];
  return revisions.every((value) => Number.isSafeInteger(value) && value >= 0)
    ? null : 'learning-application-revision-invalid';
}

async function reserveApplication(
  options: ApplicationOptions,
  command: ApplyNeuralPersonaLearningProposalCommand,
  record: NeuralPersonaLearningProposalRecord,
) {
  if (record.proposals.some((item) => item.status === 'applying')) {
    return { reason: 'another-learning-application-in-progress', status: 'invalid' as const };
  }
  const startedAt = options.now();
  const written = await options.proposalRepository.transact({
    expectedRevision: record.revision, roleId: command.roleId,
    update: (items) => updateNeuralPersonaLearningProposal(
      items, command.proposalId, (proposal) => ({
      ...proposal, appliedBy: command.appliedBy, applicationCommandId: command.commandId,
      applicationStartedAt: startedAt, status: 'applying',
    })),
  });
  return written.status === 'conflict' ? { ...written, conflictScope: 'proposal' as const } : written;
}

async function releaseApplication(
  options: ApplicationOptions,
  roleId: string,
  proposalId: string,
  appliedBy: string,
) {
  const loaded = await options.proposalRepository.load(roleId);
  if (loaded.status !== 'ok') return;
  const proposal = findNeuralPersonaLearningProposal(loaded.record, proposalId);
  if (proposal?.status !== 'applying' || proposal.appliedBy !== appliedBy) return;
  await options.proposalRepository.transact({
    expectedRevision: loaded.record.revision, roleId,
    update: (items) => updateNeuralPersonaLearningProposal(items, proposalId, (item) => {
      const { appliedBy: _appliedBy, applicationCommandId: _commandId,
        applicationStartedAt: _startedAt, ...rest } = item;
      return { ...rest, status: 'accepted' };
    }),
  });
}

async function finalizeApplication(
  options: ApplicationOptions,
  command: ApplyNeuralPersonaLearningProposalCommand,
  graphRecord: NeuralPersonaPersistedRecord,
  marker: NeuralPersonaLearningApplicationMarker,
): Promise<NeuralPersonaLearningApplicationResult> {
  const loaded = await options.proposalRepository.load(command.roleId);
  if (loaded.status !== 'ok') return loaded.status === 'missing'
    ? { reason: 'learning-proposal-record-missing', status: 'missing' } : loaded;
  const proposal = findNeuralPersonaLearningProposal(loaded.record, command.proposalId);
  if (!proposal) return { reason: 'learning-proposal-missing', status: 'missing' };
  if (!matchesNeuralPersonaLearningApplicationMarker(marker, proposal)
    || marker.appliedBy !== command.appliedBy) {
    return { reason: 'learning-application-marker-mismatch', status: 'invalid' };
  }
  if (proposal.status === 'applied') {
    return { graphRecord, proposalRecord: loaded.record,
      receipt: createNeuralPersonaLearningApplicationReceipt(
        command, proposal, marker, loaded.record.revision,
      ), status: 'idempotent' };
  }
  if (!['accepted', 'applying'].includes(proposal.status)) {
    return { reason: 'learning-proposal-not-applicable', status: 'invalid' };
  }
  const written = await options.proposalRepository.transact({
    expectedRevision: loaded.record.revision, roleId: command.roleId,
    update: (items) => updateNeuralPersonaLearningProposal(
      items, proposal.proposalId, (item) => ({
      ...item, appliedAt: marker.appliedAt, appliedBy: marker.appliedBy,
      appliedGraphRevision: marker.targetGraphRevision,
      applicationCommandId: marker.commandId,
      applicationStartedAt: item.applicationStartedAt ?? marker.appliedAt, status: 'applied',
    })),
  });
  if (written.status === 'conflict') return { ...written, conflictScope: 'proposal' };
  if (written.status !== 'ok') return written;
  const applied = findNeuralPersonaLearningProposal(written.record, proposal.proposalId) ?? proposal;
  return { graphRecord, proposalRecord: written.record,
    receipt: createNeuralPersonaLearningApplicationReceipt(
      command, applied, marker, written.record.revision,
    ), status: 'ok' };
}

async function commitGraphApplication(
  options: ApplicationOptions,
  command: ApplyNeuralPersonaLearningProposalCommand,
  proposal: NeuralPersonaLearningProposal,
) {
  const appliedAt = options.now();
  const written = await options.graphRepository.transact({
    expectedRevision: proposal.observedGraphRevision, roleId: command.roleId,
    update: (graph) => applyNeuralPersonaLearningProposalToGraph(
      graph, proposal, command.appliedBy, appliedAt,
    ),
  });
  if (written.status === 'ok') {
    const marker = findNeuralPersonaLearningApplicationMarker(written.record, proposal);
    if (!marker) return { reason: 'learning-application-marker-missing', status: 'invalid' as const };
    return finalizeApplication(options, command, written.record, marker);
  }
  if (written.status !== 'conflict') {
    await releaseApplication(options, command.roleId, proposal.proposalId, command.appliedBy);
    return written;
  }
  const latest = await options.graphRepository.load(command.roleId);
  if (latest.status === 'ok') {
    const marker = findNeuralPersonaLearningApplicationMarker(latest.record, proposal);
    if (marker) return finalizeApplication(options, command, latest.record, marker);
  }
  await releaseApplication(options, command.roleId, proposal.proposalId, command.appliedBy);
  return { ...written, conflictScope: 'graph' as const };
}

async function executeApply(
  options: ApplicationOptions,
  command: ApplyNeuralPersonaLearningProposalCommand,
): Promise<NeuralPersonaLearningApplicationResult> {
  const issue = commandIssue(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const [graph, ledger, proposals] = await Promise.all([
    options.graphRepository.load(command.roleId), options.ledgerRepository.load(command.roleId),
    options.proposalRepository.load(command.roleId),
  ]);
  if (graph.status !== 'ok') return graph.status === 'missing'
    ? { reason: 'graph-record-missing', status: 'missing' } : graph;
  if (ledger.status !== 'ok') return ledger.status === 'missing'
    ? { reason: 'feedback-record-missing', status: 'missing' } : ledger;
  if (proposals.status !== 'ok') return proposals.status === 'missing'
    ? { reason: 'learning-proposal-record-missing', status: 'missing' } : proposals;
  const proposal = findNeuralPersonaLearningProposal(proposals.record, command.proposalId);
  if (!proposal) return { reason: 'learning-proposal-missing', status: 'missing' };
  const marker = findNeuralPersonaLearningApplicationMarker(graph.record, proposal);
  if (marker) return finalizeApplication(options, command, graph.record, marker);
  if (graph.record.revision !== command.expectedGraphRevision) return conflict('graph', graph.record.revision);
  if (ledger.record.revision !== command.expectedLedgerRevision) return conflict('ledger', ledger.record.revision);
  if (proposals.record.revision !== command.expectedProposalRevision) return conflict('proposal', proposals.record.revision);
  if (proposal.observedGraphRevision !== graph.record.revision
    || proposal.observedLedgerRevision !== ledger.record.revision) {
    if (proposal.status === 'applying') {
      await releaseApplication(options, command.roleId, proposal.proposalId, command.appliedBy);
    }
    return { reason: 'learning-application-source-stale', status: 'invalid' };
  }
  const node = graph.record.graph.nodes.find((item) => item.nodeId === proposal.nodeId);
  const applicability = getNeuralPersonaLearningApplicabilityIssue(
    command, proposal, node, options.now(),
  );
  if (applicability) return { reason: applicability, status: 'invalid' };
  if (proposal.status === 'accepted') {
    const reserved = await reserveApplication(options, command, proposals.record);
    if (reserved.status !== 'ok') return reserved;
    const reservedProposal = findNeuralPersonaLearningProposal(
      reserved.record, proposal.proposalId,
    );
    if (!reservedProposal) return { reason: 'learning-proposal-missing', status: 'missing' };
    return commitGraphApplication(options, command, reservedProposal);
  }
  return commitGraphApplication(options, command, proposal);
}

export function createNeuralPersonaLearningApplicationCommandService(options: {
  graphRepository: NeuralPersonaGraphRepository;
  ledgerRepository: NeuralPersonaReinforcementLedgerRepository;
  now?: () => number;
  proposalRepository: NeuralPersonaLearningProposalRepository;
}): NeuralPersonaLearningApplicationCommandService {
  const resolved = { ...options, now: options.now ?? Date.now };
  return { apply: (command) => executeApply(resolved, command) };
}
