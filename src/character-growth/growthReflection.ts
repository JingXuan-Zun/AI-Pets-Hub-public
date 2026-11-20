import { createNeuralMemoryRepository } from '../neural-memory/neuralMemoryStaging';
import { listNeuralMemoryProposals } from '../neural-memory/neuralMemoryProposalConfig';
import type { NeuralMemoryProposal } from '../neural-memory/neuralMemoryProposalTypes';
import { getDesktopPetSlot } from '../multiPetRoster';
import { readPersonaMode } from '../personaMode';
import type { PetConfig } from '../types';
import {
  buildGrowthReflectionPrompt,
  GROWTH_NODE_TYPES,
  growthSourceMemories,
  isGrowthNode,
  parseGrowthReflection,
  shouldReflect,
} from './growthRules';
import { proposalsThisWeek, readGrowthState, updateGrowthState } from './growthStore';

// One look back over her approved memories: does anything amount to a new like, view or habit?
// Returns proposals for the approval sidebar (nothing is written to her graph here).

const MODEL_TIMEOUT_MS = 60_000;
let sequence = 0;

export type GrowthReflectionResult =
  | { proposals: NeuralMemoryProposal[]; status: 'proposed' }
  | { reason: string; status: 'nothing' | 'skipped' };

export async function reflectGrowth(options: { config: PetConfig; force?: boolean; now?: number; roleId: string }): Promise<GrowthReflectionResult> {
  const now = options.now ?? Date.now();
  const slot = getDesktopPetSlot(options.config, options.roleId);
  if (!slot) return { reason: '没有这个角色', status: 'skipped' };
  if (readPersonaMode(slot.personality) !== 'memory') return { reason: '她用的是人格提示词，成长只在知识记忆人格里', status: 'skipped' };
  const loaded = await createNeuralMemoryRepository().load(options.roleId);
  if (loaded.status !== 'ok') return { reason: '她还没有知识记忆图谱', status: 'skipped' };
  const graph = loaded.record.graph;
  const memories = growthSourceMemories(graph);
  const state = readGrowthState(options.roleId);
  const due = shouldReflect({
    force: options.force, lastReflectionAt: state.lastReflectionAt, newMemoryCount: memories.length - state.memoryCountAtReflection,
    now, proposedThisWeek: proposalsThisWeek(state, now),
  });
  if (!due.ok) return { reason: due.reason, status: 'skipped' };
  if (memories.length < 2) return { reason: '记忆太少，还长不出什么', status: 'nothing' };

  const prompt = buildGrowthReflectionPrompt({
    existingGrowth: graph.nodes.filter((node) => isGrowthNode(node) && node.status !== 'deleted').map((node) => node.influenceSummary),
    memories,
    pending: listNeuralMemoryProposals(options.config, options.roleId).filter((proposal) => proposal.growth).map((proposal) => proposal.content),
    persona: slot.personality.systemInstruction,
    roleName: slot.personality.name,
  });
  const { getConfiguredCognitionResponse } = await import('../services/geminiService');
  const output = await getConfiguredCognitionResponse(prompt.payload, prompt.systemInstruction, options.config.settings, { task: 'memory-retrieval', timeoutMs: MODEL_TIMEOUT_MS });
  const drafts = parseGrowthReflection(output, new Set(memories.map((node) => node.nodeId)));
  updateGrowthState(options.roleId, (current) => ({
    ...current,
    lastReflectionAt: now,
    memoryCountAtReflection: memories.length,
    proposedAt: [...current.proposedAt, ...drafts.map(() => now)],
  }), now);
  if (!drafts.length) return { reason: '回顾了一下，这次没有新的成长', status: 'nothing' };
  return {
    proposals: drafts.map((draft) => {
      sequence += 1;
      return {
        content: draft.text,
        createdAt: now,
        growth: { evidenceNodeIds: draft.evidence, kind: draft.kind },
        id: `growth-${now.toString(36)}-${sequence}`,
        reason: draft.why,
        roleId: options.roleId,
        sourceExcerpt: '',
        sourceMessageIds: [],
        type: GROWTH_NODE_TYPES[draft.kind] as NeuralMemoryProposal['type'],
      };
    }),
    status: 'proposed',
  };
}
