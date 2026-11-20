import { createNeuralPersonaEdgeCommandService, createNeuralPersonaNodeCommandService, type NeuralPersonaNodeCommandResult } from '../character-graph/neural-persona';
import { createNeuralMemoryRepository } from '../neural-memory/neuralMemoryStaging';
import type { NeuralMemoryProposal } from '../neural-memory/neuralMemoryProposalTypes';
import { GROWTH_NODE_TYPES, GROWTH_TAG } from './growthRules';
import { updateGrowthState } from './growthStore';

// An approved growth becomes part of her at once (the user already approved it): an active node
// tagged 成长, with a "supports" link from every memory behind it, and she knows she changed.

let sequence = 0;
const commandId = (kind: string) => { sequence += 1; return `growth:${kind}:${Date.now()}:${sequence}`; };

export async function applyGrowthProposal(proposal: NeuralMemoryProposal, content: string, repository = createNeuralMemoryRepository(), now = Date.now()): Promise<NeuralPersonaNodeCommandResult> {
  const growth = proposal.growth;
  if (!growth) return { reason: 'not-growth', status: 'invalid' };
  const loaded = await repository.load(proposal.roleId);
  if (loaded.status !== 'ok') return loaded.status === 'missing' ? { reason: 'record-missing', status: 'missing' } : loaded;
  const nodeId = `growth-${proposal.id}`;
  const created = await createNeuralPersonaNodeCommandService({ repository }).createNode({
    commandId: commandId('create'),
    expectedRevision: loaded.record.revision,
    node: {
      baseWeight: 0.7, confidence: 0.85, decayRate: 0.005,
      influenceSummary: content.trim(),
      nodeId,
      plasticity: 0.2, protected: false,
      retrievalSummary: proposal.reason || undefined,
      scope: 'private', stability: 0.8,
      status: 'active',
      tags: [GROWTH_TAG],
      type: GROWTH_NODE_TYPES[growth.kind],
    },
    roleId: proposal.roleId,
  });
  if (created.status !== 'ok') return created;
  let record = created.record;
  const existing = new Set(record.graph.nodes.map((node) => node.nodeId));
  const edges = createNeuralPersonaEdgeCommandService({ repository });
  for (const evidenceId of growth.evidenceNodeIds.filter((id) => existing.has(id))) {
    const linked = await edges.createEdge({
      commandId: commandId('link'),
      edge: { confidence: 0.85, edgeId: `${nodeId}<-${evidenceId}`, relationType: 'supports', sourceNodeId: evidenceId, targetNodeId: nodeId, weight: 0.7 },
      expectedRevision: record.revision,
      roleId: proposal.roleId,
    });
    // A link that fails leaves the growth itself in place; it just shows fewer reasons.
    if (linked.status === 'ok') record = linked.record;
  }
  updateGrowthState(proposal.roleId, (state) => ({ ...state, approved: [...state.approved, { approvedAt: now, kind: growth.kind, text: content.trim() }] }), now);
  return { ...created, record };
}
