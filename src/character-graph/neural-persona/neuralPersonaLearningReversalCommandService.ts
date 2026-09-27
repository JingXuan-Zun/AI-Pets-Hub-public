import {
  findNeuralPersonaLearningApplicationMarker,
  findNeuralPersonaLearningProposal,
  updateNeuralPersonaLearningProposal,
} from './neuralPersonaLearningApplicationState';
import type { NeuralPersonaLearningProposalRepository } from './neuralPersonaLearningProposalRepository';
import type {
  NeuralPersonaLearningProposal,
  NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';
import type {
  NeuralPersonaLearningReversalResult,
  ReverseNeuralPersonaLearningProposalCommand,
} from './neuralPersonaLearningReversalCommandTypes';
import {
  createNeuralPersonaLearningReversalReceipt,
  getNeuralPersonaLearningReversalIssue,
  matchesNeuralPersonaLearningReversalMarker,
  reverseNeuralPersonaLearningProposalInGraph,
} from './neuralPersonaLearningReversalState';
import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';
import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import type { NeuralPersonaLearningApplicationMarker } from './neuralPersonaTypes';

interface ReversalOptions {
  graphRepository: NeuralPersonaGraphRepository;
  now: () => number;
  proposalRepository: NeuralPersonaLearningProposalRepository;
}

export interface NeuralPersonaLearningReversalCommandService {
  reverse: (
    command: ReverseNeuralPersonaLearningProposalCommand,
  ) => Promise<NeuralPersonaLearningReversalResult>;
}

function conflict(scope: 'graph' | 'proposal', actualRevision: number | null) {
  return { actualRevision, conflictScope: scope, status: 'conflict' as const };
}

function commandIssue(command: ReverseNeuralPersonaLearningProposalCommand) {
  const text = [command.commandId, command.proposalId, command.reversedBy, command.roleId];
  if (!text.every((value) => value.trim() && value.length <= 128)) {
    return 'learning-reversal-command-invalid';
  }
  return [command.expectedGraphRevision, command.expectedProposalRevision]
    .every((value) => Number.isSafeInteger(value) && value >= 0)
    ? null : 'learning-reversal-revision-invalid';
}

async function reserveReversal(
  options: ReversalOptions,
  command: ReverseNeuralPersonaLearningProposalCommand,
  record: NeuralPersonaLearningProposalRecord,
) {
  if (record.proposals.some((item) => item.status === 'reversing')) {
    return { reason: 'another-learning-reversal-in-progress', status: 'invalid' as const };
  }
  const reversalStartedAt = options.now();
  const written = await options.proposalRepository.transact({
    expectedRevision: record.revision, roleId: command.roleId,
    update: (items) => updateNeuralPersonaLearningProposal(
      items, command.proposalId, (proposal) => ({
        ...proposal, reversalCommandId: command.commandId, reversalStartedAt,
        reversedBy: command.reversedBy, status: 'reversing',
      }),
    ),
  });
  return written.status === 'conflict' ? { ...written, conflictScope: 'proposal' as const } : written;
}

function clearReversalState(proposal: NeuralPersonaLearningProposal) {
  const { reversalCommandId: _commandId, reversalStartedAt: _startedAt,
    reversedBy: _reversedBy, ...rest } = proposal;
  return { ...rest, status: 'applied' as const };
}

async function releaseReversal(
  options: ReversalOptions,
  roleId: string,
  proposalId: string,
  reversedBy: string,
) {
  const loaded = await options.proposalRepository.load(roleId);
  if (loaded.status !== 'ok') return;
  const proposal = findNeuralPersonaLearningProposal(loaded.record, proposalId);
  if (proposal?.status !== 'reversing' || proposal.reversedBy !== reversedBy) return;
  await options.proposalRepository.transact({
    expectedRevision: loaded.record.revision, roleId,
    update: (items) => updateNeuralPersonaLearningProposal(
      items, proposalId, clearReversalState,
    ),
  });
}

async function finalizeReversal(
  options: ReversalOptions,
  command: ReverseNeuralPersonaLearningProposalCommand,
  graphRecord: NeuralPersonaPersistedRecord,
  marker: NeuralPersonaLearningApplicationMarker,
): Promise<NeuralPersonaLearningReversalResult> {
  const loaded = await options.proposalRepository.load(command.roleId);
  if (loaded.status !== 'ok') return loaded.status === 'missing'
    ? { reason: 'learning-proposal-record-missing', status: 'missing' } : loaded;
  const proposal = findNeuralPersonaLearningProposal(loaded.record, command.proposalId);
  if (!proposal) return { reason: 'learning-proposal-missing', status: 'missing' };
  if (!matchesNeuralPersonaLearningReversalMarker(marker, proposal)
    || marker.reversedBy !== command.reversedBy) {
    return { reason: 'learning-reversal-marker-mismatch', status: 'invalid' };
  }
  const receipt = () => createNeuralPersonaLearningReversalReceipt(
    command, proposal, marker, loaded.record.revision,
  );
  if (proposal.status === 'reversed') {
    return { graphRecord, proposalRecord: loaded.record, receipt: receipt(), status: 'idempotent' };
  }
  if (proposal.status !== 'reversing') {
    return { reason: 'learning-proposal-not-reversing', status: 'invalid' };
  }
  const written = await options.proposalRepository.transact({
    expectedRevision: loaded.record.revision, roleId: command.roleId,
    update: (items) => updateNeuralPersonaLearningProposal(
      items, proposal.proposalId, (item) => ({
        ...item, reversedAt: marker.reversedAt,
        reversedGraphRevision: marker.reversalGraphRevision, status: 'reversed',
      }),
    ),
  });
  if (written.status === 'conflict') return { ...written, conflictScope: 'proposal' };
  if (written.status !== 'ok') return written;
  const reversed = findNeuralPersonaLearningProposal(written.record, proposal.proposalId) ?? proposal;
  return { graphRecord, proposalRecord: written.record,
    receipt: createNeuralPersonaLearningReversalReceipt(
      command, reversed, marker, written.record.revision,
    ), status: 'ok' };
}

async function commitGraphReversal(
  options: ReversalOptions,
  command: ReverseNeuralPersonaLearningProposalCommand,
  proposal: NeuralPersonaLearningProposal,
) {
  const reversedAt = options.now();
  const targetRevision = command.expectedGraphRevision + 1;
  const written = await options.graphRepository.transact({
    expectedRevision: command.expectedGraphRevision, roleId: command.roleId,
    update: (graph) => reverseNeuralPersonaLearningProposalInGraph(
      graph, proposal, targetRevision, reversedAt,
    ),
  });
  if (written.status === 'ok') {
    const marker = findNeuralPersonaLearningApplicationMarker(written.record, proposal);
    if (!marker) return { reason: 'learning-reversal-marker-missing', status: 'invalid' as const };
    return finalizeReversal(options, command, written.record, marker);
  }
  if (written.status !== 'conflict') {
    await releaseReversal(options, command.roleId, proposal.proposalId, command.reversedBy);
    return written;
  }
  const latest = await options.graphRepository.load(command.roleId);
  if (latest.status === 'ok') {
    const marker = findNeuralPersonaLearningApplicationMarker(latest.record, proposal);
    if (marker && matchesNeuralPersonaLearningReversalMarker(marker, proposal)) {
      return finalizeReversal(options, command, latest.record, marker);
    }
  }
  await releaseReversal(options, command.roleId, proposal.proposalId, command.reversedBy);
  return conflict('graph', written.actualRevision);
}

async function executeReversal(
  options: ReversalOptions,
  command: ReverseNeuralPersonaLearningProposalCommand,
): Promise<NeuralPersonaLearningReversalResult> {
  const issue = commandIssue(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const [graph, proposals] = await Promise.all([
    options.graphRepository.load(command.roleId),
    options.proposalRepository.load(command.roleId),
  ]);
  if (graph.status !== 'ok') return graph.status === 'missing'
    ? { reason: 'graph-record-missing', status: 'missing' } : graph;
  if (proposals.status !== 'ok') return proposals.status === 'missing'
    ? { reason: 'learning-proposal-record-missing', status: 'missing' } : proposals;
  const proposal = findNeuralPersonaLearningProposal(proposals.record, command.proposalId);
  if (!proposal) return { reason: 'learning-proposal-missing', status: 'missing' };
  const marker = findNeuralPersonaLearningApplicationMarker(graph.record, proposal);
  if (marker && matchesNeuralPersonaLearningReversalMarker(marker, proposal)) {
    return finalizeReversal(options, command, graph.record, marker);
  }
  if (graph.record.revision !== command.expectedGraphRevision) {
    return conflict('graph', graph.record.revision);
  }
  if (proposals.record.revision !== command.expectedProposalRevision) {
    return conflict('proposal', proposals.record.revision);
  }
  const node = graph.record.graph.nodes.find((item) => item.nodeId === proposal.nodeId);
  const reversalIssue = getNeuralPersonaLearningReversalIssue(command, proposal, node);
  if (reversalIssue) return { reason: reversalIssue, status: 'invalid' };
  if (proposal.status === 'applied') {
    const reserved = await reserveReversal(options, command, proposals.record);
    if (reserved.status !== 'ok') return reserved;
    const reservedProposal = findNeuralPersonaLearningProposal(reserved.record, proposal.proposalId);
    if (!reservedProposal) return { reason: 'learning-proposal-missing', status: 'missing' };
    return commitGraphReversal(options, command, reservedProposal);
  }
  if (proposal.reversedBy !== command.reversedBy) {
    return { reason: 'learning-reversal-actor-mismatch', status: 'invalid' };
  }
  return commitGraphReversal(options, command, proposal);
}

export function createNeuralPersonaLearningReversalCommandService(options: {
  graphRepository: NeuralPersonaGraphRepository;
  now?: () => number;
  proposalRepository: NeuralPersonaLearningProposalRepository;
}): NeuralPersonaLearningReversalCommandService {
  const resolved = { ...options, now: options.now ?? Date.now };
  return { reverse: (command) => executeReversal(resolved, command) };
}
