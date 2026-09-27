import { retrieveNeuralPersonaCandidates } from './neuralPersonaCandidateRetriever';
import type { NeuralPersonaCandidate } from './neuralPersonaCandidateTypes';
import { resolveNeuralPersonaCandidateConflicts } from './neuralPersonaConflictResolver';
import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import { propagateNeuralPersonaCandidates } from './neuralPersonaPropagation';
import { createNeuralPersonaTagIndex } from './neuralPersonaTagIndex';
import {
  NEURAL_CONTEXT_CONTRIBUTION_VERSION,
  type NeuralContextContribution,
  type NeuralContextInfluence,
  type NeuralPersonaContextInput,
  type NeuralPersonaTrace,
} from './neuralPersonaTypes';

export interface NeuralPersonaContextAdapterResult {
  contribution: NeuralContextContribution;
  trace: NeuralPersonaTrace;
}

function estimateInfluenceTokens(influence: NeuralContextInfluence) {
  return Math.max(1, Math.ceil((influence.summary.length + 40) / 2));
}

function createInfluence(candidate: ReturnType<typeof retrieveNeuralPersonaCandidates>[number]) {
  return {
    confidence: candidate.node.confidence,
    intensity: candidate.score.total,
    nodeId: candidate.node.nodeId,
    reason: candidate.reason,
    summary: candidate.node.influenceSummary,
    type: candidate.node.type,
  } satisfies NeuralContextInfluence;
}

function applyTokenBudget(influences: NeuralContextInfluence[], maxTokenBudget: number) {
  const selected: NeuralContextInfluence[] = [];
  let tokenBudgetUsed = 0;
  for (const influence of influences) {
    const estimatedTokens = estimateInfluenceTokens(influence);
    if (tokenBudgetUsed + estimatedTokens > maxTokenBudget) continue;
    selected.push(influence);
    tokenBudgetUsed += estimatedTokens;
  }
  return { selected, tokenBudgetUsed };
}

export function buildNeuralContextContribution(options: {
  config: NeuralPersonaConfig;
  input: NeuralPersonaContextInput;
  seedCandidates?: NeuralPersonaCandidate[];
  store: ReadonlyNeuralPersonaGraphStore;
}): NeuralPersonaContextAdapterResult {
  const seeds = options.seedCandidates ?? retrieveNeuralPersonaCandidates({
    ...options,
    tagIndex: createNeuralPersonaTagIndex(options.store),
  });
  const propagated = propagateNeuralPersonaCandidates({ ...options, seeds });
  const resolved = resolveNeuralPersonaCandidateConflicts(
    propagated.candidates,
    options.config.maxSelectedNodes,
  );
  const budgeted = applyTokenBudget(resolved.selected.map(createInfluence), options.config.maxTokenBudget);
  const selectedIds = new Set(budgeted.selected.map((influence) => influence.nodeId));
  const filteredNodeIds = [...new Set([
    ...resolved.filteredNodeIds,
    ...resolved.selected.filter((candidate) => !selectedIds.has(candidate.node.nodeId))
      .map((candidate) => candidate.node.nodeId),
    ...propagated.suppressedNodeIds,
  ])].sort();
  const traceId = `neural:${options.input.requestId}`;
  return {
    contribution: {
      generatedAt: options.input.now,
      influences: budgeted.selected,
      requestId: options.input.requestId,
      roleId: options.input.roleId,
      tokenBudgetUsed: budgeted.tokenBudgetUsed,
      traceId,
      turnId: options.input.turnId,
      version: NEURAL_CONTEXT_CONTRIBUTION_VERSION,
    },
    trace: {
      candidateNodeIds: seeds.map((candidate) => candidate.node.nodeId),
      configVersion: options.config.configVersion,
      createdAt: options.input.now,
      filteredNodeIds,
      graphVersion: options.store.snapshot().graphVersion,
      requestId: options.input.requestId,
      roleId: options.input.roleId,
      selectedNodeIds: budgeted.selected.map((influence) => influence.nodeId),
      traceId,
      turnId: options.input.turnId,
    },
  };
}
