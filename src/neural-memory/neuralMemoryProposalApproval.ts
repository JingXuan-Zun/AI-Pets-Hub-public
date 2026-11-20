import { addSharedUserMemoryItem, listSharedUserMemory, updateSharedUserMemoryItem } from '../character-memory/sharedUserMemory';
import { applyGrowthProposal } from '../character-growth/growthApply';
import type { PetConfig } from '../types';
import { removeNeuralMemoryProposal } from './neuralMemoryProposalConfig';
import type { NeuralMemoryProposal } from './neuralMemoryProposalTypes';
import { stageNeuralMemoryProposal } from './neuralMemoryStaging';

// Approving a memory proposal — the same whether the user clicks 记住 in the chat window or
// answers her spoken question ("好" / "记住吧", 2026-11-20). Returns the config without the
// proposal (null when nothing changed) and a plain-language result.

export type ProposalApprovalOutcome =
  | { config: PetConfig; message: string; ok: true }
  | { config: null; message: string; ok: false };

export async function approveNeuralMemoryProposal(config: PetConfig, proposal: NeuralMemoryProposal, content: string): Promise<ProposalApprovalOutcome> {
  if (proposal.scope === 'shared') {
    const withoutProposal = removeNeuralMemoryProposal(config, proposal.id);
    const replaced = proposal.replacesSharedId && listSharedUserMemory(withoutProposal).some((item) => item.id === proposal.replacesSharedId);
    return {
      config: replaced
        ? updateSharedUserMemoryItem(withoutProposal, proposal.replacesSharedId as string, content)
        : addSharedUserMemoryItem(withoutProposal, { kind: proposal.sharedKind, text: content }),
      message: '已记到「关于你」，所有角色都会知道。',
      ok: true,
    };
  }
  // A growth she proposed (src/character-growth) is part of her at once; a memory is active at once too.
  const result = proposal.growth ? await applyGrowthProposal(proposal, content) : await stageNeuralMemoryProposal(proposal, content);
  // A repeated approval (another window, a retried click) already wrote this proposal.
  const alreadyThere = result.status === 'invalid' && result.reason === 'node-already-exists';
  if (result.status === 'ok' || alreadyThere) {
    return {
      config: removeNeuralMemoryProposal(config, proposal.id),
      message: proposal.growth
        ? '已经是她的一部分了。在设置 → 知识记忆人格 → 人格节点的“成长日记”里能看到、改或删。'
        : '记住了，聊天时她就会用上。在设置 → 知识记忆人格的记忆列表里能改或删。',
      ok: true,
    };
  }
  return { config: null, message: result.status === 'conflict' ? '图谱刚被修改过，请再点一次“记住”。' : `记录失败：${'reason' in result ? String(result.reason) : '未知原因'}`, ok: false };
}
