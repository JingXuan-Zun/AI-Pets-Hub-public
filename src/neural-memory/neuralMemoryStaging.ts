import {
  createNeuralPersonaDesktopStorage,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  DEFAULT_NEURAL_PERSONA_CONFIG,
  isNeuralPersonaStructuralNode,
  type NeuralPersonaGraphRepository,
  type NeuralPersonaNode,
  type NeuralPersonaNodeCommandResult,
} from '../character-graph/neural-persona';
import type { NeuralMemoryProposal } from './neuralMemoryProposalTypes';

/**
 * Approved memories are written as 'pending-review' nodes: the access policy
 * keeps them out of chat activation until the user organizes them in the
 * settings graph and marks them active.
 */
export const NEURAL_MEMORY_STAGED_STATUS = 'pending-review' as const;
export const NEURAL_MEMORY_SOURCE_PREFIX = 'chat-memory:';

export function createNeuralMemoryRepository(): NeuralPersonaGraphRepository {
  return createNeuralPersonaGraphRepository({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    storage: createNeuralPersonaDesktopStorage(),
  });
}

// Any pending-review node counts as staged: the node editor may clear sourceRef
// for non-reference types, so the chat source prefix cannot be relied on.
export function isNeuralMemoryStagedNode(node: NeuralPersonaNode) {
  return node.status === NEURAL_MEMORY_STAGED_STATUS;
}

/** Content memories the character already holds, used to avoid duplicate proposals. */
export async function loadNeuralMemorySummaries(
  roleId: string,
  repository = createNeuralMemoryRepository(),
) {
  const loaded = await repository.load(roleId);
  if (loaded.status !== 'ok') return [];
  return loaded.record.graph.nodes
    .filter((node) => node.status !== 'deleted' && !isNeuralPersonaStructuralNode(node)
      && node.type !== 'persona-anchor')
    .map((node) => node.influenceSummary);
}

let commandSequence = 0;
function commandId(kind: string) {
  commandSequence += 1;
  return `neural-memory:${kind}:${Date.now()}:${commandSequence}`;
}

async function loadOrInitialize(roleId: string, repository: NeuralPersonaGraphRepository) {
  const loaded = await repository.load(roleId);
  if (loaded.status !== 'missing') return loaded;
  const service = createNeuralPersonaNodeCommandService({ repository });
  await service.initializeGraph({ commandId: commandId('initialize'), roleId });
  return repository.load(roleId);
}

export async function stageNeuralMemoryProposal(
  proposal: NeuralMemoryProposal,
  content: string,
  repository = createNeuralMemoryRepository(),
): Promise<NeuralPersonaNodeCommandResult> {
  const loaded = await loadOrInitialize(proposal.roleId, repository);
  if (loaded.status === 'missing') return { reason: 'record-missing', status: 'missing' };
  if (loaded.status === 'corrupt') return loaded;
  const service = createNeuralPersonaNodeCommandService({ repository });
  return service.createNode({
    commandId: commandId('stage'),
    expectedRevision: loaded.record.revision,
    roleId: proposal.roleId,
    node: {
      baseWeight: 0.6,
      confidence: 0.8,
      decayRate: 0.02,
      influenceSummary: content.trim(),
      nodeId: `memory-${proposal.id}`,
      plasticity: 0.3,
      protected: false,
      retrievalSummary: proposal.sourceExcerpt || undefined,
      scope: 'private',
      sourceRef: `${NEURAL_MEMORY_SOURCE_PREFIX}${proposal.sourceMessageIds[0] ?? proposal.id}`,
      stability: 0.6,
      status: NEURAL_MEMORY_STAGED_STATUS,
      tags: [],
      type: proposal.type,
    },
  });
}
