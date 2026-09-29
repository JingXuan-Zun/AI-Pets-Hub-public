import type { NeuralPersonaGraphRepository } from './neuralPersonaRepository';
import {
  isNeuralPersonaAnchorNode,
  neuralPersonaAnchorNodeId,
} from './neuralPersonaAnchor';
import { validateNeuralPersonaNodeGenerationCandidate } from './neuralPersonaNodeGeneration';
import { generatedCandidateNodeId } from './neuralPersonaGeneratedCandidatePreview';
import {
  assembleNodeBatchGraph,
  prepareNodeBatchContent,
} from './neuralPersonaNodeBatchGraphPreparation';
import type { NeuralPersonaNodeGenerationCandidate } from './neuralPersonaNodeGenerationTypes';
import { NEURAL_PERSONA_NODE_GENERATION_VERSION } from './neuralPersonaNodeGenerationTypes';
import type {
  CommitNeuralPersonaGeneratedNodesCommand,
  NeuralPersonaNodeBatchCommandResult,
} from './neuralPersonaNodeBatchCommandTypes';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
  type NeuralPersonaTag,
} from './neuralPersonaTypes';

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

function tagId(label: string) {
  return `generated:${normalized(label).replace(/\s+/gu, '-').slice(0, 80)}`;
}

function tags(candidate: NeuralPersonaNodeGenerationCandidate, command: {
  reviewerId: string;
  timestamp: number;
}): NeuralPersonaTag[] {
  const labels = new Map<string, string>();
  candidate.tags.forEach((label) => labels.set(tagId(label), label.trim()));
  return [...labels].map(([canonicalId, label]) => ({
    canonicalId, confidence: candidate.confidence, label,
    reviewedAt: command.timestamp, reviewerId: command.reviewerId,
    source: 'system', status: 'active',
  }));
}

function createNode(options: {
  batchId: string;
  candidate: NeuralPersonaNodeGenerationCandidate;
  reviewerId: string;
  roleId: string;
  timestamp: number;
}): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: options.candidate.baseWeight,
    confidence: options.candidate.confidence, createdAt: options.timestamp,
    currentActivation: 0, decayRate: 0.02,
    influenceSummary: options.candidate.influenceSummary.trim(),
    nodeId: generatedCandidateNodeId(options.batchId, options.candidate.candidateId),
    ownerRoleId: options.roleId,
    plasticity: 0.2, protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private', stability: 0.8,
    status: 'active', tags: tags(options.candidate, options),
    type: options.candidate.type, updatedAt: options.timestamp,
  };
}

function validateCommand(command: CommitNeuralPersonaGeneratedNodesCommand) {
  if (!command.commandId.trim() || !command.batch.batchId.trim()
    || command.batch.batchId.length > 128) return 'generated-node-command-invalid';
  if (!command.batch.personaName.trim() || command.batch.personaName.length > 160) {
    return 'generated-node-persona-name-invalid';
  }
  if (!command.roleId.trim() || command.batch.roleId !== command.roleId) return 'generated-node-role-mismatch';
  if (!command.reviewerId.trim() || command.reviewerId.length > 128) {
    return 'generated-node-reviewer-missing';
  }
  if (command.batch.version !== NEURAL_PERSONA_NODE_GENERATION_VERSION) {
    return 'generated-node-batch-version-invalid';
  }
  if (typeof command.batch.sourceText !== 'string' || command.batch.sourceText.length < 10) {
    return 'generated-node-source-invalid';
  }
  if (command.expectedRevision !== null && (!Number.isInteger(command.expectedRevision)
    || command.expectedRevision < 0)) return 'expected-revision-invalid';
  const selected = command.batch.candidates.filter((candidate) => candidate.enabled);
  if (!selected.length) return 'generated-node-selection-invalid';
  const issue = selected.map((candidate) => (
    validateNeuralPersonaNodeGenerationCandidate(candidate, command.batch.sourceText)
  )).find(Boolean);
  if (issue) return issue;
  const summaries = selected.map((candidate) => normalized(candidate.influenceSummary));
  if (new Set(summaries).size !== summaries.length) return 'generated-node-summary-duplicate';
  return null;
}

