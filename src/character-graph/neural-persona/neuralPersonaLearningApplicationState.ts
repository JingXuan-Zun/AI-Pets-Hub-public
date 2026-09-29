import type {
  ApplyNeuralPersonaLearningProposalCommand,
  NeuralPersonaLearningApplicationReceipt,
} from './neuralPersonaLearningApplicationCommandTypes';
import type {
  NeuralPersonaLearningProposal,
  NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';
import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';
import type {
  NeuralPersonaGraphSnapshot,
  NeuralPersonaLearningApplicationMarker,
  NeuralPersonaLearningValues,
  NeuralPersonaNode,
} from './neuralPersonaTypes';

function learningValues(node: NeuralPersonaNode): NeuralPersonaLearningValues {
  return {
    baseWeight: node.baseWeight,
    confidence: node.confidence,
    stability: node.stability,
  };
}

function addLearningDeltas(
  values: NeuralPersonaLearningValues,
  proposal: NeuralPersonaLearningProposal,
): NeuralPersonaLearningValues {
  return {
    baseWeight: Math.round((values.baseWeight + proposal.deltas.baseWeight) * 1e6) / 1e6,
    confidence: Math.round((values.confidence + proposal.deltas.confidence) * 1e6) / 1e6,
    stability: Math.round((values.stability + proposal.deltas.stability) * 1e6) / 1e6,
  };
}

export function findNeuralPersonaLearningProposal(
  record: NeuralPersonaLearningProposalRecord,
  proposalId: string,
) {
  return record.proposals.find((item) => item.proposalId === proposalId);
}

export function updateNeuralPersonaLearningProposal(
  proposals: NeuralPersonaLearningProposal[],
  proposalId: string,
  update: (proposal: NeuralPersonaLearningProposal) => NeuralPersonaLearningProposal,
) {
  return proposals.map((proposal) => proposal.proposalId === proposalId
    ? update(proposal) : proposal);
}

export function findNeuralPersonaLearningApplicationMarker(
  record: NeuralPersonaPersistedRecord,
  proposal: NeuralPersonaLearningProposal,
) {
  return record.graph.nodes.find(
    (node) => node.nodeId === proposal.nodeId
      && node.learningApplication?.proposalId === proposal.proposalId,
  )?.learningApplication;
}

export function matchesNeuralPersonaLearningApplicationMarker(
  marker: NeuralPersonaLearningApplicationMarker,
  proposal: NeuralPersonaLearningProposal,
) {
  return marker.proposalId === proposal.proposalId
    && (!proposal.applicationCommandId || marker.commandId === proposal.applicationCommandId)
    && marker.sourceGraphRevision === proposal.observedGraphRevision
    && marker.sourceLedgerRevision === proposal.observedLedgerRevision
    && marker.targetGraphRevision === proposal.observedGraphRevision + 1;
}

export function createNeuralPersonaLearningApplicationReceipt(
  command: ApplyNeuralPersonaLearningProposalCommand,
  proposal: NeuralPersonaLearningProposal,
  marker: NeuralPersonaLearningApplicationMarker,
  proposalRevision: number,
): NeuralPersonaLearningApplicationReceipt {
  return {
    appliedAt: marker.appliedAt, appliedBy: marker.appliedBy,
    appliedGraphRevision: marker.targetGraphRevision,
    applicationCommandId: marker.commandId, commandId: command.commandId,
    deltas: { ...proposal.deltas }, nodeId: proposal.nodeId,
    proposalId: proposal.proposalId, proposalRevision, roleId: proposal.roleId,
    sourceGraphRevision: proposal.observedGraphRevision,
    sourceLedgerRevision: proposal.observedLedgerRevision,
  };
}

export function applyNeuralPersonaLearningProposalToGraph(
  graph: NeuralPersonaGraphSnapshot,
  proposal: NeuralPersonaLearningProposal,
  appliedBy: string,
  appliedAt: number,
) {
  const targetRevision = proposal.observedGraphRevision + 1;
  const updateNode = (node: NeuralPersonaNode) => {
    if (node.nodeId !== proposal.nodeId) return node;
    const previousValues = learningValues(node);
    const appliedValues = addLearningDeltas(previousValues, proposal);
    const marker: NeuralPersonaLearningApplicationMarker = {
      appliedAt, appliedBy, appliedValues,
      commandId: proposal.applicationCommandId ?? proposal.proposalId,
      previousValues, proposalId: proposal.proposalId,
      sourceGraphRevision: proposal.observedGraphRevision,
      sourceLedgerRevision: proposal.observedLedgerRevision,
      targetGraphRevision: targetRevision,
    };
    return { ...node, ...appliedValues, learningApplication: marker, updatedAt: appliedAt };
  };
  return { ...graph, graphVersion: `neural-graph.r${targetRevision}`,
    nodes: graph.nodes.map(updateNode) };
}

export function getNeuralPersonaLearningApplicabilityIssue(
  command: ApplyNeuralPersonaLearningProposalCommand,
  proposal: NeuralPersonaLearningProposal,
  node: NeuralPersonaNode | undefined,
  now: number,
) {
  if (!node) return 'learning-application-node-missing';
  if (node.status !== 'active') return 'learning-application-node-not-active';
  if (node.expiresAt !== undefined && node.expiresAt <= now) {
    return 'learning-application-node-expired';
  }
  if ((node.protected || proposal.protectedNode) && !command.confirmProtectedNode) {
    return 'learning-application-protected-confirmation-required';
  }
  if (proposal.status === 'applying' && proposal.appliedBy !== command.appliedBy) {
    return 'learning-application-actor-mismatch';
  }
  return ['accepted', 'applying'].includes(proposal.status)
    ? null : 'learning-proposal-not-applicable';
}
