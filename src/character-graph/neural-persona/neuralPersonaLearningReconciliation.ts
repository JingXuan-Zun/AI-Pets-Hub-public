import {
  findNeuralPersonaLearningApplicationMarker,
  matchesNeuralPersonaLearningApplicationMarker,
} from './neuralPersonaLearningApplicationState';
import type {
  NeuralPersonaLearningProposal,
  NeuralPersonaLearningProposalRecord,
} from './neuralPersonaLearningProposalTypes';
import {
  hasNeuralPersonaLearningValueSnapshots,
  matchesNeuralPersonaLearningReversalMarker,
  neuralPersonaLearningValuesMatch,
} from './neuralPersonaLearningReversalState';
import type { NeuralPersonaPersistedRecord } from './neuralPersonaPersistenceTypes';

export type NeuralPersonaLearningReconciliationStatus =
  | 'consistent-applied'
  | 'consistent-reversed'
  | 'legacy-marker-unverifiable'
  | 'marker-mismatch'
  | 'marker-missing'
  | 'node-missing'
  | 'reversal-pending-finalization'
  | 'reversal-ready-to-resume'
  | 'values-modified';

export interface NeuralPersonaLearningReconciliationFinding {
  nodeId: string;
  proposalId: string;
  proposalStatus: NeuralPersonaLearningProposal['status'];
  status: NeuralPersonaLearningReconciliationStatus;
}

function inspectProposal(
  graph: NeuralPersonaPersistedRecord,
  proposal: NeuralPersonaLearningProposal,
): NeuralPersonaLearningReconciliationFinding {
  const finding = (status: NeuralPersonaLearningReconciliationStatus) => ({
    nodeId: proposal.nodeId, proposalId: proposal.proposalId,
    proposalStatus: proposal.status, status,
  });
  const node = graph.graph.nodes.find((item) => item.nodeId === proposal.nodeId);
  if (!node) return finding('node-missing');
  const marker = findNeuralPersonaLearningApplicationMarker(graph, proposal);
  if (!marker) return finding(node.learningApplication ? 'marker-mismatch' : 'marker-missing');
  if (!matchesNeuralPersonaLearningApplicationMarker(marker, proposal)) {
    return finding('marker-mismatch');
  }
  if (!hasNeuralPersonaLearningValueSnapshots(marker)) {
    return finding('legacy-marker-unverifiable');
  }
  const reversed = matchesNeuralPersonaLearningReversalMarker(marker, proposal);
  if (proposal.status === 'reversed') {
    return finding(reversed && neuralPersonaLearningValuesMatch(node, marker.previousValues)
      ? 'consistent-reversed' : 'marker-mismatch');
  }
  if (proposal.status === 'reversing' && reversed) {
    return finding(neuralPersonaLearningValuesMatch(node, marker.previousValues)
      ? 'reversal-pending-finalization' : 'values-modified');
  }
  if (!neuralPersonaLearningValuesMatch(node, marker.appliedValues)) {
    return finding('values-modified');
  }
  return finding(proposal.status === 'reversing'
    ? 'reversal-ready-to-resume' : 'consistent-applied');
}

export function inspectNeuralPersonaLearningReconciliation(
  graph: NeuralPersonaPersistedRecord,
  proposals: NeuralPersonaLearningProposalRecord,
) {
  const applicable = proposals.proposals.filter((proposal) => (
    ['applied', 'reversed', 'reversing'].includes(proposal.status)
  ));
  const findings = applicable.map((proposal) => inspectProposal(graph, proposal));
  return {
    findings,
    graphRevision: graph.revision,
    healthy: findings.every((finding) => [
      'consistent-applied', 'consistent-reversed',
    ].includes(finding.status)),
    proposalRevision: proposals.revision,
    roleId: graph.roleId,
  };
}
