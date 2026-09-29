import type {
  NeuralPersonaLearningReversalReceipt,
  ReverseNeuralPersonaLearningProposalCommand,
} from './neuralPersonaLearningReversalCommandTypes';
import type { NeuralPersonaLearningProposal } from './neuralPersonaLearningProposalTypes';
import type {
  NeuralPersonaGraphSnapshot,
  NeuralPersonaLearningApplicationMarker,
  NeuralPersonaLearningValues,
  NeuralPersonaNode,
} from './neuralPersonaTypes';
import { matchesNeuralPersonaLearningApplicationMarker } from './neuralPersonaLearningApplicationState';

export function hasNeuralPersonaLearningValueSnapshots(
  marker: NeuralPersonaLearningApplicationMarker,
): marker is NeuralPersonaLearningApplicationMarker & {
  appliedValues: NeuralPersonaLearningValues;
  previousValues: NeuralPersonaLearningValues;
} {
  return Boolean(marker.appliedValues && marker.previousValues);
}

export function neuralPersonaLearningValuesMatch(
  node: NeuralPersonaNode,
  values: NeuralPersonaLearningValues,
) {
  return node.baseWeight === values.baseWeight
    && node.confidence === values.confidence
    && node.stability === values.stability;
}

export function matchesNeuralPersonaLearningReversalMarker(
  marker: NeuralPersonaLearningApplicationMarker,
  proposal: NeuralPersonaLearningProposal,
) {
  return matchesNeuralPersonaLearningApplicationMarker(marker, proposal)
    && Boolean(proposal.reversalCommandId
      && marker.reversalCommandId === proposal.reversalCommandId
      && marker.reversedBy === proposal.reversedBy
      && marker.reversedAt !== undefined
      && marker.reversalGraphRevision !== undefined);
}

export function reverseNeuralPersonaLearningProposalInGraph(
  graph: NeuralPersonaGraphSnapshot,
  proposal: NeuralPersonaLearningProposal,
  graphRevision: number,
  reversedAt: number,
) {
  const updateNode = (node: NeuralPersonaNode) => {
    if (node.nodeId !== proposal.nodeId || !node.learningApplication
      || !hasNeuralPersonaLearningValueSnapshots(node.learningApplication)) return node;
    const marker: NeuralPersonaLearningApplicationMarker = {
      ...node.learningApplication,
      reversalCommandId: proposal.reversalCommandId,
      reversalGraphRevision: graphRevision,
      reversedAt,
      reversedBy: proposal.reversedBy,
    };
    return { ...node, ...marker.previousValues, learningApplication: marker, updatedAt: reversedAt };
  };
  return { ...graph, graphVersion: `neural-graph.r${graphRevision}`,
    nodes: graph.nodes.map(updateNode) };
}

export function createNeuralPersonaLearningReversalReceipt(
  command: ReverseNeuralPersonaLearningProposalCommand,
  proposal: NeuralPersonaLearningProposal,
  marker: NeuralPersonaLearningApplicationMarker,
  proposalRevision: number,
): NeuralPersonaLearningReversalReceipt {
  return {
    applicationCommandId: marker.commandId, commandId: command.commandId,
    deltas: { ...proposal.deltas }, nodeId: proposal.nodeId,
    proposalId: proposal.proposalId, proposalRevision,
    reversalCommandId: marker.reversalCommandId ?? command.commandId,
    reversedAt: marker.reversedAt ?? 0, reversedBy: marker.reversedBy ?? command.reversedBy,
    reversedGraphRevision: marker.reversalGraphRevision ?? 0,
    roleId: command.roleId,
  };
}

export function getNeuralPersonaLearningReversalIssue(
  command: ReverseNeuralPersonaLearningProposalCommand,
  proposal: NeuralPersonaLearningProposal,
  node: NeuralPersonaNode | undefined,
) {
  if (!node) return 'learning-reversal-node-missing';
  const marker = node.learningApplication;
  if (!marker) return 'learning-reversal-application-marker-missing';
  if (!matchesNeuralPersonaLearningApplicationMarker(marker, proposal)) {
    return 'learning-reversal-application-marker-mismatch';
  }
  if (!hasNeuralPersonaLearningValueSnapshots(marker)) {
    return 'learning-reversal-legacy-marker-unverifiable';
  }
  if (!neuralPersonaLearningValuesMatch(node, marker.appliedValues)) {
    return 'learning-reversal-values-modified';
  }
  if ((node.protected || proposal.protectedNode) && !command.confirmProtectedNode) {
    return 'learning-reversal-protected-confirmation-required';
  }
  return ['applied', 'reversing'].includes(proposal.status)
    ? null : 'learning-proposal-not-reversible';
}
