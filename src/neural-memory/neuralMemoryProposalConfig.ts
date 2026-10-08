import type { PetConfig } from '../types';
import {
  NEURAL_MEMORY_PROPOSAL_MAX_PENDING_PER_ROLE,
  normalizedMemoryText,
  type NeuralMemoryProposal,
} from './neuralMemoryProposalTypes';

export function listNeuralMemoryProposals(config: PetConfig, roleId?: string) {
  const proposals = config.neuralMemoryProposals ?? [];
  return roleId ? proposals.filter((proposal) => proposal.roleId === roleId) : proposals;
}

export function appendNeuralMemoryProposals(
  config: PetConfig,
  incoming: NeuralMemoryProposal[],
): PetConfig {
  if (!incoming.length) return config;
  const existing = listNeuralMemoryProposals(config);
  const fingerprints = new Set(existing.map((proposal) => (
    `${proposal.roleId}\u0000${normalizedMemoryText(proposal.content)}`
  )));
  const fresh = incoming.filter((proposal) => {
    const key = `${proposal.roleId}\u0000${normalizedMemoryText(proposal.content)}`;
    if (fingerprints.has(key)) return false;
    fingerprints.add(key);
    return true;
  });
  if (!fresh.length) return config;
  const merged = [...existing, ...fresh];
  // Keep only the newest pending proposals per role.
  const keptIds = new Set<string>();
  const countByRole = new Map<string, number>();
  [...merged].sort((left, right) => right.createdAt - left.createdAt).forEach((proposal) => {
    const count = countByRole.get(proposal.roleId) ?? 0;
    if (count >= NEURAL_MEMORY_PROPOSAL_MAX_PENDING_PER_ROLE) return;
    countByRole.set(proposal.roleId, count + 1);
    keptIds.add(proposal.id);
  });
  return { ...config, neuralMemoryProposals: merged.filter((proposal) => keptIds.has(proposal.id)) };
}

export function removeNeuralMemoryProposal(config: PetConfig, proposalId: string): PetConfig {
  const existing = listNeuralMemoryProposals(config);
  if (!existing.some((proposal) => proposal.id === proposalId)) return config;
  return { ...config, neuralMemoryProposals: existing.filter((proposal) => proposal.id !== proposalId) };
}