function prepareBatchGraph(options: {
  command: CommitNeuralPersonaGeneratedNodesCommand;
  current?: NeuralPersonaGraphSnapshot;
  revision: number;
  timestamp: number;
}) {
  const content = prepareNodeBatchContent({
    command: options.command, current: options.current, timestamp: options.timestamp,
    createNode: (candidate) => createNode({
      batchId: options.command.batch.batchId, candidate,
      reviewerId: options.command.reviewerId.trim(), roleId: options.command.roleId,
      timestamp: options.timestamp,
    }),
  });
  const assembled = assembleNodeBatchGraph({ ...options, content });
  if (assembled.issue) return {
    anchor: content.anchor, issue: assembled.issue, newNodes: content.newNodes,
    reused: content.reused,
  } as const;
  return {
    ...assembled, anchor: content.anchor, newNodes: content.newNodes,
    reused: content.reused,
  } as const;
}

function changedExistingNodes(before: NeuralPersonaNode[], after: NeuralPersonaNode[]) {
  return after.some((node, index) => node !== before[index]);
}

function successfulBatchResult(options: {
  command: CommitNeuralPersonaGeneratedNodesCommand;
  prepared: Extract<ReturnType<typeof prepareBatchGraph>, { graph: NeuralPersonaGraphSnapshot }>;
  record: Extract<NeuralPersonaNodeBatchCommandResult, { status: 'ok' }>['record'];
  timestamp: number;
}): NeuralPersonaNodeBatchCommandResult {
  return {
    receipt: {
      appliedRevision: options.record.revision, batchId: options.command.batch.batchId,
      commandId: options.command.commandId,
      generatedBranchNodeIds: options.prepared.hierarchy.branchNodes.map((node) => node.nodeId),
      generatedEdgeIds: options.prepared.hierarchy.generatedEdges.map((edge) => edge.edgeId),
      generatedSemanticEdgeIds: options.prepared.relationships.edges.map((edge) => edge.edgeId),
      generatedNodeIds: options.prepared.newNodes.map((node) => node.nodeId),
      personaAnchorNodeId: options.prepared.anchor.nodeId,
      reusedNodeIds: options.prepared.reused.map((node) => node.nodeId),
      roleId: options.command.roleId, timestamp: options.timestamp,
    },
    record: options.record, status: 'ok',
  };
}

async function commitBatch(options: {
  now: () => number;
  repository: NeuralPersonaGraphRepository;
}, command: CommitNeuralPersonaGeneratedNodesCommand): Promise<NeuralPersonaNodeBatchCommandResult> {
  const issue = validateCommand(command);
  if (issue) return { reason: issue, status: 'invalid' };
  const loaded = await options.repository.load(command.roleId);
  if (loaded.status === 'corrupt') return loaded;
  if (loaded.status === 'missing' && command.expectedRevision !== null) {
    return { actualRevision: null, status: 'conflict' };
  }
  if (loaded.status === 'ok' && loaded.record.revision !== command.expectedRevision) {
    return { actualRevision: loaded.record.revision, status: 'conflict' };
  }
  const current = loaded.status === 'ok' ? loaded.record.graph : undefined;
  const anchorId = neuralPersonaAnchorNodeId(command.roleId);
  if (current?.nodes.some((node) => node.nodeId === anchorId && !isNeuralPersonaAnchorNode(node))) {
    return { reason: 'persona-anchor-id-conflict', status: 'invalid' };
  }
  const timestamp = options.now();
  const revision = loaded.status === 'ok' ? loaded.record.revision + 1 : 0;
  const prepared = prepareBatchGraph({ command, current, revision, timestamp });
  if (!('graph' in prepared)) return { reason: prepared.issue, status: 'invalid' };
  const changed = prepared.newNodes.length || prepared.hierarchy.branchNodes.length
    || prepared.hierarchy.generatedEdges.length || prepared.relationships.edges.length
    || prepared.hierarchy.removedEdgeIds.length
    || !current || changedExistingNodes(current.nodes, prepared.updatedExisting);
  if (!changed) return { reason: 'generated-node-already-exists', status: 'invalid' };
  const result = loaded.status === 'ok'
    ? await options.repository.transact({
      expectedRevision: loaded.record.revision, roleId: command.roleId,
      update: () => prepared.graph,
    })
    : await options.repository.initialize(prepared.graph);
  if (result.status !== 'ok') return result;
  return successfulBatchResult({ command, prepared, record: result.record, timestamp });
}

export function createNeuralPersonaNodeBatchCommandService(options: {
  now?: () => number;
  repository: NeuralPersonaGraphRepository;
}) {
  const resolved = { now: options.now ?? Date.now, repository: options.repository };
  return { commitGeneratedNodes: (command: CommitNeuralPersonaGeneratedNodesCommand) => (
    commitBatch(resolved, command)
  ) };
}
