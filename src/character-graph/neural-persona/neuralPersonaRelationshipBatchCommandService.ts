import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import type {
  CommitNeuralPersonaRelationshipCandidatesCommand,
  NeuralPersonaRelationshipBatchCommandResult,
} from './neuralPersonaRelationshipBatchCommandTypes';
import {
  NEURAL_PERSONA_RELATIONSHIP_CANDIDATE_VERSION,
  type NeuralPersonaRelationshipCandidate,
} from './neuralPersonaRelationshipCandidateTypes';
import { validateNeuralPersonaRelationshipCandidate } from './neuralPersonaRelationshipCandidates';
import { neuralPersonaRelationshipKey } from './neuralPersonaRelationshipKeys';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaEdge,
  type NeuralPersonaGraphSnapshot,
} from './neuralPersonaTypes';

function validateCommand(
  command: CommitNeuralPersonaRelationshipCandidatesCommand,
  graph: NeuralPersonaGraphSnapshot,
) {
  if (!command.commandId.trim() || !command.reviewerId.trim()) {
    return 'relationship-command-envelope-invalid';
  }
  if (command.batch.version !== NEURAL_PERSONA_RELATIONSHIP_CANDIDATE_VERSION
    || command.batch.roleId !== command.roleId
    || command.batch.revision !== command.expectedRevision
    || command.batch.graphVersion !== graph.graphVersion) {
    return 'relationship-candidate-batch-stale';
  }
  const selected = command.batch.candidates.filter((candidate) => candidate.enabled);
  if (!selected.length || selected.length > 30) return 'relationship-candidate-selection-invalid';
  const issue = selected.map((candidate) => (
    validateNeuralPersonaRelationshipCandidate(candidate, graph.nodes)
  )).find(Boolean);
  if (issue) return issue;
  const keys = selected.map(neuralPersonaRelationshipKey);
  if (new Set(keys).size !== keys.length) return 'relationship-candidate-duplicate';
  const existing = new Set(graph.edges.map(neuralPersonaRelationshipKey));
  if (keys.some((candidateKey) => existing.has(candidateKey))) {
    return 'relationship-edge-already-exists';
  }
  return null;
}

function createEdges(
  command: CommitNeuralPersonaRelationshipCandidatesCommand,
  timestamp: number,
) {
  return command.batch.candidates.filter((candidate) => candidate.enabled)
    .map((candidate, index): NeuralPersonaEdge => ({
      confidence: candidate.confidence,
      createdAt: timestamp,
      edgeId: `cognitive:${command.batch.batchId}:${candidate.candidateId || index + 1}`,
      lastReinforcedAt: undefined,
      ownerRoleId: command.roleId,
      relationType: candidate.relationType,
      schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
      sourceNodeId: candidate.sourceNodeId,
      targetNodeId: candidate.targetNodeId,
      updatedAt: timestamp,
      weight: candidate.weight,
    }));
}

async function commit(options: {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}, command: CommitNeuralPersonaRelationshipCandidatesCommand): Promise<NeuralPersonaRelationshipBatchCommandResult> {
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const issue = validateCommand(command, loaded.record.graph);
  if (issue) return { reason: issue, status: 'invalid' };
  const timestamp = options.now();
  const revision = command.expectedRevision + 1;
  const edges = createEdges(command, timestamp);
  const result = await options.repository.transact({
    expectedRevision: command.expectedRevision,
    roleId: command.roleId,
    update: (graph) => ({
      ...graph, edges: [...graph.edges, ...edges], graphVersion: `neural-graph.r${revision}`,
    }),
  });
  if (result.status !== 'ok') return result;
  return {
    receipt: {
      appliedRevision: result.record.revision, batchId: command.batch.batchId,
      commandId: command.commandId, generatedEdgeIds: edges.map((edge) => edge.edgeId),
      reviewerId: command.reviewerId, roleId: command.roleId, timestamp,
    },
    record: result.record, status: 'ok',
  };
}

export function createNeuralPersonaRelationshipBatchCommandService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}) {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return {
    commitCandidates: (command: CommitNeuralPersonaRelationshipCandidatesCommand) => (
      commit(resolved, command)
    ),
  };
}
